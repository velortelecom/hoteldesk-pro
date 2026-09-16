-- =====================================================================
-- VELOR ONE - profiles_with_email doit rester en droits du proprietaire
-- Date : 2026-09-16  (APPLIQUE EN PRODUCTION LE 16/09/2026)
--
-- CONSTATE
-- Le dashboard Super Admin affichait "0 utilisateur" pour toutes les
-- entreprises, alors que les comptes existaient bien en base. La lecture
-- echouait avec :
--
--     permission denied for table users
--
-- La vue joint auth.users, table sur laquelle le role authenticated n'a
-- aucun droit. Elle etait passee en security_invoker = on : elle
-- s'executait donc avec les droits de l'appelant, qui n'a pas acces a
-- auth.users. Toute lecture etait refusee.
--
-- Ce reglage n'a pas ete pose par une migration du depot. Il vient tres
-- probablement d'une correction automatique de l'avertissement Supabase
-- "security definer view", qui ne peut pas savoir que celle-ci en a
-- besoin -- c'est precisement ce que la migration du 15/09 avait deja
-- ecrit noir sur blanc.
--
-- CE QUE CA IMPLIQUE, ET POURQUOI C'EST VOULU
-- En droits du proprietaire, la vue ne passe pas par les regles RLS de
-- profiles. L'isolation entre clients repose donc ENTIEREMENT sur le
-- WHERE de la vue :
--
--     p.id = auth.uid()
--     OR is_super_admin()
--     OR (get_my_role() IN ('admin','responsable')
--         AND p.entreprise_id = get_my_entreprise_id())
--
-- Ce WHERE est la seule chose qui empeche un client de lire les emails
-- d'un autre. Ne jamais l'alleger. La revocation pour le role anon reste
-- en place par ailleurs.
--
-- SI L'AVERTISSEMENT REVIENT
-- Ne pas "corriger" la vue en repassant security_invoker a on : cela
-- recasse le dashboard Super Admin. Rejouer ce fichier.
-- =====================================================================

ALTER VIEW public.profiles_with_email SET (security_invoker = false);


-- =====================================================================
-- CONTROLE (lecture seule)
-- Doit afficher security_invoker=off, ou ne plus mentionner l'option.
-- =====================================================================

SELECT c.relname,
       c.relowner::regrole::text AS proprietaire,
       c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles_with_email';
