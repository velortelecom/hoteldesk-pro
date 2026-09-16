-- ============================================================================
-- VELOR ONE / HÔTELDESK PRO
-- Déclencheurs de la table taches — RELEVÉ DE L'EXISTANT, NON APPLIQUÉ
--
-- ⚠️ CE FICHIER N'EST PAS UNE MIGRATION À JOUER.
--
-- Ces objets existent en production depuis longtemps et n'ont jamais été
-- versionnés : ils ont été créés directement dans le SQL Editor. Le dépôt
-- ne décrivait donc pas ce que fait réellement la base, et il a fallu
-- interroger le catalogue Postgres pour comprendre d'où venaient des
-- rappels fantômes.
--
-- On les consigne ici tels qu'ils sont, pour que la prochaine personne —
-- toi dans six mois, ou quelqu'un d'autre — n'ait pas à refaire l'enquête.
--
-- Rejouer ce fichier écraserait la correction de fuseau appliquée par
-- 20260916_0004_rappels_orphelins.sql. Si tu veux modifier ces fonctions,
-- écris une NOUVELLE migration.
--
-- Relevé le 16/09/2026 sur le projet vcpnrisxbnvyupsbieie.
-- ============================================================================


-- ############################################################################
-- DÉCLENCHEURS POSÉS SUR public.taches
--
--   taches_updated_at       UPDATE                  -> update_updated_at
--   trg_lecture_seule       INSERT+UPDATE+DELETE    -> bloque_si_essai_termine
--   trigger_rappels_tache   INSERT+UPDATE           -> gerer_rappels_tache
--   trigger_recurrence      INSERT+UPDATE           -> generer_occurrences_recurrentes
--
-- Sur public.rappels :
--   trg_lecture_seule       INSERT+UPDATE+DELETE    -> bloque_si_essai_termine
--
-- Les deux déclencheurs métier réagissent à INSERT **et** UPDATE. Chaque
-- modification d'une tâche rejoue donc la génération complète. Les deux
-- fonctions nettoient avant de recréer, elles sont donc idempotentes prises
-- séparément — mais leur combinaison a produit les rappels fantômes :
-- generer_occurrences_recurrentes supprimait les tâches filles, et la clé
-- étrangère rappels.tache_id étant en SET NULL, leurs rappels survivaient
-- détachés. C'est corrigé par 20260916_0004 (clé passée en CASCADE).
-- ############################################################################


-- ############################################################################
-- generer_occurrences_recurrentes — corps en production, inchangé
--
-- Points à connaître :
--   - ne fait rien sans recurrence_type ni date_echeance
--   - ne se rejoue pas sur une occurrence enfant (garde anti-récursion)
--   - sur UPDATE, supprime les filles avant de régénérer
--   - horizon par défaut : date_echeance + 1 an, plafonné à 366 occurrences.
--     Une tâche quotidienne sur un an produit donc 366 tâches ET 366 rappels.
-- ############################################################################
/*
CREATE OR REPLACE FUNCTION public.generer_occurrences_recurrentes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_date_courante timestamptz;
  v_date_fin      date;
  v_intervalle    interval;
  v_count         integer := 0;
  v_max           integer := 366; -- sécurité: max 366 occurrences
BEGIN
  IF NEW.recurrence_type IS NULL OR NEW.date_echeance IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tache_parente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM taches WHERE tache_parente_id = NEW.id;
  END IF;

  v_date_fin := COALESCE(
    NEW.recurrence_fin,
    (NEW.date_echeance::date + interval '1 year')::date
  );

  v_intervalle := CASE NEW.recurrence_type
    WHEN 'quotidienne'   THEN interval '1 day'
    WHEN 'hebdomadaire'  THEN interval '1 week'
    WHEN 'mensuelle'     THEN interval '1 month'
    WHEN 'annuelle'      THEN interval '1 year'
    ELSE NULL
  END;

  IF v_intervalle IS NULL THEN
    RETURN NEW;
  END IF;

  v_date_courante := NEW.date_echeance + v_intervalle;

  WHILE v_date_courante::date <= v_date_fin AND v_count < v_max LOOP
    INSERT INTO taches (
      titre, description, categorie, priorite, statut, date_echeance,
      chambre, assigne_a, cree_par, heure_debut, heure_fin,
      recurrence_type, tache_parente_id, departement
    ) VALUES (
      NEW.titre, NEW.description, NEW.categorie, NEW.priorite,
      'planifiee', v_date_courante, NEW.chambre, NEW.assigne_a, NEW.cree_par,
      NEW.heure_debut, NEW.heure_fin, NEW.recurrence_type, NEW.id, NEW.departement
    );

    v_date_courante := v_date_courante + v_intervalle;
    v_count := v_count + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;
*/


-- ############################################################################
-- creer_rappel_tache — NON RELEVÉE
--
-- Cette fonction insère elle aussi dans public.rappels, mais n'est branchée
-- sur aucun déclencheur des tables taches ou rappels. Son corps n'a pas été
-- relevé. À examiner avant toute évolution des rappels : elle est peut-être
-- appelée depuis une RPC, ou simplement morte.
--
--   select pg_get_functiondef('public.creer_rappel_tache'::regproc);
-- ############################################################################
