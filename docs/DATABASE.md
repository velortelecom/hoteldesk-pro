# Database

## Projet lié

- `vcpnrisxbnvyupsbieie`

## Principes

- RLS active sur les tables métier exposées
- helpers de sécurité déjà présents côté base : `is_super_admin()`, `get_my_entreprise_id()`, `get_my_role()`
- audit d’entreprise et de Super Admin via migrations dédiées

## Migrations récentes importantes

- `20260715_profiles_role_include_chef_equipe.sql`
- `20260719_fix_audit_trigger_entreprises.sql`
- `20260719_sync_super_admin_delete_poste_refs.sql`
- `20260721_super_admin_assistance_settings.sql`
- `20260722_super_admin_assistance_maintenance.sql`
- `20260723_super_admin_assistance_single_session.sql`

## Invariants backend validés

- rôle `chef_equipe` accepté par la contrainte de rôle `profiles.role`
- RPC et Edge Functions de gestion utilisateur compatibles `chef_equipe`
- isolation multi-entreprise préservée sur les parcours QA/E2E
- santé runtime vérifiée sur `create-entreprise`, `create-user`, `create-pointage`

## Tables cœur utilisées par le frontend actuel

- `entreprises`
- `profiles`
- `entreprise_modules`
- `modules_catalogue`
- `taches`
- `messages`
- `rappels`
- `pointages`
- `departements`
- `postes`
- `sites`
- `audit_events`
- `super_admin_assistance_sessions`
- `global_settings`

## Fonctions backend Super Admin récentes

- `super_admin_platform_health()`
- `super_admin_close_expired_assistance_sessions()`

## Seed livré

Le fichier `supabase/seed.sql` alimente le catalogue de modules cœur avec des `upsert` idempotents.
