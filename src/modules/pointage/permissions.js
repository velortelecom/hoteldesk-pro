// src/modules/pointage/permissions.js
// =====================================================================
// canExport : qui peut sortir le classeur des heures.
//
// Un salarie voit SES heures, il n'exporte pas celles de toute
// l'entreprise -- ce serait lui donner le detail des horaires de ses
// collegues. C'est le meme decoupage que partout ailleurs : consulter
// ce qui vous concerne, ce n'est pas lire le dossier des autres.
// =====================================================================
export const ROLE_POINTAGE_PERMISSIONS = {
  employe: {
    canView: true,
    canCreate: true,
    canEdit: false,
    canDelete: false,
    canManageSettings: false,
    canExport: false,
  },
  responsable: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageSettings: true,
    canExport: true,
  },
  admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
    canExport: true,
  },
  super_admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
    canExport: true,
  },
}

export function getPermissionsForRole(role = 'employe') {
  return ROLE_POINTAGE_PERMISSIONS[role] || ROLE_POINTAGE_PERMISSIONS.employe
}

export function canAccessPointage(role, permission = 'canView') {
  const permissions = getPermissionsForRole(role)
  return permissions?.[permission] === true
}
