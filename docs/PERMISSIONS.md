# Permissions

## Rôles

| Rôle | Portée | Notes |
| --- | --- | --- |
| `super_admin` | plateforme | voit et administre tout |
| `admin` | entreprise | gère l’entreprise et ses utilisateurs |
| `responsable` | entreprise/périmètre | gère l’opérationnel et la validation métier |
| `chef_equipe` | équipe/périmètre | crée et suit l’exécution sans privilèges admin globaux |
| `employe` | individuel | exécute ses actions quotidiennes |

## Source de vérité frontend

- registre modules : `src/modules/registry.js`
- helpers : `src/lib/permissions.js`

## Règles pratiques

- `super_admin` contourne les limitations de module côté frontend
- `admin`, `responsable` et `chef_equipe` sont des profils de gestion UI sur le socle opérationnel
- `chef_equipe` ne reçoit pas les droits d’administration globale (pas de promotion admin, pas de vision full-tenant implicite)
- la vérification d’interface n’est jamais suffisante sans la RLS côté base
