import { DEFAULT_PERMISSIONS, getPermissions } from '../modules/registry'

export function getProfileRole(profile) {
  if (profile?.is_super_admin) return 'super_admin'
  return profile?.role || 'employe'
}

export function isSuperAdmin(profile) {
  return profile?.is_super_admin === true
}

export function isAdminLike(profile) {
  return isSuperAdmin(profile) || ['admin', 'responsable', 'chef_equipe'].includes(profile?.role)
}

export function hasPermission(permissionSet = DEFAULT_PERMISSIONS, permission) {
  return permissionSet?.[permission] === true
}

export function getPermissionsForModule(moduleId, profile) {
  return getPermissions(moduleId, getProfileRole(profile))
}

export function canAccessSuperAdmin(profile) {
  return isSuperAdmin(profile)
}
