import fs from 'fs'
import path from 'path'
import { MODULES_DEVELOPPES } from './modulesDeveloppes'

// Le registre est lu comme du TEXTE, pas importe : on veut savoir quelle
// forme d'import chaque module utilise, information qui disparait une fois
// le module evalue.
function modulesReelsDuRegistre() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'modules', 'registry.js'), 'utf8')
  const reels = []

  // Chaque entree ressemble a :   id: 'conges', ... composant: lazy(...)
  const blocs = source.split(/\n\s*\{\s*\n/)
  blocs.forEach((bloc) => {
    const id = bloc.match(/id:\s*'([a-z_]+)'/)
    const composant = bloc.match(/composant:\s*lazy\(([\s\S]*?)\),\n/)
    if (!id || !composant) return
    if (composant[1].indexOf('createModuleSquelette') === -1) reels.push(id[1])
  })

  return reels
}

describe('modules developpes', () => {
  test('la liste correspond aux modules qui ont un vrai composant', () => {
    expect(modulesReelsDuRegistre().sort()).toEqual([...MODULES_DEVELOPPES].sort())
  })

  test('le registre est bien lisible (garde-fou du garde-fou)', () => {
    // Si un jour le format du registre change, le test precedent passerait
    // a vide sans rien signaler. Celui-ci l'empeche.
    expect(modulesReelsDuRegistre().length).toBeGreaterThan(0)
  })
})
