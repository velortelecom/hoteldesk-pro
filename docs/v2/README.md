# Documentation de la ligne v2 — ARCHIVE, ne decrit PAS la production

Ces douze documents viennent de la branche `backup/pre-audit-fixes-v2`.
Ils decrivent une refonte de Velor One qui **n'a jamais ete mise en
production**, et qui n'a aucun ancetre commun avec la ligne deployee.

## Ce qu'ils decrivent et que la production n'a pas

- une couche `src/services/*` (`enterprise.js`, `dashboard.js`, `planning.js`…)
- un Super Admin decoupe : `SuperAdminShell` + six panneaux extraits
- `src/lib/permissions.js`, `src/app/router/routeConfig.js`, `ErrorBoundary`

En production, le Super Admin est un seul fichier `src/pages/SuperAdmin.jsx`
et les appels Supabase sont faits directement depuis les pages. Toute phrase
de ces documents qui parle de `src/services/` decrit donc v2, pas la
production.

## Ce qui reste vrai malgre tout

`DATABASE.md` decrit la base reelle : les deux lignes de code attaquent le
meme projet Supabase `vcpnrisxbnvyupsbieie`, et les migrations de v2 y sont
appliquees. C'est le document le plus fiable du lot.

`SECURITY.md` et `PERMISSIONS.md` enoncent des principes valables dans les
deux lignes (pas de cle `service_role` dans le frontend, RLS active,
operations sensibles encapsulees en RPC), mais les mecanismes frontend
qu'ils citent n'existent qu'en v2.

## Pourquoi on les garde

Pour ne pas perdre la reflexion d'architecture, et parce que la decision de
basculer ou non sur cette structure reste ouverte. La branche complete est
sur GitHub : `backup/pre-audit-fixes-v2` (commit `b4df65c`).
