# Déploiement

## Local

```bash
npm install
npm test -- --watchAll=false --runInBand
npm run build
```

## Vérifications QA / E2E

Préparer les variables d'environnement (selon le script) :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (provisioning uniquement)
- `QA_ADMIN_EMAIL`
- `QA_ADMIN_PASSWORD`
- `QA_FOREIGN_ENTREPRISE_SLUG` (isolation ciblée)
- `E2E_SUPERADMIN_EMAIL`
- `E2E_SUPERADMIN_PASSWORD`

Commandes :

```bash
npm run qa:provision
npm run qa:functions-health
npm run qa:db-health
npm run qa:verify-chef-role
npm run qa:e2e-smoke
npm run qa:full
npm run validate:mission
npm run validate:mission:ci
```

### CI (non-mutant)

Le workflow GitHub Actions `Mission Validation` execute:

- `validate:app` (tests + build)
- `validate:mission:ci` (tests + build + health edge functions)
- `qa_runtime_health.sql` via `supabase db query --db-url`

Secrets requis pour le job backend:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_DB_URL` (chaîne de connexion Postgres percent-encodée, compatible `supabase db query --db-url`)

Pour vérifier l'isolation d'une entreprise admin existante :

```bash
npm run qa:isolation
```

## Supabase

- projet lié : `vcpnrisxbnvyupsbieie`
- exécution ciblée d’une migration SQL possible avec :

```bash
supabase db query --linked --file "supabase/migrations/<migration>.sql"
```

## Preview Vercel

- le workflow attendu est le push GitHub
- l’URL de preview se récupère via les statuts de déploiement GitHub/Vercel
