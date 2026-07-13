BEGIN;

CREATE OR REPLACE VIEW public.profiles_with_email AS
SELECT
  p.id,
  p.prenom,
  p.nom,
  p.role,
  p.entreprise_id,
  p.is_super_admin,
  p.telephone,
  p.actif,
  u.email,
  p.site_id,
  p.poste_id,
  p.poste_secondaire_id,
  p.departement,
  p.avatar_initiales,
  p.created_at,
  p.updated_at,
  p.couleur,
  p.photo_url,
  p.date_entree,
  p.notes_internes,
  p.identifiant,
  p.langue,
  p.derniere_connexion,
  u.created_at AS auth_created_at,
  u.last_sign_in_at AS last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id;

CREATE OR REPLACE FUNCTION public.super_admin_platform_health()
RETURNS TABLE (
  total_entreprises bigint,
  entreprises_actives bigint,
  entreprises_suspendues bigint,
  total_users bigint,
  users_actifs bigint,
  users_desactives bigint,
  admins bigint,
  total_sites bigint,
  sites_actifs bigint,
  total_departements bigint,
  departements_actifs bigint,
  total_postes bigint,
  postes_actifs bigint,
  modules_actifs bigint,
  entreprises_sans_admin bigint,
  entreprises_sans_site bigint,
  entreprises_sans_module bigint,
  alertes_configuration bigint,
  audit_total bigint,
  incidents_24h bigint,
  incidents_7j bigint,
  last_audit_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_audit_events boolean := to_regclass('public.audit_events') IS NOT NULL;
BEGIN
  IF v_has_audit_events THEN
    RETURN QUERY
    WITH enterprise_counts AS (
      SELECT
        count(*) AS total_entreprises,
        count(*) FILTER (WHERE actif IS DISTINCT FROM false) AS entreprises_actives,
        count(*) FILTER (WHERE actif = false) AS entreprises_suspendues
      FROM public.entreprises
    ),
    profile_counts AS (
      SELECT
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false)) AS total_users,
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false) AND actif IS DISTINCT FROM false) AS users_actifs,
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false) AND actif = false) AS users_desactives,
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false) AND role = 'admin') AS admins
      FROM public.profiles
    ),
    resource_counts AS (
      SELECT
        (SELECT count(*) FROM public.sites) AS total_sites,
        (SELECT count(*) FILTER (WHERE actif IS DISTINCT FROM false) FROM public.sites) AS sites_actifs,
        (SELECT count(*) FROM public.departements) AS total_departements,
        (SELECT count(*) FILTER (WHERE actif IS DISTINCT FROM false) FROM public.departements) AS departements_actifs,
        (SELECT count(*) FROM public.postes) AS total_postes,
        (SELECT count(*) FILTER (WHERE actif IS DISTINCT FROM false) FROM public.postes) AS postes_actifs,
        (SELECT count(*) FILTER (WHERE actif = true) FROM public.entreprise_modules) AS modules_actifs
    ),
    issue_counts AS (
      SELECT
        count(*) FILTER (WHERE issue_type = 'sans_admin') AS entreprises_sans_admin,
        count(*) FILTER (WHERE issue_type = 'sans_site') AS entreprises_sans_site,
        count(*) FILTER (WHERE issue_type = 'sans_module') AS entreprises_sans_module
      FROM (
        SELECT e.id, 'sans_admin'::text AS issue_type
        FROM public.entreprises e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.entreprise_id = e.id
            AND p.role = 'admin'
            AND NOT COALESCE(p.is_super_admin, false)
        )
        UNION ALL
        SELECT e.id, 'sans_site'::text AS issue_type
        FROM public.entreprises e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.sites s
          WHERE s.entreprise_id = e.id
        )
        UNION ALL
        SELECT e.id, 'sans_module'::text AS issue_type
        FROM public.entreprises e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.entreprise_modules em
          WHERE em.entreprise_id = e.id
            AND em.actif = true
        )
      ) issues
    ),
    audit_counts AS (
      SELECT
        count(*) AS audit_total,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS incidents_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS incidents_7j,
        max(created_at) AS last_audit_at
      FROM public.audit_events
    )
    SELECT
      ec.total_entreprises,
      ec.entreprises_actives,
      ec.entreprises_suspendues,
      pc.total_users,
      pc.users_actifs,
      pc.users_desactives,
      pc.admins,
      rc.total_sites,
      rc.sites_actifs,
      rc.total_departements,
      rc.departements_actifs,
      rc.total_postes,
      rc.postes_actifs,
      rc.modules_actifs,
      ic.entreprises_sans_admin,
      ic.entreprises_sans_site,
      ic.entreprises_sans_module,
      (ic.entreprises_sans_admin + ic.entreprises_sans_site + ic.entreprises_sans_module) AS alertes_configuration,
      ac.audit_total,
      ac.incidents_24h,
      ac.incidents_7j,
      ac.last_audit_at
    FROM enterprise_counts ec
    CROSS JOIN profile_counts pc
    CROSS JOIN resource_counts rc
    CROSS JOIN issue_counts ic
    CROSS JOIN audit_counts ac;
  ELSE
    RETURN QUERY
    WITH enterprise_counts AS (
      SELECT
        count(*) AS total_entreprises,
        count(*) FILTER (WHERE actif IS DISTINCT FROM false) AS entreprises_actives,
        count(*) FILTER (WHERE actif = false) AS entreprises_suspendues
      FROM public.entreprises
    ),
    profile_counts AS (
      SELECT
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false)) AS total_users,
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false) AND actif IS DISTINCT FROM false) AS users_actifs,
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false) AND actif = false) AS users_desactives,
        count(*) FILTER (WHERE NOT COALESCE(is_super_admin, false) AND role = 'admin') AS admins
      FROM public.profiles
    ),
    resource_counts AS (
      SELECT
        (SELECT count(*) FROM public.sites) AS total_sites,
        (SELECT count(*) FILTER (WHERE actif IS DISTINCT FROM false) FROM public.sites) AS sites_actifs,
        (SELECT count(*) FROM public.departements) AS total_departements,
        (SELECT count(*) FILTER (WHERE actif IS DISTINCT FROM false) FROM public.departements) AS departements_actifs,
        (SELECT count(*) FROM public.postes) AS total_postes,
        (SELECT count(*) FILTER (WHERE actif IS DISTINCT FROM false) FROM public.postes) AS postes_actifs,
        (SELECT count(*) FILTER (WHERE actif = true) FROM public.entreprise_modules) AS modules_actifs
    ),
    issue_counts AS (
      SELECT
        count(*) FILTER (WHERE issue_type = 'sans_admin') AS entreprises_sans_admin,
        count(*) FILTER (WHERE issue_type = 'sans_site') AS entreprises_sans_site,
        count(*) FILTER (WHERE issue_type = 'sans_module') AS entreprises_sans_module
      FROM (
        SELECT e.id, 'sans_admin'::text AS issue_type
        FROM public.entreprises e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.entreprise_id = e.id
            AND p.role = 'admin'
            AND NOT COALESCE(p.is_super_admin, false)
        )
        UNION ALL
        SELECT e.id, 'sans_site'::text AS issue_type
        FROM public.entreprises e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.sites s
          WHERE s.entreprise_id = e.id
        )
        UNION ALL
        SELECT e.id, 'sans_module'::text AS issue_type
        FROM public.entreprises e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.entreprise_modules em
          WHERE em.entreprise_id = e.id
            AND em.actif = true
        )
      ) issues
    )
    SELECT
      ec.total_entreprises,
      ec.entreprises_actives,
      ec.entreprises_suspendues,
      pc.total_users,
      pc.users_actifs,
      pc.users_desactives,
      pc.admins,
      rc.total_sites,
      rc.sites_actifs,
      rc.total_departements,
      rc.departements_actifs,
      rc.total_postes,
      rc.postes_actifs,
      rc.modules_actifs,
      ic.entreprises_sans_admin,
      ic.entreprises_sans_site,
      ic.entreprises_sans_module,
      (ic.entreprises_sans_admin + ic.entreprises_sans_site + ic.entreprises_sans_module) AS alertes_configuration,
      0::bigint AS audit_total,
      0::bigint AS incidents_24h,
      0::bigint AS incidents_7j,
      NULL::timestamptz AS last_audit_at
    FROM enterprise_counts ec
    CROSS JOIN profile_counts pc
    CROSS JOIN resource_counts rc
    CROSS JOIN issue_counts ic;
  END IF;
END;
$$;

GRANT SELECT ON public.profiles_with_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_platform_health() TO authenticated;

COMMIT;