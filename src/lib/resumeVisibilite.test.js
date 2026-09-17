import { resumeVisibiliteTache } from './resumeVisibilite'
import { tacheVisiblePar } from './visibiliteTaches'

const MOI = 'moi'
const PAUL = 'paul'

const EMPLOYES = [
  { id: MOI, prenom: 'Rayan', nom: 'B' },
  { id: PAUL, prenom: 'Paul', nom: 'Durand' },
]
const DEPARTEMENTS = [{ id: 'd1', code: 'bagagerie', nom: 'Bagagerie' }]

const contexte = { employes: EMPLOYES, departements: DEPARTEMENTS, moiId: MOI }

describe('resumeVisibiliteTache', () => {
  test('ni destinataire ni departement : toute l entreprise', () => {
    const r = resumeVisibiliteTache({ departement: '', assigneA: '', ...contexte })
    expect(r.portee).toBe('entreprise')
    expect(r.texte).toMatch(/toute l entreprise/i)
  })

  test('departement seul : tous ses membres, nomme en clair', () => {
    const r = resumeVisibiliteTache({ departement: 'bagagerie', assigneA: '', ...contexte })
    expect(r.portee).toBe('departement')
    expect(r.texte).toContain('Bagagerie')
  })

  test('destinataire : lui seul, avec son nom', () => {
    const r = resumeVisibiliteTache({ departement: '', assigneA: PAUL, ...contexte })
    expect(r.portee).toBe('personne')
    expect(r.texte).toContain('Paul Durand')
  })

  test('moi-meme : on dit "vous", pas mon nom', () => {
    const r = resumeVisibiliteTache({ departement: '', assigneA: MOI, ...contexte })
    expect(r.texte).toMatch(/vous/i)
  })

  test('destinataire ET departement : on previent que le departement ne joue pas', () => {
    // C'est le cas qui trompe : deux champs remplis, un seul compte.
    const r = resumeVisibiliteTache({ departement: 'bagagerie', assigneA: PAUL, ...contexte })
    expect(r.portee).toBe('personne')
    expect(r.texte).toMatch(/ne l elargit pas/i)
  })

  test('departement inconnu : on affiche le code plutot que rien', () => {
    const r = resumeVisibiliteTache({ departement: 'plonge', assigneA: '', ...contexte })
    expect(r.texte).toContain('plonge')
  })

  test('listes absentes : rien ne casse', () => {
    expect(resumeVisibiliteTache({ departement: '', assigneA: '' }).portee).toBe('entreprise')
    expect(resumeVisibiliteTache({ assigneA: PAUL }).texte).toMatch(/la personne choisie/i)
  })
})

describe('la phrase dit la meme chose que la regle appliquee', () => {
  // Un resume qui derive de la regle reelle serait pire que pas de resume :
  // on promettrait une visibilite que la base refuse.
  const collegue = { id: PAUL, role: 'employe', codesDepartements: ['bagagerie'] }
  const etranger = { id: 'autre', role: 'employe', codesDepartements: ['accueil'] }

  test('departement seul : un membre voit, un autre non', () => {
    const tache = { assigne_a: null, cree_par: MOI, departement: 'bagagerie' }
    expect(resumeVisibiliteTache({ departement: 'bagagerie', assigneA: '', ...contexte }).portee).toBe('departement')
    expect(tacheVisiblePar(tache, collegue)).toBe(true)
    expect(tacheVisiblePar(tache, etranger)).toBe(false)
  })

  test('destinataire plus departement : le collegue du departement ne voit pas', () => {
    const tache = { assigne_a: MOI, cree_par: MOI, departement: 'bagagerie' }
    expect(resumeVisibiliteTache({ departement: 'bagagerie', assigneA: MOI, ...contexte }).portee).toBe('personne')
    expect(tacheVisiblePar(tache, collegue)).toBe(false)
  })

  test('ni l un ni l autre : tout le monde voit', () => {
    const tache = { assigne_a: null, cree_par: MOI, departement: null }
    expect(resumeVisibiliteTache({ departement: '', assigneA: '', ...contexte }).portee).toBe('entreprise')
    expect(tacheVisiblePar(tache, collegue)).toBe(true)
    expect(tacheVisiblePar(tache, etranger)).toBe(true)
  })
})
