import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildFallbackEmail, canGrantRole, generateTempPassword, isAllowedRole, isProtectedSuperAdmin } from './user_admin.ts';

Deno.test('generateTempPassword produces a mixed password', () => {
  const password = generateTempPassword(18);
  assertEquals(password.length, 18);
  assertMatch(password, /[A-Z]/);
  assertMatch(password, /[a-z]/);
  assertMatch(password, /[0-9]/);
  assert(password.split('').some((char) => '!@#$%*?'.includes(char)));
});

Deno.test('buildFallbackEmail normalizes accents and enterprise id', () => {
  const email = buildFallbackEmail('Élodie', "D'Anvers", 'bbb3dc0c-b995-4ae0-ac14-4415c04e2262');
  assertEquals(email, 'elodie.d-anvers.bbb3dc0c@velor.local');
});

Deno.test('role helpers enforce Super Admin boundaries', () => {
  assert(isAllowedRole('admin'));
  assert(!isAllowedRole('super_admin'));
  assert(isProtectedSuperAdmin('3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4'));
  assert(!isProtectedSuperAdmin('11111111-1111-1111-1111-111111111111'));
  assertEquals(canGrantRole({ callerIsSuperAdmin: false, callerRole: 'admin', callerEntrepriseId: 'ent-1', targetEntrepriseId: 'ent-1', requestedRole: 'responsable' }), true);
  assertEquals(canGrantRole({ callerIsSuperAdmin: false, callerRole: 'admin', callerEntrepriseId: 'ent-1', targetEntrepriseId: 'ent-1', requestedRole: 'admin' }), false);
  assertEquals(canGrantRole({ callerIsSuperAdmin: true, callerRole: 'admin', callerEntrepriseId: 'ent-1', targetEntrepriseId: 'ent-2', requestedRole: 'admin' }), true);
});
