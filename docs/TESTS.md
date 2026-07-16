# Tests

## Commandes exécutées

```bash
npm test -- --watchAll=false --runInBand
npm run build
npm run qa:functions-health
npm run qa:db-health
npm run qa:backend-health
node scripts/verify-create-user-chef-role.mjs
node scripts/e2e-enterprise-creation-isolation.mjs
npm run qa:full
npm run validate:mission
npm run validate:mission:ci
```

## Résultat courant

- tests historiques : OK
- nouveaux tests de fondation : routeur, permissions, helpers entreprise
- verification QA edge function : create-user avec role chef_equipe
- smoke E2E: create-entreprise (x2) + verification isolation multi-entreprise
- healthcheck runtime edge functions: create-entreprise/create-user/create-pointage
- healthcheck invariants DB: contrainte roles profiles, module pointage, RPC atomique entreprise
- healthcheck backend agrégé: qa:functions-health + qa:db-health
- pre-check environnement: les scripts QA signalent explicitement les variables manquantes
- hygiene secrets: les sorties QA masquent les mots de passe temporaires par defaut

## Fichiers de test clés

- `src/app/router/routeConfig.test.js`
- `src/lib/permissions.test.js`
- `src/services/enterprise.test.js`
- `src/pages/superAdminEnterpriseCreation.test.js`
- `src/pages/superAdminControlUtils.test.js`
- `src/pages/superAdminAudit.test.js`
- `src/pages/rappels.fk.test.js`
- `src/modules/pointage/services.test.js`
