// Tests Deno du verrou serveur du Plan 1.
// Volontairement sur node:assert (et non deno.land/std) pour rester
// executables hors ligne : deno test supabase/functions/_shared/plan1.test.ts
import assert from 'node:assert/strict';
import { ANTI_ABUS, PLAN_1_ID, PLAN_1_MAX_UTILISATEURS, PLAN_1_MODULES, PLAN_1_ROLE_ADMIN } from './plan1.ts';
import { SECTEURS_VALIDES, getTemplate } from './secteurs_templates.ts';

Deno.test('le Plan 1 serveur est verrouille sur starter + organisation/conges', () => {
  assert.equal(PLAN_1_ID, 'starter');
  assert.deepEqual([...PLAN_1_MODULES].sort(), ['conges', 'organisation']);
  assert.equal(PLAN_1_ROLE_ADMIN, 'admin');
  assert.ok(PLAN_1_MAX_UTILISATEURS > 0);
});

Deno.test('aucun module squelette ne figure dans le Plan 1', () => {
  const squelettes = [
    'gps', 'documents', 'vehicules', 'stocks', 'facturation', 'reservations',
    'clients', 'qualite', 'formations', 'securite', 'rapports',
    'planning_avance', 'multi_sites', 'api', 'white_label', 'ia',
  ];
  for (const id of squelettes) {
    assert.ok(!PLAN_1_MODULES.includes(id), `${id} ne doit pas etre dans le Plan 1`);
  }
});

Deno.test('chaque secteur valide expose un template exploitable', () => {
  assert.ok(SECTEURS_VALIDES.length > 0);
  for (const secteur of SECTEURS_VALIDES) {
    const template = getTemplate(secteur);
    assert.ok(template, `template manquant pour ${secteur}`);
    assert.ok(template!.departements.length > 0, `aucun departement pour ${secteur}`);
    assert.ok(template!.postes.length > 0, `aucun poste pour ${secteur}`);
    // Tout poste doit pointer vers un departement du meme template,
    // sinon la RPC creerait des postes sans departement.
    const codes = new Set(template!.departements.map((d) => d.code));
    for (const poste of template!.postes) {
      assert.ok(codes.has(poste.dept), `${secteur}: poste ${poste.slug} reference le departement inconnu ${poste.dept}`);
    }
  }
});

Deno.test('les seuils anti-abus sont coherents', () => {
  assert.ok(ANTI_ABUS.maxSuccesParIp24h >= 1);
  assert.ok(ANTI_ABUS.maxTentativesParIp1h >= ANTI_ABUS.maxSuccesParIp24h);
  assert.ok(ANTI_ABUS.maxTentativesParEmail1h >= 1);
});
