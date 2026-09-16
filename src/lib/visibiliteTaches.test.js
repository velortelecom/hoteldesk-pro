import { tacheVisiblePar, filtrerTachesVisibles } from './visibiliteTaches'

const MOI = 'moi'
const AUTRE = 'quelqu-un-dautre'

const employe = { id: MOI, role: 'employe', codesDepartements: ['menage'] }
const responsable = { id: MOI, role: 'responsable', codesDepartements: ['menage', 'accueil'] }
const admin = { id: MOI, role: 'admin', codesDepartements: [] }
const superAdmin = { id: MOI, role: 'employe', isSuperAdmin: true, codesDepartements: [] }

describe('assignation a une personne', () => {
  const tache = { assigne_a: AUTRE, cree_par: AUTRE, departement: null }

  test('seule la personne visee la voit', () => {
    expect(tacheVisiblePar(tache, employe)).toBe(false)
    expect(tacheVisiblePar({ ...tache, assigne_a: MOI }, employe)).toBe(true)
  })

  test('meme un collegue du bon departement ne la voit pas', () => {
    // Le point precis que l'ancien filtre par categorie ratait.
    expect(tacheVisiblePar({ ...tache, departement: null }, employe)).toBe(false)
  })

  test('le createur la garde sous les yeux', () => {
    expect(tacheVisiblePar({ assigne_a: AUTRE, cree_par: MOI }, employe)).toBe(true)
  })
})

describe('assignation a un departement', () => {
  test('tous les membres du departement la voient', () => {
    const tache = { assigne_a: null, cree_par: AUTRE, departement: 'menage' }
    expect(tacheVisiblePar(tache, employe)).toBe(true)
    expect(tacheVisiblePar(tache, responsable)).toBe(true)
  })

  test('un employe d un autre departement ne la voit pas', () => {
    const tache = { assigne_a: null, cree_par: AUTRE, departement: 'maintenance' }
    expect(tacheVisiblePar(tache, employe)).toBe(false)
  })

  test('assignee a quelqu un ET visant un departement : le departement decide', () => {
    const tache = { assigne_a: AUTRE, cree_par: AUTRE, departement: 'menage' }
    expect(tacheVisiblePar(tache, employe)).toBe(true)
  })
})

describe('tache sans destinataire', () => {
  test('ni personne ni departement : visible par tous', () => {
    expect(tacheVisiblePar({ assigne_a: null, departement: null }, employe)).toBe(true)
  })
})

describe('administrateurs', () => {
  test('l admin voit tout, y compris ce qui vise un autre departement', () => {
    expect(tacheVisiblePar({ assigne_a: AUTRE, departement: 'maintenance' }, admin)).toBe(true)
  })

  test('le Super Admin aussi, quel que soit son role', () => {
    expect(tacheVisiblePar({ assigne_a: AUTRE, departement: 'maintenance' }, superAdmin)).toBe(true)
  })
})

describe('entrees incompletes', () => {
  test('rien ne casse', () => {
    expect(tacheVisiblePar(null, employe)).toBe(false)
    expect(tacheVisiblePar({ assigne_a: null }, null)).toBe(false)
    expect(tacheVisiblePar({ assigne_a: null, departement: 'menage' }, { id: MOI, role: 'employe' })).toBe(false)
  })
})

describe('filtrerTachesVisibles', () => {
  test('ne garde que ce qui me concerne', () => {
    const taches = [
      { id: 1, assigne_a: MOI },
      { id: 2, assigne_a: AUTRE },
      { id: 3, assigne_a: null, departement: 'menage' },
      { id: 4, assigne_a: null, departement: 'maintenance' },
      { id: 5, assigne_a: null, departement: null },
    ]
    expect(filtrerTachesVisibles(taches, employe).map(t => t.id)).toEqual([1, 3, 5])
  })

  test('liste absente : tableau vide', () => {
    expect(filtrerTachesVisibles(null, employe)).toEqual([])
  })
})
