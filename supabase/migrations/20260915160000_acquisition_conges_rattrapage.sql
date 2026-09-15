-- =====================================================================
-- VELOR ONE - Acquisition des conges : rattrapage des mois manques
-- Date : 2026-09-15  (DEJA APPLIQUE EN PRODUCTION)
--
-- Constate : crediter_cp_mensuel() ne creditait qu'UN SEUL mois par appel,
-- le mois courant, puis poussait dernier_credit_mois directement a ce mois.
-- Si personne n'ouvrait le module Conges pendant deux mois, les deux mois
-- manques etaient perdus definitivement. Exemple releve en production :
-- un salarie embauche le 30/07 avait 2.5 jours au 15/09 au lieu de ~5.2,
-- son prorata de juillet n'ayant jamais ete credite.
--
-- Aggravant : la fonction etait declenchee au chargement de la page Conges,
-- pas par une tache planifiee. Une entreprise qui n'ouvrait jamais l'ecran
-- n'acquerait jamais de conges.
--
-- Trois correctifs ici :
--   1. crediter_cp_mensuel boucle sur TOUS les mois entre le dernier credit
--      et le mois courant
--   2. on_conge_approuve ne cree plus de solde a 25 jours en dur (il partait
--      de 25 alors que crediter_cp_mensuel part de 0 : selon lequel passait
--      en premier, le meme salarie demarrait a 0 ou a 25)
--   3. planification mensuelle via pg_cron, au lieu de dependre d'une
--      ouverture de page
--
-- NON FAIT volontairement : le recalcul retroactif des soldes depuis la date
-- d'embauche. Les mois deja perdus (juillet ci-dessus) le restent.
-- =====================================================================


-- =====================================================================
-- 1. Acquisition avec rattrapage
-- =====================================================================

CREATE OR REPLACE FUNCTION crediter_cp_mensuel(p_entreprise_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_employe RECORD;
  v_annee INT := EXTRACT(YEAR FROM NOW())::INT;
  v_mois_courant DATE := DATE_TRUNC('month', NOW())::DATE;
  v_mois DATE;
  v_depart DATE;
  v_jours NUMERIC(5,1);
  v_jours_mois INT;
  v_jours_rest INT;
  v_total NUMERIC(5,1);
BEGIN
  FOR v_employe IN
    SELECT p.id AS pid, p.created_at::DATE AS dt, s.dernier_credit_mois AS dcm
      FROM profiles p
      LEFT JOIN soldes_conges s ON s.employe_id = p.id AND s.annee = v_annee
     WHERE p.entreprise_id = p_entreprise_id
       AND p.is_super_admin = false
       AND p.actif = true
  LOOP
    INSERT INTO soldes_conges (employe_id, entreprise_id, annee, cp_acquis, cp_pris, dernier_credit_mois)
    VALUES (v_employe.pid, p_entreprise_id, v_annee, 0, 0, NULL)
    ON CONFLICT (employe_id, annee) DO NOTHING;

    -- Premier mois a crediter : celui qui suit le dernier credite, ou le mois
    -- d'embauche, borne au 1er janvier de l'annee en cours.
    IF v_employe.dcm IS NULL THEN
      v_depart := GREATEST(DATE_TRUNC('month', v_employe.dt)::DATE, MAKE_DATE(v_annee, 1, 1));
    ELSE
      v_depart := (v_employe.dcm + INTERVAL '1 month')::DATE;
    END IF;

    v_total := 0;
    v_mois := v_depart;
    WHILE v_mois <= v_mois_courant LOOP
      IF DATE_TRUNC('month', v_employe.dt)::DATE = v_mois THEN
        -- Mois d'embauche : prorata sur les jours restants
        v_jours_mois := EXTRACT(DAY FROM (v_mois + INTERVAL '1 month' - INTERVAL '1 day'))::INT;
        v_jours_rest := v_jours_mois - EXTRACT(DAY FROM v_employe.dt)::INT + 1;
        v_jours := ROUND((2.5 * v_jours_rest::NUMERIC / v_jours_mois), 1);
      ELSE
        v_jours := 2.5;
      END IF;
      v_total := v_total + v_jours;
      v_mois := (v_mois + INTERVAL '1 month')::DATE;
    END LOOP;

    IF v_total > 0 THEN
      UPDATE soldes_conges
         SET cp_acquis = cp_acquis + v_total,
             dernier_credit_mois = v_mois_courant,
             updated_at = NOW()
       WHERE employe_id = v_employe.pid AND annee = v_annee;
    END IF;
  END LOOP;
END;
$$;


-- =====================================================================
-- 2. on_conge_approuve : plus de solde cree a 25 jours
-- Applique en production par substitution sur la definition existante :
--
--   DO $do$ DECLARE d text; BEGIN
--     SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname = 'on_conge_approuve';
--     d := replace(d, 'v_annee, 25, v_nb_jours, 0, 0', 'v_annee, 0, v_nb_jours, 0, 0');
--     d := replace(d, 'v_annee, 25, 0, 10, v_nb_jours', 'v_annee, 0, 0, 10, v_nb_jours');
--     EXECUTE d;
--   END $do$;
-- =====================================================================


-- =====================================================================
-- 3. Planification mensuelle (pg_cron)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION crediter_cp_toutes_entreprises()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE e RECORD;
BEGIN
  FOR e IN SELECT id FROM entreprises WHERE actif = true LOOP
    PERFORM crediter_cp_mensuel(e.id);
  END LOOP;
END;
$$;

-- Le 1er de chaque mois a 03h00 UTC.
-- SELECT cron.schedule('crediter-cp-mensuel', '0 3 1 * *',
--        $job$ select crediter_cp_toutes_entreprises() $job$);

-- Controle : SELECT jobname, schedule, active, command FROM cron.job;
