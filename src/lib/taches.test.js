import fs from 'fs'
import path from 'path'
import {
  CATEGORIES_TACHE, PRIORITES_TACHE, STATUTS_TACHE,
  CATEGORIE_TACHE_DEFAUT, PRIORITE_TACHE_DEFAUT, STATUT_TACHE_DEFAUT,
  construireEcheance, occupeCreneau, finAvantDebut,
} from './taches'

// On relit la contrainte dans le schema plutot que de la recopier : c'est
// la divergence entre les deux qui a casse la creation de tache depuis le
// planning.
function valeursAutorisees(colonne) {
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase_schema.sql'), 'utf8')
  const tableTaches = schema.slice(schema.indexOf('create table taches'))
  const bloc = tableTaches.slice(0, tableTaches.indexOf(');'))
  const ligne = bloc.split('\n').find(l => l.trim().startsWith(colonne + ' '))
  if (!ligne) return null
  const liste = ligne.match(/check \(\w+ in \(([^)]+)\)\)/)
  if (!liste) return null
  return liste[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''))
}

describe('valeurs acceptees par la table taches', () => {
  test('le schema est bien lisible (garde-fou du garde-fou)', () => {
    expect(valeursAutorisees('categorie')).not.toBeNull()
    expect(valeursAutorisees('priorite')).not.toBeNull()
    expect(valeursAutorisees('statut')).not.toBeNull()
  })

  test('les categories correspondent a la contrainte CHECK', () => {
    expect([...CATEGORIES_TACHE].sort()).toEqual([...valeursAutorisees('categorie')].sort())
  })

  test('les priorites correspondent a la contrainte CHECK', () => {
    expect([...PRIORITES_TACHE].sort()).toEqual([...valeursAutorisees('priorite')].sort())
  })

  test('les statuts correspondent a la contrainte CHECK', () => {
    expect([...STATUTS_TACHE].sort()).toEqual([...valeursAutorisees('statut')].sort())
  })

  test('les valeurs par defaut sont acceptees', () => {
    expect(CATEGORIES_TACHE).toContain(CATEGORIE_TACHE_DEFAUT)
    expect(PRIORITES_TACHE).toContain(PRIORITE_TACHE_DEFAUT)
    expect(STATUTS_TACHE).toContain(STATUT_TACHE_DEFAUT)
  })
})

describe('construireEcheance', () => {
  // Ces assertions ne dependent pas du fuseau de la machine de test : on
  // verifie qu'en relisant LOCALEMENT l'instant produit, on retrouve la
  // date et l'heure saisies. C'est exactement la propriete qui manquait.
  test('minuit local par defaut, pas minuit UTC', () => {
    const iso = construireEcheance('2026-09-17')
    const relu = new Date(iso)
    expect(relu.getFullYear()).toBe(2026)
    expect(relu.getMonth()).toBe(8)
    expect(relu.getDate()).toBe(17)
    expect(relu.getHours()).toBe(0)
  })

  test('une heure saisie se relit a la meme heure', () => {
    const relu = new Date(construireEcheance('2026-09-17', '14:30'))
    expect(relu.getDate()).toBe(17)
    expect(relu.getHours()).toBe(14)
    expect(relu.getMinutes()).toBe(30)
  })

  test('accepte une heure avec les secondes', () => {
    const relu = new Date(construireEcheance('2026-09-17', '08:05:00'))
    expect(relu.getHours()).toBe(8)
    expect(relu.getMinutes()).toBe(5)
  })

  test('heure absente ou illisible : minuit local', () => {
    expect(new Date(construireEcheance('2026-09-17', '')).getHours()).toBe(0)
    expect(new Date(construireEcheance('2026-09-17', 'midi')).getHours()).toBe(0)
  })

  test('sans date : null, pas une date invalide', () => {
    expect(construireEcheance(null)).toBeNull()
    expect(construireEcheance('')).toBeNull()
    expect(construireEcheance('pas une date')).toBeNull()
  })
})

describe('occupeCreneau', () => {
  test('sans heure de fin : uniquement le creneau de debut', () => {
    expect(occupeCreneau('14:00', null, 14)).toBe('debut')
    expect(occupeCreneau('14:00', null, 15)).toBeNull()
  })

  test('de 14h a 16h : occupe 14 et 15, pas 16', () => {
    expect(occupeCreneau('14:00', '16:00', 13)).toBeNull()
    expect(occupeCreneau('14:00', '16:00', 14)).toBe('debut')
    expect(occupeCreneau('14:00', '16:00', 15)).toBe('suite')
    expect(occupeCreneau('14:00', '16:00', 16)).toBeNull()
  })

  test('une fin a 16h30 occupe bien la ligne de 16h', () => {
    expect(occupeCreneau('14:00', '16:30', 16)).toBe('suite')
    expect(occupeCreneau('14:00', '16:30', 17)).toBeNull()
  })

  test('un debut a 14h30 occupe la ligne de 14h', () => {
    expect(occupeCreneau('14:30', '15:30', 14)).toBe('debut')
    expect(occupeCreneau('14:30', '15:30', 15)).toBe('suite')
  })

  test('fin incoherente : on retombe sur un seul creneau', () => {
    expect(occupeCreneau('15:00', '12:00', 15)).toBe('debut')
    expect(occupeCreneau('15:00', '12:00', 12)).toBeNull()
    expect(occupeCreneau('15:00', '15:00', 15)).toBe('debut')
  })

  test('entrees illisibles : null, pas une exception', () => {
    expect(occupeCreneau(null, '16:00', 14)).toBeNull()
    expect(occupeCreneau('midi', '16:00', 14)).toBeNull()
    expect(occupeCreneau('14:00', '16:00', null)).toBeNull()
  })
})

describe('finAvantDebut', () => {
  test('detecte une fin anterieure ou egale', () => {
    expect(finAvantDebut('15:00', '12:00')).toBe(true)
    expect(finAvantDebut('15:00', '15:00')).toBe(true)
    expect(finAvantDebut('15:00', '16:00')).toBe(false)
  })

  test('sans heure de fin, rien a signaler', () => {
    expect(finAvantDebut('15:00', '')).toBe(false)
    expect(finAvantDebut('15:00', null)).toBe(false)
  })
})
