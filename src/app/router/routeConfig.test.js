import { buildRouteEntries, getPageIdFromPath, getPagePath } from './routeConfig'

describe('routeConfig', () => {
  const loadedModules = [
    { id: 'organisation', route: '/organisation', composant: {} },
    { id: 'pointage', route: '/pointage', composant: {} },
    { id: 'conges', route: '/conges', composant: {} },
  ]

  it('maps canonical core routes to page ids', () => {
    expect(getPageIdFromPath('/')).toBe('dashboard')
    expect(getPageIdFromPath('/messages')).toBe('messagerie')
    expect(getPageIdFromPath('/equipe')).toBe('personnel')
  })

  it('resolves module routes dynamically', () => {
    expect(getPageIdFromPath('/organisation', loadedModules)).toBe('organisation')
    expect(getPagePath('pointage', loadedModules)).toBe('/pointage')
  })

  it('builds route entries and excludes conges special-case route', () => {
    const entries = buildRouteEntries(loadedModules)
    expect(entries.map((entry) => entry.id)).toEqual(['organisation', 'pointage'])
    expect(entries[0].routePath).toBe('organisation')
  })
})
