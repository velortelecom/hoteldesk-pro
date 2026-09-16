-- Reset metier data while preserving one protected Super Admin profile
-- Scope: destructive cleanup migration

BEGIN;

-- ============================================================
-- 1. Security check: protected Super Admin must exist and be unique
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.profiles
  WHERE id = '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4'
    AND role = 'super_admin'
    AND is_super_admin = true;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'STOP: protected Super Admin is missing or invalid.';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.profiles
  WHERE is_super_admin = true;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'STOP: multiple Super Admins or no Super Admin detected.';
  END IF;
END;
$$;

-- ============================================================
-- 2. Cleanup business data
-- ============================================================

DELETE FROM public.rappels;
DELETE FROM public.corrections_pointage;
DELETE FROM public.feed_likes;
DELETE FROM public.maintenance_tickets;
DELETE FROM public.taches;
DELETE FROM public.pointages;
DELETE FROM public.feed_items;
DELETE FROM public.conges;
DELETE FROM public.messages;
DELETE FROM public.handovers;
DELETE FROM public.soldes_conges;
DELETE FROM public.chambres;
DELETE FROM public.abonnements;
DELETE FROM public.credentials_temporaires;
DELETE FROM public.employe_departements;
DELETE FROM public.entreprise_modules;
DELETE FROM public.entreprise_parametres_pointage;

DELETE FROM public.profiles
WHERE id <> '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4';

DELETE FROM public.postes;
DELETE FROM public.departements;
DELETE FROM public.sites;
DELETE FROM public.entreprises;

-- ============================================================
-- 3. Automatic guard checks before validation
-- Any anomaly cancels the transaction
-- ============================================================

DO $$
DECLARE
  v_profiles integer;
  v_superadmins integer;
  v_modules_catalogue integer;
  v_templates_secteur integer;
  v_metier_restant integer;
BEGIN
  SELECT count(*) INTO v_profiles
  FROM public.profiles;

  SELECT count(*) INTO v_superadmins
  FROM public.profiles
  WHERE id = '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4'
    AND role = 'super_admin'
    AND is_super_admin = true;

  SELECT count(*) INTO v_modules_catalogue
  FROM public.modules_catalogue;

  SELECT count(*) INTO v_templates_secteur
  FROM public.templates_secteur;

  SELECT
      (SELECT count(*) FROM public.entreprises)
    + (SELECT count(*) FROM public.departements)
    + (SELECT count(*) FROM public.postes)
    + (SELECT count(*) FROM public.employe_departements)
    + (SELECT count(*) FROM public.sites)
    + (SELECT count(*) FROM public.entreprise_modules)
    + (SELECT count(*) FROM public.entreprise_parametres_pointage)
    + (SELECT count(*) FROM public.pointages)
    + (SELECT count(*) FROM public.corrections_pointage)
    + (SELECT count(*) FROM public.taches)
    + (SELECT count(*) FROM public.conges)
    + (SELECT count(*) FROM public.soldes_conges)
    + (SELECT count(*) FROM public.rappels)
    + (SELECT count(*) FROM public.messages)
    + (SELECT count(*) FROM public.chambres)
    + (SELECT count(*) FROM public.handovers)
    + (SELECT count(*) FROM public.maintenance_tickets)
    + (SELECT count(*) FROM public.feed_items)
    + (SELECT count(*) FROM public.feed_likes)
    + (SELECT count(*) FROM public.abonnements)
    + (SELECT count(*) FROM public.credentials_temporaires)
  INTO v_metier_restant;

  IF v_profiles <> 1 THEN
    RAISE EXCEPTION
      'STOP: profiles should contain 1 row, got: %',
      v_profiles;
  END IF;

  IF v_superadmins <> 1 THEN
    RAISE EXCEPTION
      'STOP: protected Super Admin is no longer valid.';
  END IF;

  IF v_metier_restant <> 0 THEN
    RAISE EXCEPTION
      'STOP: % business rows are still present.',
      v_metier_restant;
  END IF;

  IF v_modules_catalogue <> 18 THEN
    RAISE EXCEPTION
      'STOP: modules_catalogue changed, got: %',
      v_modules_catalogue;
  END IF;

  IF v_templates_secteur <> 10 THEN
    RAISE EXCEPTION
      'STOP: templates_secteur changed, got: %',
      v_templates_secteur;
  END IF;
END;
$$;

COMMIT;

-- ============================================================
-- 4. Final state snapshot
-- ============================================================

SELECT
  (SELECT count(*) FROM public.entreprises) AS entreprises,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.profiles
   WHERE is_super_admin = true) AS super_admins,
  (SELECT count(*) FROM public.departements) AS departements,
  (SELECT count(*) FROM public.postes) AS postes,
  (SELECT count(*) FROM public.sites) AS sites,
  (SELECT count(*) FROM public.entreprise_modules) AS entreprise_modules,
  (SELECT count(*) FROM public.modules_catalogue) AS modules_catalogue,
  (SELECT count(*) FROM public.templates_secteur) AS templates_secteur;
