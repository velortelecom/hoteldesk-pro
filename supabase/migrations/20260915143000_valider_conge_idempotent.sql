-- =====================================================================
-- VELOR ONE - Correctif : double debit du solde de conges
-- Date : 2026-09-15  (DEJA APPLIQUE EN PRODUCTION)
--
-- Constate en production : une demande de 1 jour approuvee une seule fois
-- debitait 2.0 jours (cp_pris 0 -> 2.0, solde 1.3 -> -0.7).
--
-- Cause : valider_conge() lisait la demande sans verrou. Le front appelle la
-- RPC deux fois en parallele. Les deux transactions lisent statut =
-- 'en_attente' avant que l'autre ne commite, le garde-fou du trigger
-- on_conge_approuve (OLD.statut = 'approuve') passe dans les deux, et chacune
-- applique cp_pris = cp_pris + nb_jours.
--
-- Correctif : SELECT ... FOR UPDATE serialise les appels concurrents, et un
-- garde-fou d'idempotence transforme le second en no-op.
-- =====================================================================

CREATE OR REPLACE FUNCTION valider_conge(
  p_conge_id UUID,
  p_statut TEXT,
  p_validateur_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_conge RECORD;
  v_validateur RECORD;
BEGIN
  -- FOR UPDATE : le second appel concurrent attend ici, puis relit la ligne
  -- dans son etat commite le plus recent.
  SELECT * INTO v_conge FROM conges WHERE id = p_conge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande de conge introuvable';
  END IF;

  SELECT * INTO v_validateur FROM profiles WHERE id = p_validateur_id;

  IF NOT (
    v_validateur.is_super_admin = true
    OR (v_validateur.role IN ('admin','responsable')
        AND v_validateur.entreprise_id = v_conge.entreprise_id)
  ) THEN
    RAISE EXCEPTION 'Non autorise';
  END IF;

  -- Idempotence : deja dans l'etat demande, on ne retouche pas au solde.
  IF v_conge.statut = p_statut THEN
    RETURN;
  END IF;

  UPDATE conges
     SET statut = p_statut,
         validateur_id = p_validateur_id,
         validated_at = NOW()
   WHERE id = p_conge_id
     AND statut IS DISTINCT FROM p_statut;
END;
$$;

GRANT EXECUTE ON FUNCTION valider_conge(UUID, TEXT, UUID) TO authenticated;

-- =====================================================================
-- Reparation des soldes deja fausses
-- cp_pris est recalcule depuis la source de verite (les conges approuves)
-- au lieu d'etre corrige a la main : idempotent, rejouable sans risque.
-- Ajouter un WHERE sur employe_id pour cibler un seul compte.
-- =====================================================================

-- UPDATE soldes_conges s
--    SET cp_pris = COALESCE((
--          SELECT sum(c.nb_jours) FROM conges c
--           WHERE c.employe_id = s.employe_id
--             AND c.statut = 'approuve'
--             AND c.type_conge = 'conges_payes'
--             AND EXTRACT(YEAR FROM c.date_debut)::int = s.annee
--        ), 0),
--        updated_at = NOW();
