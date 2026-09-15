-- =====================================================================
-- VELOR ONE - Fermeture de profiles_with_email
-- Date : 2026-09-15  (DEJA APPLIQUE EN PRODUCTION)
--
-- Constate : la vue profiles_with_email etait accessible au role anon
-- (GRANT SELECT), en SECURITY DEFINER (security_invoker = off) et sans
-- clause WHERE. N'importe qui disposant de la cle anon publique pouvait
-- donc lire le profil ET l'email de tous les utilisateurs, tous clients
-- confondus.
--
-- La vue joint auth.users : elle doit rester SECURITY DEFINER, sinon
-- authenticated n'a plus acces a auth.users et la vue casse. L'isolation
-- multi-tenant est donc portee par le WHERE de la vue elle-meme.
--
-- La liste de colonnes est identique a l'originale : CREATE OR REPLACE VIEW
-- refuse tout changement de nom ou d'ordre des colonnes.
-- =====================================================================

REVOKE ALL ON public.profiles_with_email FROM anon;

CREATE OR REPLACE VIEW public.profiles_with_email
WITH (security_barrier = true) AS
SELECT p.id, p.prenom, p.nom, p.role, p.entreprise_id, p.is_super_admin,
       p.telephone, p.actif, u.email, p.site_id, p.poste_id,
       p.poste_secondaire_id, p.departement, p.avatar_initiales,
       p.created_at, p.updated_at, p.couleur, p.photo_url, p.date_entree,
       p.notes_internes, p.identifiant, p.langue, p.derniere_connexion,
       u.created_at AS auth_created_at, u.last_sign_in_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.id = auth.uid()
   OR is_super_admin()
   OR (get_my_role() IN ('admin','responsable')
       AND p.entreprise_id = get_my_entreprise_id());


-- =====================================================================
-- CONTROLES (lecture seule)
-- =====================================================================

-- Doit renvoyer 0 ligne :
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name = 'profiles_with_email'
--    AND grantee = 'anon';


-- =====================================================================
-- COMPTES QA SUPER ADMIN
-- 11 comptes qa.sa.* / qa.superadmin.* crees le 15/07/2026 etaient encore
-- actifs en production avec is_super_admin = true. Neutralises par un ban
-- reversible le 15/09/2026. Suppression definitive a faire depuis
-- Authentication > Users apres periode d'observation.
-- =====================================================================

-- Identification :
-- SELECT p.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until
--   FROM profiles p JOIN auth.users u ON u.id = p.id
--  WHERE p.is_super_admin = true ORDER BY u.created_at;

-- Neutralisation reversible (banned_until = null pour annuler) :
-- UPDATE auth.users SET banned_until = 'infinity'
--  WHERE (email LIKE 'qa.sa.%' OR email LIKE 'qa.superadmin.%')
--    AND (email LIKE '%@velor.local' OR email LIKE '%@velor-one.test');


-- =====================================================================
-- RESTE A FAIRE : durcir le search_path des helpers RLS
-- (get_my_role, get_my_entreprise_id, is_super_admin) : ces fonctions sont
-- SECURITY DEFINER sans SET search_path.
-- =====================================================================
