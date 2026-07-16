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

## Correctifs audit final

- alignement des droits `chef_equipe` sur les écrans Tâches et Rappels
- restriction de portée `chef_equipe` côté services (`tasks`, `rappels`) pour éviter une visibilité équivalente admin
- activation du rôle `chef_equipe` dans le sélecteur de rôle de la fiche employé
- suppression des placeholders visibles dans la fiche employé
- masquage runtime des modules catalogue non V2 via le loader
- renforcement des tests de permissions (`chef_equipe` classé manager)
- pipeline mission conservé en `npm ci` (pas de fallback `npm install`)
