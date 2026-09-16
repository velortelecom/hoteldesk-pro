import { filtrerMenus, pageParDefaut, pageAutorisee, aUneRestriction } from './menus'

const nav = [
  { id: 'dashboard', label: 'Accueil' },
  { id: 'planning', label: 'Planning' },
  { id: 'taches', label: 'Taches' },
  { id: 'organisation', label: 'Organisation & RH' },
  { id: 'conges', label: 'Conges' },
]

describe('filtrerMenus', () => {
  test('sans liste : rien ne change', () => {
    expect(filtrerMenus(nav, null)).toEqual(nav)
    expect(filtrerMenus(nav, [])).toEqual(nav)
    expect(filtrerMenus(nav, undefined)).toEqual(nav)
  })

  test('avec liste : seuls les onglets cites restent', () => {
    const r = filtrerMenus(nav, ['dashboard', 'planning'])
    expect(r.map(m => m.id)).toEqual(['dashboard', 'planning'])
  })

  test('le cas demande : un employe qui n a que le planning', () => {
    const r = filtrerMenus(nav, ['planning'])
    expect(r.map(m => m.id)).toEqual(['planning'])
  })

  test('masquer RH sans toucher au reste', () => {
    const r = filtrerMenus(nav, ['dashboard', 'planning', 'taches', 'conges'])
    expect(r.map(m => m.id)).not.toContain('organisation')
    expect(r).toHaveLength(4)
  })

  test('la liste ne peut pas ACCORDER un onglet absent de la navigation', () => {
    // 'superadmin' n'est pas dans nav : le citer ne le fait pas apparaitre.
    const r = filtrerMenus(nav, ['planning', 'superadmin', 'vehicules'])
    expect(r.map(m => m.id)).toEqual(['planning'])
  })

  test('une liste qui ne correspond a rien rend au moins l accueil', () => {
    const r = filtrerMenus(nav, ['module_supprime'])
    expect(r.map(m => m.id)).toEqual(['dashboard'])
  })

  test('liste sans correspondance et sans accueil disponible : vide, pas une exception', () => {
    expect(filtrerMenus([{ id: 'planning' }], ['inconnu'])).toEqual([])
  })

  test('navigation absente : tableau vide', () => {
    expect(filtrerMenus(null, ['planning'])).toEqual([])
  })
})

describe('pageParDefaut', () => {
  test('l accueil quand il est autorise', () => {
    expect(pageParDefaut(nav, ['dashboard', 'planning'])).toBe('dashboard')
    expect(pageParDefaut(nav, null)).toBe('dashboard')
  })

  test('le premier onglet disponible sinon', () => {
    expect(pageParDefaut(nav, ['taches', 'conges'])).toBe('taches')
  })

  test('un employe qui n a que le planning ouvre sur le planning', () => {
    expect(pageParDefaut(nav, ['planning'])).toBe('planning')
  })
})

describe('pageAutorisee', () => {
  test('sans restriction, tout est permis', () => {
    expect(pageAutorisee('organisation', nav, null)).toBe(true)
  })

  test('une page hors liste est refusee', () => {
    expect(pageAutorisee('organisation', nav, ['planning'])).toBe(false)
    expect(pageAutorisee('planning', nav, ['planning'])).toBe(true)
  })
})

describe('aUneRestriction', () => {
  test('distingue une vraie liste d une absence de liste', () => {
    expect(aUneRestriction(['planning'])).toBe(true)
    expect(aUneRestriction([])).toBe(false)
    expect(aUneRestriction(null)).toBe(false)
  })
})
