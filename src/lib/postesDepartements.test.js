import {
  grouperPostesParDepartement,
  departementsApresChoixPoste,
  posteHorsDepartements,
  SANS_DEPARTEMENT,
} from './postesDepartements'

const ACCUEIL = { id: 'd1', nom: 'Accueil' }
const ETAGES = { id: 'd2', nom: 'Etages' }
const VIDE = { id: 'd3', nom: 'Direction' }
const DEPARTEMENTS = [ACCUEIL, ETAGES, VIDE]

const RECEPTIONNISTE = { id: 'p1', nom: 'Receptionniste', departement_id: 'd1' }
const GOUVERNANTE = { id: 'p2', nom: 'Gouvernante', departement_id: 'd2' }
const ORPHELIN = { id: 'p3', nom: 'Extra', departement_id: null }
const POSTES = [RECEPTIONNISTE, GOUVERNANTE, ORPHELIN]

describe('grouperPostesParDepartement', () => {
  test('range chaque poste sous son equipe', () => {
    const groupes = grouperPostesParDepartement(POSTES, DEPARTEMENTS)
    expect(groupes.map(g => g.nom)).toEqual(['Accueil', 'Etages', 'Sans departement'])
    expect(groupes[0].postes.map(p => p.nom)).toEqual(['Receptionniste'])
    expect(groupes[1].postes.map(p => p.nom)).toEqual(['Gouvernante'])
  })

  test('un departement sans poste n apparait pas', () => {
    // Un titre de groupe vide dans un menu deroulant n'aide personne.
    const groupes = grouperPostesParDepartement(POSTES, DEPARTEMENTS)
    expect(groupes.find(g => g.nom === 'Direction')).toBeUndefined()
  })

  test('les postes sans departement finissent dans un groupe a part', () => {
    const groupes = grouperPostesParDepartement(POSTES, DEPARTEMENTS)
    const dernier = groupes[groupes.length - 1]
    expect(dernier.id).toBe(SANS_DEPARTEMENT)
    expect(dernier.postes.map(p => p.nom)).toEqual(['Extra'])
  })

  test('aucun poste perdu en route', () => {
    const groupes = grouperPostesParDepartement(POSTES, DEPARTEMENTS)
    const total = groupes.reduce((n, g) => n + g.postes.length, 0)
    expect(total).toBe(POSTES.length)
  })

  test('entrees absentes : rien ne casse', () => {
    expect(grouperPostesParDepartement(null, null)).toEqual([])
    expect(grouperPostesParDepartement(POSTES, [])).toHaveLength(1)
  })
})

describe('departementsApresChoixPoste', () => {
  test('choisir un poste coche son departement', () => {
    expect(departementsApresChoixPoste([], 'p2', POSTES)).toEqual(['d2'])
  })

  test('ajoute sans effacer ce qui etait deja coche', () => {
    // Quelqu'un peut travailler sur deux equipes : changer de poste ne
    // doit pas supprimer un rattachement pose a la main.
    expect(departementsApresChoixPoste(['d1'], 'p2', POSTES)).toEqual(['d1', 'd2'])
  })

  test('ne double pas un departement deja present', () => {
    const avant = ['d2']
    const apres = departementsApresChoixPoste(avant, 'p2', POSTES)
    expect(apres).toEqual(['d2'])
    expect(apres).toBe(avant)
  })

  test('poste sans departement ou choix vide : selection inchangee', () => {
    expect(departementsApresChoixPoste(['d1'], 'p3', POSTES)).toEqual(['d1'])
    expect(departementsApresChoixPoste(['d1'], '', POSTES)).toEqual(['d1'])
  })
})

describe('posteHorsDepartements', () => {
  test('signale la gouvernante rattachee a l Accueil', () => {
    expect(posteHorsDepartements('p2', ['d1'], POSTES)).toBe('d2')
  })

  test('rien a signaler quand c est coherent', () => {
    expect(posteHorsDepartements('p2', ['d1', 'd2'], POSTES)).toBeNull()
  })

  test('aucun departement coche : on ne reproche rien', () => {
    // La fiche n'est peut-etre pas finie de remplir.
    expect(posteHorsDepartements('p2', [], POSTES)).toBeNull()
  })
})
