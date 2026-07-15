# Database

## Projet lié

- `vcpnrisxbnvyupsbieie`

## Principes

- RLS active sur les tables métier exposées
- helpers de sécurité déjà présents côté base : `is_super_admin()`, `get_my_entreprise_id()`, `get_my_role()`
- audit d’entreprise et de Super Admin via migrations dédiées

## Migrations récentes importantes

- `20260719_fix_audit_trigger_entreprises.sql`
- `20260719_sync_super_admin_delete_poste_refs.sql`

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

## Seed livré

Le fichier `supabase/seed.sql` alimente le catalogue de modules cœur avec des `upsert` idempotents.
