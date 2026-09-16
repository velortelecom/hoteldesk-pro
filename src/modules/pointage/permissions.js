export const ROLE_POINTAGE_PERMISSIONS = {
  employe: {
    canView: true,
    canCreate: true,
    canEdit: false,
    canDelete: false,
    canManageSettings: false,
  },
  responsable: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageSettings: true,
  },
  admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
  },
  super_admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
  },
}

export function getPermissionsForRole(role = 'employe') {
  return ROLE_POINTAGE_PERMISSIONS[role] || ROLE_POINTAGE_PERMISSIONS.employe
}

export function canAccessPointage(role, permission = 'canView') {
  const permissions = getPermissionsForRole(role)
  return permissions?.[permission] === true
}
