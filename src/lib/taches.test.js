import fs from 'fs'
import path from 'path'
import {
  CATEGORIES_TACHE, PRIORITES_TACHE, STATUTS_TACHE,
  CATEGORIE_TACHE_DEFAUT, PRIORITE_TACHE_DEFAUT, STATUT_TACHE_DEFAUT,
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
