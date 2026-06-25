// ============================================================
// MODULE ORGANISATION — permissions.js
// Gestion des permissions granulaires
// ============================================================

import { PERMS } from './config.js';

export function hasPermission(userRole, permission) {
  const rolePermissions = PERMISSIONS_BY_ROLE[userRole] || [];
  return rolePermissions.includes(permission);
}

export const PERMISSIONS_BY_ROLE = {
  super_admin: Object.values(PERMS),

  admin: [
    PERMS.VIEW_EMPLOYES,
    PERMS.CREATE_EMPLOYE,
    PERMS.EDIT_EMPLOYE,
    PERMS.DELETE_EMPLOYE,
    PERMS.MANAGE_DEPTS,
    PERMS.MANAGE_POSTES,
    PERMS.VIEW_NOTES,
  ],

  responsable: [
    PERMS.VIEW_EMPLOYES,
    PERMS.CREATE_EMPLOYE,
    PERMS.EDIT_EMPLOYE,
    PERMS.MANAGE_DEPTS,
    PERMS.MANAGE_POSTES,
  ],

  employe: [
    PERMS.VIEW_EMPLOYES,
  ],
};

export function getPermissionsForRole(role) {
  return {
    canView: hasPermission(role, PERMS.VIEW_EMPLOYES),
    canCreate: hasPermission(role, PERMS.CREATE_EMPLOYE),
    canEdit: hasPermission(role, PERMS.EDIT_EMPLOYE),
    canDelete: hasPermission(role, PERMS.DELETE_EMPLOYE),
    canManageDepts: hasPermission(role, PERMS.MANAGE_DEPTS),
    canManagePostes: hasPermission(role, PERMS.MANAGE_POSTES),
    canViewNotes: hasPermission(role, PERMS.VIEW_NOTES),
  };
}
