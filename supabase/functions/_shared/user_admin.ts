export const PROTECTED_SUPER_ADMIN_ID = '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4';
export const ALLOWED_ROLES = ['admin', 'responsable', 'employe'] as const;
export type AllowedRole = typeof ALLOWED_ROLES[number];

export function isAllowedRole(role: string): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole);
}

export function isProtectedSuperAdmin(profileId: string | null | undefined) {
  return profileId === PROTECTED_SUPER_ADMIN_ID;
}

export function normalizeText(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function buildFallbackEmail(prenom: string, nom: string, entrepriseId: string) {
  const localPart = [prenom, nom, entrepriseId.slice(0, 8)]
    .map(normalizeText)
    .filter(Boolean)
    .join('.');

  return `${localPart || 'velor'}@velor.local`;
}

export function generateTempPassword(length = 16) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?';
  const buffer = new Uint32Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) => characters[value % characters.length]).join('');
}

export function canManageTarget({
  callerIsSuperAdmin,
  callerRole,
  callerEntrepriseId,
  targetEntrepriseId,
}: {
  callerIsSuperAdmin: boolean;
  callerRole: string | null;
  callerEntrepriseId: string | null;
  targetEntrepriseId: string | null;
}) {
  if (callerIsSuperAdmin) return true;
  if (!callerRole || !['admin', 'responsable'].includes(callerRole)) return false;
  return callerEntrepriseId !== null && callerEntrepriseId === targetEntrepriseId;
}

export function canGrantRole({
  callerIsSuperAdmin,
  callerRole,
  callerEntrepriseId,
  targetEntrepriseId,
  requestedRole,
}: {
  callerIsSuperAdmin: boolean;
  callerRole: string | null;
  callerEntrepriseId: string | null;
  targetEntrepriseId: string | null;
  requestedRole: AllowedRole;
}) {
  if (!canManageTarget({ callerIsSuperAdmin, callerRole, callerEntrepriseId, targetEntrepriseId })) {
    return false;
  }

  if (callerIsSuperAdmin) return true;
  return requestedRole !== 'admin';
}
