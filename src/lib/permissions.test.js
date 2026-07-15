import { canAccessSuperAdmin, getPermissionsForModule, getProfileRole, hasPermission, isAdminLike } from './permissions'

describe('permissions helpers', () => {
  it('normalizes super admin roles', () => {
    expect(getProfileRole({ is_super_admin: true, role: 'admin' })).toBe('super_admin')
    expect(getProfileRole({ role: 'responsable' })).toBe('responsable')
    expect(getProfileRole(null)).toBe('employe')
  })

  it('detects enterprise managers correctly', () => {
    expect(isAdminLike({ role: 'admin' })).toBe(true)
    expect(isAdminLike({ role: 'responsable' })).toBe(true)
    expect(isAdminLike({ role: 'employe' })).toBe(false)
  })

  it('exposes module permissions from the registry', () => {
    const perms = getPermissionsForModule('organisation', { role: 'responsable' })
    expect(hasPermission(perms, 'voir')).toBe(true)
    expect(hasPermission(perms, 'administrer')).toBe(false)
    expect(canAccessSuperAdmin({ is_super_admin: true })).toBe(true)
  })
})
