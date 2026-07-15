# Changelog V2

## Fondations

- ajout de `react-router-dom`
- remplacement de la navigation hash artisanale par `HashRouter`
- création de `AppShell` et de `routeConfig`
- ajout d’un `ErrorBoundary` partagé

## Services

- extraction des accès Supabase des pages Dashboard, Planning, Tâches, Messagerie et Rappels
- centralisation du scope entreprise dans `src/services/enterprise.js`

## Qualité

- ajout de tests pour routeur, permissions et helpers entreprise
- documentation de l’audit, de l’architecture et des décisions
