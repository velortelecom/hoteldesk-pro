# Architecture

## Frontend

### Structure active

```text
src/
  app/
    layouts/
      AppShell.jsx
    router/
      routeConfig.js
  components/
    shared/
      ErrorBoundary.jsx
  hooks/
    useAuth.js
    useModules.js
  lib/
    modules.js
    permissions.js
    supabase.js
  modules/
    conges/
    organisation/
    pointage/
    loader.js
    registry.js
  pages/
    Dashboard.jsx
    Planning.jsx
    Taches.jsx
    Messagerie.jsx
    Rappels.jsx
    SuperAdmin*.jsx
  services/
    enterprise.js
    dashboard.js
    planning.js
    tasks.js
    messages.js
    rappels.js
```

## Principes retenus

- navigation gérée par `HashRouter` pour rester compatible avec l’hébergement statique sans règle de rewrite
- séparation shell / routes / services
- pages UI fines, services responsables des accès Supabase
- permissions métier centralisées dans `src/lib/permissions.js`
- registre de modules conservé comme source de vérité pour les modules activables

## Architecture de données

- toute donnée métier utilisateur passe par un scope `entreprise_id`
- la base reste la source de vérité sécurité via RLS
- le frontend applique le même isolement explicitement dans les services
