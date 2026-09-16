BEGIN;

CREATE OR REPLACE FUNCTION public.valider_conge(
  p_conge_id uuid,
  p_statut text,
  p_validateur_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conge public.conges%ROWTYPE;
  v_validateur public.profiles%ROWTYPE;
  v_annee integer;
  v_delta_cp numeric := 0;
  v_delta_rtt numeric := 0;
  v_current_cp_restant numeric := 0;
  v_current_rtt_restant numeric := 0;
BEGIN
  IF p_statut NOT IN ('en_attente', 'approuve', 'refuse', 'annule') THEN
    RAISE EXCEPTION 'invalid_conge_status';
  END IF;

  SELECT * INTO v_conge
  FROM public.conges
  WHERE id = p_conge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conge_not_found';
  END IF;

  SELECT * INTO v_validateur
  FROM public.profiles
  WHERE id = p_validateur_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'validateur_not_found';
  END IF;

  IF NOT (
    COALESCE(v_validateur.is_super_admin, false)
    OR (
      v_validateur.role IN ('admin', 'responsable')
      AND v_validateur.entreprise_id = v_conge.entreprise_id
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_conge.statut = p_statut THEN
    UPDATE public.conges
    SET validateur_id = p_validateur_id,
        validated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_conge_id;
    RETURN;
  END IF;

  v_annee := EXTRACT(YEAR FROM v_conge.date_debut)::integer;

  INSERT INTO public.soldes_conges (employe_id, entreprise_id, annee, cp_acquis, cp_pris, rtt_acquis, rtt_pris)
  VALUES (v_conge.employe_id, v_conge.entreprise_id, v_annee, 0, 0, 0, 0)
  ON CONFLICT (employe_id, annee) DO NOTHING;

  SELECT
    COALESCE(cp_acquis - cp_pris, 0),
    COALESCE(rtt_acquis - rtt_pris, 0)
  INTO v_current_cp_restant, v_current_rtt_restant
  FROM public.soldes_conges
  WHERE employe_id = v_conge.employe_id
    AND annee = v_annee;

  IF v_conge.type_conge = 'conges_payes' THEN
    IF v_conge.statut = 'approuve' AND p_statut <> 'approuve' THEN
      v_delta_cp := -COALESCE(v_conge.nb_jours, 0);
    ELSIF v_conge.statut <> 'approuve' AND p_statut = 'approuve' THEN
      IF COALESCE(v_conge.nb_jours, 0) > v_current_cp_restant THEN
        RAISE EXCEPTION 'solde_cp_insuffisant';
      END IF;
      v_delta_cp := COALESCE(v_conge.nb_jours, 0);
    END IF;
  ELSIF v_conge.type_conge = 'rtt' THEN
    IF v_conge.statut = 'approuve' AND p_statut <> 'approuve' THEN
      v_delta_rtt := -COALESCE(v_conge.nb_jours, 0);
    ELSIF v_conge.statut <> 'approuve' AND p_statut = 'approuve' THEN
      IF COALESCE(v_conge.nb_jours, 0) > v_current_rtt_restant THEN
        RAISE EXCEPTION 'solde_rtt_insuffisant';
      END IF;
      v_delta_rtt := COALESCE(v_conge.nb_jours, 0);
    END IF;
  END IF;

  IF v_delta_cp <> 0 OR v_delta_rtt <> 0 THEN
    UPDATE public.soldes_conges
    SET cp_pris = GREATEST(0, cp_pris + v_delta_cp),
        rtt_pris = GREATEST(0, rtt_pris + v_delta_rtt),
        cp_restant = GREATEST(0, cp_acquis - GREATEST(0, cp_pris + v_delta_cp)),
        updated_at = NOW()
    WHERE employe_id = v_conge.employe_id
      AND annee = v_annee;
  END IF;

  UPDATE public.conges
  SET statut = p_statut,
      validateur_id = p_validateur_id,
      validated_at = NOW(),
      updated_at = NOW()
  WHERE id = p_conge_id;

  INSERT INTO public.business_events (
    entreprise_id,
    actor_id,
    event_type,
    title,
    description,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    v_conge.entreprise_id,
    p_validateur_id,
    'leave_status_changed',
    'Statut de congé mis à jour',
    'Demande de congé ' || p_statut,
    'conge',
    v_conge.id,
    jsonb_build_object('old_status', v_conge.statut, 'new_status', p_statut, 'type_conge', v_conge.type_conge, 'nb_jours', v_conge.nb_jours)
  );

  INSERT INTO public.notifications (
    entreprise_id,
    recipient_id,
    actor_id,
    type,
    title,
    content,
    link,
    resource_type,
    resource_id,
    payload
  )
  VALUES (
    v_conge.entreprise_id,
    v_conge.employe_id,
    p_validateur_id,
    CASE WHEN p_statut = 'approuve' THEN 'leave_approved' WHEN p_statut = 'refuse' THEN 'leave_refused' ELSE 'leave_updated' END,
    CASE WHEN p_statut = 'approuve' THEN 'Congé approuvé' WHEN p_statut = 'refuse' THEN 'Congé refusé' ELSE 'Congé mis à jour' END,
    'Votre demande de congé du ' || v_conge.date_debut::text || ' au ' || v_conge.date_fin::text || ' est ' || p_statut || '.',
    '/conges',
    'conge',
    v_conge.id,
    jsonb_build_object('statut', p_statut, 'type_conge', v_conge.type_conge)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.valider_conge(uuid, text, uuid) TO authenticated;

COMMIT;