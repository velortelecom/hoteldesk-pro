# Tests

## Commandes exécutées

```bash
npm test -- --watchAll=false --runInBand
npm run build
node scripts/verify-create-user-chef-role.mjs
node scripts/e2e-enterprise-creation-isolation.mjs
```

## Résultat courant

- tests historiques : OK
- nouveaux tests de fondation : routeur, permissions, helpers entreprise
- verification QA edge function : create-user avec role chef_equipe
- smoke E2E: create-entreprise (x2) + verification isolation multi-entreprise

## Fichiers de test clés

- `src/app/router/routeConfig.test.js`
- `src/lib/permissions.test.js`
- `src/services/enterprise.test.js`
- `src/pages/superAdminEnterpriseCreation.test.js`
- `src/pages/superAdminControlUtils.test.js`
- `src/pages/superAdminAudit.test.js`
- `src/pages/rappels.fk.test.js`
- `src/modules/pointage/services.test.js`
