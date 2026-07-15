# Decisions

## D-001 — Conserver JavaScript pour cette tranche

Une migration TypeScript complète aurait ralenti la stabilisation du socle. Le dépôt reste en JavaScript, avec helpers testables et documentation renforcée.

## D-002 — Utiliser `HashRouter`

Le projet est hébergé en statique et utilisait déjà un hash maison. `HashRouter` apporte un routeur maintenu sans imposer de rewrites serveur.

## D-003 — Refactorer d’abord le socle utilisateur

Le risque principal identifié était la multiplication de requêtes inline non systématiquement filtrées par entreprise. La première tranche V2 cible donc les pages utilisateur cœur.

## D-004 — Garder Super Admin en tranche 2

Le back-office est déjà partiellement décomposé en sous-composants. Une refonte complète reste faisable ensuite sans bloquer la sécurisation du socle quotidien.
