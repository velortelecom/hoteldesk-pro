-- Dry-run for guarded business data reset
-- No DELETE is executed. This script only validates prerequisites and reports counts.

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
-- 2. Dry-run report: rows that would be deleted by reset migration
-- ============================================================
SELECT
  (SELECT count(*) FROM public.rappels) AS del_rappels,
  (SELECT count(*) FROM public.corrections_pointage) AS del_corrections_pointage,
  (SELECT count(*) FROM public.feed_likes) AS del_feed_likes,
  (SELECT count(*) FROM public.maintenance_tickets) AS del_maintenance_tickets,
  (SELECT count(*) FROM public.taches) AS del_taches,
  (SELECT count(*) FROM public.pointages) AS del_pointages,
  (SELECT count(*) FROM public.feed_items) AS del_feed_items,
  (SELECT count(*) FROM public.conges) AS del_conges,
  (SELECT count(*) FROM public.messages) AS del_messages,
  (SELECT count(*) FROM public.handovers) AS del_handovers,
  (SELECT count(*) FROM public.soldes_conges) AS del_soldes_conges,
  (SELECT count(*) FROM public.chambres) AS del_chambres,
  (SELECT count(*) FROM public.abonnements) AS del_abonnements,
  (SELECT count(*) FROM public.credentials_temporaires) AS del_credentials_temporaires,
  (SELECT count(*) FROM public.employe_departements) AS del_employe_departements,
  (SELECT count(*) FROM public.entreprise_modules) AS del_entreprise_modules,
  (SELECT count(*) FROM public.entreprise_parametres_pointage) AS del_entreprise_parametres_pointage,
  (SELECT count(*) FROM public.profiles WHERE id <> '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4') AS del_profiles_except_protected_super_admin,
  (SELECT count(*) FROM public.postes) AS del_postes,
  (SELECT count(*) FROM public.departements) AS del_departements,
  (SELECT count(*) FROM public.sites) AS del_sites,
  (SELECT count(*) FROM public.entreprises) AS del_entreprises;

-- ============================================================
-- 3. Invariants snapshot that must remain intact after real reset
-- ============================================================
SELECT
  (SELECT count(*) FROM public.profiles) AS current_profiles,
  (SELECT count(*) FROM public.profiles WHERE is_super_admin = true) AS current_super_admins,
  (SELECT count(*) FROM public.modules_catalogue) AS current_modules_catalogue,
  (SELECT count(*) FROM public.templates_secteur) AS current_templates_secteur,
  (SELECT count(*) FROM public.profiles
   WHERE id = '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4'
     AND role = 'super_admin'
     AND is_super_admin = true) AS protected_super_admin_valid;

ROLLBACK;
