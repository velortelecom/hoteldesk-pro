import { MODULE_ROUTES, SOCLE_MENUS } from '../../lib/modules'

const EXTRA_ROUTES = {
  superadmin: '/superadmin',
  conges: '/conges',
  personnel: '/equipe',
  equipe: '/equipe',
  messages: '/messages',
  messagerie: '/messages',
}

function normalizePathname(pathname = '/') {
  if (!pathname || pathname === '/') return '/'
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

export function getPagePath(pageId, loadedModules = []) {
  const socle = SOCLE_MENUS.find((item) => item.id === pageId)
  if (socle) return socle.path
  if (EXTRA_ROUTES[pageId]) return EXTRA_ROUTES[pageId]

  const moduleEntry = loadedModules.find((item) => item.id === pageId)
  if (moduleEntry?.route) return moduleEntry.route

  return MODULE_ROUTES[pageId] || '/'
}

export function getPageIdFromPath(pathname = '/', loadedModules = []) {
  const normalizedPath = normalizePathname(pathname)
  if (normalizedPath === '/') return 'dashboard'

  const socle = SOCLE_MENUS.find((item) => normalizePathname(item.path) === normalizedPath)
  if (socle) return socle.id

  const extra = Object.entries(EXTRA_ROUTES).find(([, route]) => normalizePathname(route) === normalizedPath)
  if (extra) return extra[0]

  const moduleEntry = loadedModules.find((item) => normalizePathname(item.route) === normalizedPath)
  if (moduleEntry) return moduleEntry.id

  return null
}

export function buildRouteEntries(loadedModules = []) {
  return loadedModules
    .filter((item) => item.route && item.id !== 'conges')
    .map((item) => ({
      id: item.id,
      path: item.route,
      routePath: item.route.replace(/^\//, ''),
      composant: item.composant,
      permissions: item.permissions,
      nom: item.nom,
    }))
}
