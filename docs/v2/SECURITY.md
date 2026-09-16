# Security

## Garde-fous appliqués

- aucune clé `service_role` dans le frontend
- isolement explicite des requêtes d’entreprise dans `src/services/*`
- séparation des permissions frontend et de l’application des règles RLS côté base
- `ErrorBoundary` UI pour éviter les écrans blancs silencieux
- triggers d’audit entreprises corrigés pour éviter les références statiques à des colonnes absentes

## Frontend

- `requireEnterpriseId()` et `requireProfileId()` bloquent les appels incomplets
- pages cœur migrées vers une couche de services testable
- navigation Super Admin réservée au profil `is_super_admin`

## Base

- policies RLS actives sur les tables publiques métier
- opérations sensibles Super Admin encapsulées dans des RPC côté base
