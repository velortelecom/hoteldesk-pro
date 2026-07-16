# Velor One V2

Velor One est une plateforme SaaS modulaire de gestion quotidienne pour PME construite avec React et Supabase.

## Socle livré

- authentification Supabase et profil utilisateur
- espace entreprise avec dashboard, planning, tâches, rappels et messagerie
- module organisation et module pointage
- console Super Admin
- isolation des données par entreprise via RLS et filtrage applicatif explicite
- routeur maintenu basé sur `react-router-dom` (`HashRouter`)
- couche de services frontend pour les pages cœur

## Démarrage local

```bash
npm install
npm test -- --watchAll=false --runInBand
npm run build
npm start
```

## Variables d'environnement

Copier `.env.example` en `.env` et renseigner :

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

## Documentation

- `docs/AUDIT_INITIAL.md`
- `docs/ARCHITECTURE.md`
- `docs/FONCTIONNEL.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/PERMISSIONS.md`
- `docs/TESTS.md`
- `docs/DEPLOIEMENT.md`
- `docs/CHANGELOG_V2.md`
- `docs/DECISIONS.md`

## Base Supabase liée

- projet : `vcpnrisxbnvyupsbieie`

## Notes

Le socle utilisateur est migré vers une navigation maintenue et une couche de services d’entreprise.
La console Super Admin V2 est désormais structurée par sections dédiées (dashboard, entreprises, utilisateurs, modules, offres/limites, support, audit, plateforme, paramètres, assistance) avec services et composants `src/services/superadmin/*` et `src/components/superadmin/*`.

