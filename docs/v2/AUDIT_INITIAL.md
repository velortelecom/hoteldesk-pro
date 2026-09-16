# Audit Initial

## Point de départ

- branche de départ : `pointage-migration-draft`
- branche de travail : `claude/velor-one-v2`
- build initial : OK
- tests initiaux : 6 suites / 26 tests, OK
- projet Supabase lié : `vcpnrisxbnvyupsbieie`

## Constats majeurs

1. Le produit mélange ancienne navigation artisanale et modules plus récents.
2. Plusieurs pages cœur interrogeaient Supabase directement depuis le composant.
3. Des requêtes utilisateur ne forçaient pas systématiquement `entreprise_id`.
4. La sécurité base existe déjà en RLS, mais le frontend devait l’aligner plus rigoureusement.
5. `SuperAdmin.jsx` reste volumineux malgré la présence de sous-composants extraits.

## Risques initiaux

- fuite inter-entreprises côté UI si une requête client oublie le filtre d’entreprise
- forte duplication de logique entre pages
- navigation difficile à faire évoluer
- dette documentaire importante

## Correctifs V2 engagés

- adoption d’un routeur maintenu `react-router-dom` avec `HashRouter`
- création d’un shell applicatif dédié
- création d’une couche `src/services/*` pour dashboard, planning, tâches, rappels et messagerie
- ajout d’helpers de permissions et de contexte entreprise
- ajout de tests de fondation
