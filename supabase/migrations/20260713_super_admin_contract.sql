BEGIN;

CREATE OR REPLACE FUNCTION public.safe_delete_if_column_exists(
  p_schema text,
  p_table text,
  p_column text,
  p_value uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', p_schema, p_table, p_column)
    USING p_value;
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.profiles_with_email AS
SELECT
  p.*,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id;

CREATE OR REPLACE VIEW public.super_admin_entreprises AS
SELECT
  e.id AS entreprise_id,
  COALESCE((SELECT count(*) FROM public.sites s WHERE s.entreprise_id = e.id), 0) AS nb_sites,
  COALESCE((SELECT count(*) FROM public.profiles p WHERE p.entreprise_id = e.id AND p.role = 'admin' AND NOT COALESCE(p.is_super_admin, false)), 0) AS nb_admins,
  COALESCE((SELECT count(*) FROM public.profiles p WHERE p.entreprise_id = e.id AND p.role <> 'admin' AND NOT COALESCE(p.is_super_admin, false)), 0) AS nb_personnel,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'site_id', s.id,
        'site_nom', s.nom,
        'site_ville', s.ville,
        'site_actif', s.actif,
        'admins', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'email', a.email) ORDER BY a.prenom, a.nom)
          FROM public.profiles_with_email a
          WHERE a.site_id = s.id
            AND a.role = 'admin'
            AND NOT COALESCE(a.is_super_admin, false)
        ), '[]'::jsonb),
        'personnel', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', m.id, 'prenom', m.prenom, 'nom', m.nom, 'role', m.role, 'email', m.email) ORDER BY m.prenom, m.nom)
          FROM public.profiles_with_email m
          WHERE m.site_id = s.id
            AND m.role <> 'admin'
            AND NOT COALESCE(m.is_super_admin, false)
        ), '[]'::jsonb)
      ) ORDER BY s.nom
    )
    FROM public.sites s
    WHERE s.entreprise_id = e.id
  ), '[]'::jsonb) AS sites
FROM public.entreprises e;

CREATE OR REPLACE FUNCTION public.supprimer_membre_complet(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller public.profiles%ROWTYPE;
  v_target public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT * INTO v_caller
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller_profile_missing';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_profile_missing';
  END IF;

  IF COALESCE(v_target.is_super_admin, false) THEN
    RAISE EXCEPTION 'protected_super_admin';
  END IF;

  IF NOT COALESCE(v_caller.is_super_admin, false) THEN
    IF v_caller.role NOT IN ('admin', 'responsable') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;

    IF v_target.entreprise_id IS DISTINCT FROM v_caller.entreprise_id THEN
      RAISE EXCEPTION 'forbidden_cross_enterprise';
    END IF;
  END IF;

  PERFORM public.safe_delete_if_column_exists('public', 'credentials_temporaires', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'credentials_temporaires', 'user_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'employe_departements', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'pointages', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'conges', 'employe_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'conges', 'validateur_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'soldes_conges', 'employe_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'messages', 'expediteur_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'messages', 'destinataire_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'rappels', 'cree_par', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'rappels', 'assigne_a', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'taches', 'assigne_a', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'taches', 'cree_par', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'handovers', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_likes', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_items', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'maintenance_tickets', 'profile_id', p_user_id);

  DELETE FROM public.profiles
  WHERE id = p_user_id;

  DELETE FROM auth.users
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'entreprise_id', v_target.entreprise_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.supprimer_entreprise_complete(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller public.profiles%ROWTYPE;
  v_profile_ids uuid[];
  v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT * INTO v_caller
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller_profile_missing';
  END IF;

  IF NOT COALESCE(v_caller.is_super_admin, false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE entreprise_id = p_entreprise_id
      AND COALESCE(is_super_admin, false)
  ) THEN
    RAISE EXCEPTION 'protected_super_admin_linked';
  END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[])
  INTO v_profile_ids
  FROM public.profiles
  WHERE entreprise_id = p_entreprise_id;

  PERFORM public.safe_delete_if_column_exists('public', 'credentials_temporaires', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'employe_departements', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'pointages', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'conges', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'soldes_conges', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'messages', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'rappels', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'taches', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'handovers', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_likes', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_items', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'maintenance_tickets', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'chambres', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'abonnements', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'entreprise_modules', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'entreprise_parametres_pointage', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'sites', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'departements', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'postes', 'entreprise_id', p_entreprise_id);

  IF v_profile_ids IS NOT NULL THEN
    FOREACH v_profile_id IN ARRAY v_profile_ids LOOP
      DELETE FROM auth.users WHERE id = v_profile_id;
    END LOOP;
  END IF;

  DELETE FROM public.profiles
  WHERE entreprise_id = p_entreprise_id;

  DELETE FROM public.entreprises
  WHERE id = p_entreprise_id;

  RETURN jsonb_build_object('success', true, 'entreprise_id', p_entreprise_id, 'users_deleted', COALESCE(array_length(v_profile_ids, 1), 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_delete_if_column_exists(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_membre_complet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_entreprise_complete(uuid) TO authenticated;

COMMIT;
