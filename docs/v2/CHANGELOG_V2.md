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

## Super Admin V2 (finalisation)

- création d’une console Super Admin dédiée (`SuperAdminConsole`) découplée du shell entreprise
- ajout d’un shell Super Admin sectionné (10 sections) avec navigation dédiée, recherche globale et actions rapides
- extraction progressive des domaines en composants/services dédiés :
	- entreprises (`SuperAdminEnterprisesPanel`, `enterpriseService`)
	- modules (`SuperAdminModulesPanel`, `modulesService`)
	- offres & limites (`SuperAdminOffersPanel`, `offersService`)
	- support tickets (`SuperAdminSupportPanel`, `supportService`)
	- paramètres globaux (`SuperAdminSettingsPanel`, `settingsService`)
	- assistance (`assistanceService`)
- suppression des expositions de mots de passe temporaires en clair côté UI Super Admin
- assistance durcie : session unique, TTL, raison obligatoire, fermeture explicite, bandeau global persistant
- ajout de migrations backend Super Admin :
	- `20260721_super_admin_assistance_settings.sql`
	- `20260722_super_admin_assistance_maintenance.sql`
	- `20260723_super_admin_assistance_single_session.sql`
