# Permissions

## Rôles

| Rôle | Portée | Notes |
| --- | --- | --- |
| `super_admin` | plateforme | voit et administre tout |
| `admin` | entreprise | gère l’entreprise et ses utilisateurs |
| `responsable` | entreprise/périmètre | gère l’opérationnel et la validation métier |
| `employe` | individuel | exécute ses actions quotidiennes |

## Source de vérité frontend

- registre modules : `src/modules/registry.js`
- helpers : `src/lib/permissions.js`

## Règles pratiques

- `super_admin` contourne les limitations de module côté frontend
- `admin` et `responsable` sont traités comme profils de gestion pour le socle opérationnel
- la vérification d’interface n’est jamais suffisante sans la RLS côté base
