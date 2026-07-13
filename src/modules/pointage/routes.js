export const POINTAGE_ROUTES = [
  { id: 'dashboard', label: 'Tableau de bord', path: '/pointage' },
  { id: 'pointage', label: 'Pointage', path: '/pointage/pointage' },
  { id: 'historique', label: 'Historique', path: '/pointage/historique' },
  { id: 'sites', label: 'Sites', path: '/pointage/sites' },
  { id: 'parametres', label: 'Paramètres', path: '/pointage/parametres' },
]

export function getRouteById(routeId) {
  return POINTAGE_ROUTES.find((route) => route.id === routeId) || POINTAGE_ROUTES[0]
}
