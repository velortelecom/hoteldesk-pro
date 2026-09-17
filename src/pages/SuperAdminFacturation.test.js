// src/pages/SuperAdminFacturation.test.js
// =====================================================================
// LE BOUTON LUI-MEME, TESTE.
//
// Les calculs sont verifies ailleurs (facturationExport.test.js) et le
// SQL sur une vraie base. Restait le cablage : un bouton qui appelle la
// bonne fonction avec la bonne periode, qui demande confirmation avant
// de figer, et qui dit la verite quand il n'y a rien a figer.
//
// C'est exactement le genre de chose qu'on croit evidente et qui casse
// en silence -- comme le « if (error) return » qui avait fait
// disparaitre le bandeau tarif fondateur sans un mot.
//
// supabase est remplace par un double : aucun appel reseau, et on peut
// verifier CE QUI a ete demande a la base.
// =====================================================================
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

// React 18 refuse de considerer act() comme legitime sans ce drapeau, et
// noie alors la sortie d'avertissements qui masquent les vraies erreurs.
global.IS_REACT_ACT_ENVIRONMENT = true

// Les mockAppels enregistres par le double.
const mockAppels = { rpc: [], from: [], eq: [], order: [] }
let mockReponseGlobal = { data: [], error: null }
let mockReponseReleves = { data: [], error: null }
let mockReponseFigeage = { data: 0, error: null }
let mockReponseProfils = { data: [], error: null }
let mockReponseHistorique = { data: [], error: null }

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (nom, params) => {
      mockAppels.rpc.push({ nom, params })
      if (nom === 'etat_facturation_global') return Promise.resolve(mockReponseGlobal)
      if (nom === 'figer_releves_facturation') return Promise.resolve(mockReponseFigeage)
      return Promise.resolve({ data: null, error: { message: 'rpc inconnue : ' + nom } })
    },
    from: (table) => {
      mockAppels.from.push(table)
      const chaine = {
        select: () => chaine,
        eq: (col, val) => { mockAppels.eq.push({ table, col, val }); return chaine },
        // La reponse depend de la colonne de tri : l'ecran lit
        // releves_facturation pour la periode (tri fige_le) et pour
        // l'historique d'une entreprise (tri periode).
        order: (col) => {
          mockAppels.order.push({ table, col })
          if (table === 'profiles_with_email') return Promise.resolve(mockReponseProfils)
          if (col === 'periode') return Promise.resolve(mockReponseHistorique)
          return Promise.resolve(mockReponseReleves)
        },
      }
      return chaine
    },
  },
}))

const SuperAdminFacturation = require('./SuperAdminFacturation').default

const LIGNE_FONDATEUR = {
  entreprise_id: 'a', nom: 'Fondateur', plan: 'starter', actif: true,
  utilisateurs: 12, inclus: 10, surplus: 2,
  prix_base: 29, prix_utilisateur_sup: 2, supplement: 4, prix_total: 33,
  sur_devis: false, fige: false,
}

const LIGNE_DEVIS = {
  entreprise_id: 'c', nom: 'Gros', plan: 'starter', actif: true,
  utilisateurs: 31, inclus: 10, surplus: 21,
  prix_base: 39, prix_utilisateur_sup: 2, supplement: 0, prix_total: null,
  sur_devis: true, fige: false,
}

let conteneur = null
let racine = null

async function afficher() {
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  await act(async () => { racine.render(<SuperAdminFacturation />) })
  return conteneur
}

function boutons() {
  return Array.from(conteneur.querySelectorAll('button'))
}

function boutonContenant(texte) {
  return boutons().find(b => (b.textContent || '').indexOf(texte) !== -1) || null
}

async function cliquer(bouton) {
  await act(async () => {
    bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  mockAppels.rpc = []
  mockAppels.from = []
  mockAppels.eq = []
  mockAppels.order = []
  mockReponseGlobal = { data: [], error: null }
  mockReponseReleves = { data: [], error: null }
  mockReponseFigeage = { data: 0, error: null }
  mockReponseProfils = { data: [], error: null }
  mockReponseHistorique = { data: [], error: null }
})

afterEach(() => {
  if (racine) act(() => racine.unmount())
  if (conteneur && conteneur.parentNode) conteneur.parentNode.removeChild(conteneur)
  racine = null
  conteneur = null
})

describe('lecture de l ecran', () => {
  test('les montants sont demandes a la base pour le mois en cours', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    await afficher()

    const appel = mockAppels.rpc.find(a => a.nom === 'etat_facturation_global')
    expect(appel).toBeTruthy()
    // Le 1er du mois, jamais la date du jour : la base refuse le reste.
    expect(appel.params.p_periode).toMatch(/^\d{4}-\d{2}-01$/)
    expect(mockAppels.from).toContain('releves_facturation')
  })

  test('le debordement d une entreprise est affiche avec son supplement', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    const c = await afficher()
    const texte = c.textContent

    expect(texte).toContain('Fondateur')
    expect(texte).toContain('+2')          // deux utilisateurs au-dela
    expect(texte).toContain('4,00')        // le supplement
    expect(texte).toContain('33,00')       // 29 + 4, le total reel
  })

  test('une entreprise sur devis n affiche pas de montant', async () => {
    mockReponseGlobal = { data: [LIGNE_DEVIS], error: null }
    const c = await afficher()

    expect(c.textContent).toContain('Sur devis')
    // 21 x 2 = 42 ne doit apparaitre nulle part : ce n'est pas ce qu'on
    // facture, et l'afficher laisserait croire le contraire.
    expect(c.textContent).not.toContain('42,00')
  })

  test('une lecture en echec affiche l erreur et PAS une liste vide', async () => {
    // Le piege qu'on a deja paye : une erreur avalee, un ecran qui
    // annonce « aucune entreprise » alors qu'il n'a rien lu.
    const erreurs = []
    const origine = console.error
    console.error = (m) => erreurs.push(String(m))

    mockReponseGlobal = { data: null, error: { code: '42883', message: 'function etat_facturation_global does not exist' } }
    const c = await afficher()

    console.error = origine
    expect(c.textContent).toContain('does not exist')
    expect(c.textContent).not.toContain('Aucune entreprise')
    // et l'erreur est ecrite en console avec son code, pas juste avalee
    expect(erreurs.join(' ')).toContain('42883')
  })
})

describe('le bouton Figer', () => {
  test('il annonce combien d entreprises il va figer', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR, LIGNE_DEVIS], error: null }
    await afficher()

    const b = boutonContenant('Figer')
    expect(b).toBeTruthy()
    expect(b.textContent).toContain('(2)')
    expect(b.disabled).toBe(false)
  })

  test('il ne compte ni les entreprises deja figees ni les inactives', async () => {
    mockReponseGlobal = {
      data: [
        LIGNE_FONDATEUR,
        { ...LIGNE_DEVIS, fige: true },
        { ...LIGNE_FONDATEUR, entreprise_id: 'z', nom: 'Fermee', actif: false },
      ],
      error: null,
    }
    await afficher()
    expect(boutonContenant('Figer').textContent).toContain('(1)')
  })

  test('quand tout est fige, le bouton est desactive et le dit', async () => {
    mockReponseGlobal = { data: [{ ...LIGNE_FONDATEUR, fige: true }], error: null }
    await afficher()

    const b = boutonContenant('Periode figee')
    expect(b).toBeTruthy()
    expect(b.disabled).toBe(true)
  })

  test('il ne fige RIEN sans passer par la confirmation', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    const c = await afficher()

    await cliquer(boutonContenant('Figer '))

    // La confirmation est la, et la base n'a pas encore ete touchee.
    expect(c.textContent).toContain('Figer la periode')
    expect(mockAppels.rpc.some(a => a.nom === 'figer_releves_facturation')).toBe(false)
    expect(boutonContenant('Figer la periode')).toBeTruthy()
  })

  test('la confirmation annonce le total qui sera fige', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    const c = await afficher()
    await cliquer(boutonContenant('Figer '))

    expect(c.textContent).toContain('33,00')
    expect(c.textContent).toContain('ne seront pas touchees')
  })

  test('annuler ferme la confirmation sans rien figer', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    await afficher()
    await cliquer(boutonContenant('Figer '))
    await cliquer(boutonContenant('Annuler'))

    expect(boutonContenant('Figer la periode')).toBeNull()
    expect(mockAppels.rpc.some(a => a.nom === 'figer_releves_facturation')).toBe(false)
  })

  test('confirmer appelle la base avec la periode affichee', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    mockReponseFigeage = { data: 1, error: null }
    const c = await afficher()

    await cliquer(boutonContenant('Figer '))
    await cliquer(boutonContenant('Figer la periode'))

    const appel = mockAppels.rpc.find(a => a.nom === 'figer_releves_facturation')
    expect(appel).toBeTruthy()
    expect(appel.params.p_periode).toMatch(/^\d{4}-\d{2}-01$/)
    expect(c.textContent).toContain('1 releve fige')
    // L'ecran se relit apres le figeage, sinon la colonne « periode »
    // resterait a « ouverte » et on cliquerait deux fois.
    expect(mockAppels.rpc.filter(a => a.nom === 'etat_facturation_global').length).toBeGreaterThan(1)
  })

  test('zero releve cree ne se presente pas comme un echec', async () => {
    // La fonction est idempotente : relancer sur une periode deja figee
    // renvoie 0. Ce n'est pas une erreur, et surtout il faut dire que
    // les montants existants n'ont pas bouge.
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    mockReponseFigeage = { data: 0, error: null }
    const c = await afficher()

    await cliquer(boutonContenant('Figer '))
    await cliquer(boutonContenant('Figer la periode'))

    expect(c.textContent).toContain('deja fige')
    expect(c.textContent).toContain("n'ont pas ete touches")
  })

  test('un figeage refuse est annonce, pas avale', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    mockReponseFigeage = { data: null, error: { code: 'P0001', message: 'ACCES_REFUSE' } }
    const origine = console.error
    console.error = () => {}
    const c = await afficher()

    await cliquer(boutonContenant('Figer '))
    await cliquer(boutonContenant('Figer la periode'))
    console.error = origine

    expect(c.textContent).toContain('Le figeage a echoue')
    expect(c.textContent).toContain('ACCES_REFUSE')
  })
})

describe('le bouton Exporter', () => {
  test('il est desactive tant que la periode n est pas figee', async () => {
    mockReponseGlobal = { data: [LIGNE_FONDATEUR], error: null }
    mockReponseReleves = { data: [], error: null }
    const c = await afficher()

    const b = boutonContenant('Exporter')
    expect(b).toBeTruthy()
    expect(b.disabled).toBe(true)
    expect(c.textContent).toContain("Rien n'est facturable tant qu'elle ne l'est pas")
  })

  test('il s active des qu il y a un releve, et produit un vrai fichier', async () => {
    mockReponseGlobal = { data: [{ ...LIGNE_FONDATEUR, fige: true }], error: null }
    mockReponseReleves = {
      data: [{
        entreprise_id: 'a', entreprises: { nom: 'Fondateur' }, periode: '2026-09-01',
        plan: 'starter', utilisateurs: 12, inclus: 10, surplus: 2,
        prix_base: 29, supplement: 4, prix_total: 33, sur_devis: false,
        fige_le: '2026-09-17T10:00:00Z',
      }],
      error: null,
    }
    await afficher()

    const b = boutonContenant('Exporter')
    expect(b.disabled).toBe(false)

    // jsdom n'implemente ni createObjectURL ni le telechargement : on les
    // remplace pour verifier qu'un fichier .xlsx est bien produit et que
    // le nom porte le mois.
    const blobs = []
    let nomTelecharge = null
    URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:fake' }
    URL.revokeObjectURL = () => {}
    const creerElement = document.createElement.bind(document)
    document.createElement = (balise) => {
      const el = creerElement(balise)
      if (balise === 'a') el.click = () => { nomTelecharge = el.download }
      return el
    }

    await cliquer(b)

    document.createElement = creerElement

    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toContain('spreadsheetml.sheet')
    expect(nomTelecharge).toMatch(/^facturation-velor-one-\d{4}-\d{2}\.xlsx$/)
  })
})

describe('le detail d une entreprise', () => {
  const PROFILS = [
    { id: '1', prenom: 'Ana', nom: 'Bert', role: 'admin', actif: true, is_super_admin: false },
    { id: '2', prenom: 'Bob', nom: 'Cart', role: 'employe', actif: true, is_super_admin: false },
    { id: '3', prenom: 'Parti', nom: 'Dupond', role: 'employe', actif: false, is_super_admin: false },
    { id: '4', prenom: 'Rayan', nom: 'Velor', role: 'admin', actif: true, is_super_admin: true },
  ]

  const HISTORIQUE = [
    { periode: '2026-09-01', plan: 'starter', utilisateurs: 12, inclus: 10, surplus: 2, prix_base: 29, supplement: 4, prix_total: 33, sur_devis: false, fige_le: '2026-09-17T10:00:00Z' },
    { periode: '2026-08-01', plan: 'starter', utilisateurs: 10, inclus: 10, surplus: 0, prix_base: 29, supplement: 0, prix_total: 29, sur_devis: false, fige_le: '2026-08-01T08:00:00Z' },
  ]

  async function ouvrir(ligne = LIGNE_FONDATEUR) {
    mockReponseGlobal = { data: [ligne], error: null }
    const c = await afficher()
    // On clique le nom de l'entreprise dans le tableau.
    const cellule = Array.from(c.querySelectorAll('td'))
      .find(t => (t.textContent || '').indexOf(ligne.nom) !== -1)
    await act(async () => {
      cellule.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    return c
  }

  test('le detail est demande pour la bonne entreprise', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    await ouvrir()

    expect(mockAppels.from).toContain('profiles_with_email')
    // Les deux lectures sont filtrees sur l'entreprise cliquee, jamais
    // sur toutes : sinon on afficherait les comptes d'une autre boite.
    const filtres = mockAppels.eq.filter(e => e.col === 'entreprise_id')
    expect(filtres.length).toBeGreaterThanOrEqual(2)
    filtres.forEach(f => expect(f.val).toBe(LIGNE_FONDATEUR.entreprise_id))
  })

  test('la facture est detaillee ligne par ligne', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    const c = await ouvrir()
    const t = c.textContent

    expect(t).toContain('Forfait Velor One')
    expect(t).toContain('jusqu')                 // « jusqu'a 10 utilisateurs »
    expect(t).toContain('2 utilisateurs au-dela du forfait')
    expect(t).toContain('2,00')                  // le prix unitaire
    expect(t).toContain('29,00')                 // le forfait
    expect(t).toContain('4,00')                  // le debordement
    expect(t).toContain('Total du ce mois-ci')
    expect(t).toContain('33,00')                 // 29 + 4
  })

  test('les comptes factures sont listes, et les exclus avec leur raison', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    const c = await ouvrir()
    const t = c.textContent

    expect(t).toContain('Ana Bert')
    expect(t).toContain('Bob Cart')
    // Le desactive et le super admin apparaissent, mais du cote non
    // facture : c'est ce qui permet de repondre a « et Untel ? ».
    expect(t).toContain('NON FACTURES (2)')
    expect(t).toContain('compte desactive')
    expect(t).toContain('compte de supervision Velor')
  })

  test('un ecart entre la liste et le chiffre facture est signale', async () => {
    // La base dit 12, la liste en montre 2 : on le dit au lieu de le
    // cacher. C'est le chiffre de la base qui part sur la facture.
    mockReponseProfils = { data: PROFILS, error: null }
    const c = await ouvrir()
    expect(c.textContent).toContain('A verifier avant d')
  })

  test('aucun ecart signale quand la liste et la base concordent', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    // 2 comptes actifs hors super admin -> une entreprise facturee 2.
    const c = await ouvrir({ ...LIGNE_FONDATEUR, utilisateurs: 2, surplus: 0, supplement: 0, prix_total: 29 })
    expect(c.textContent).not.toContain('A verifier avant d')
  })

  test('une lecture des comptes refusee est affichee, pas avalee', async () => {
    const origine = console.error
    console.error = () => {}
    mockReponseProfils = { data: null, error: { code: '42501', message: 'permission denied for view profiles_with_email' } }
    const c = await ouvrir()
    console.error = origine

    expect(c.textContent).toContain('permission denied')
    expect(c.textContent).not.toContain('NON FACTURES')
  })

  test('l historique fige est affiche avec son total', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    mockReponseHistorique = { data: HISTORIQUE, error: null }
    const c = await ouvrir()

    expect(c.textContent).toContain('HISTORIQUE FIGE')
    expect(c.textContent).toContain('septembre 2026')
    expect(c.textContent).toContain('aout 2026')
    expect(c.textContent).toContain('62,00')   // 33 + 29
  })

  test('sans historique, l export de l entreprise est desactive', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    mockReponseHistorique = { data: [], error: null }
    const c = await ouvrir()

    expect(c.textContent).toContain('Aucune periode figee pour cette entreprise')
    const exports = Array.from(c.querySelectorAll('button'))
      .filter(b => (b.textContent || '').indexOf('Exporter vers Excel') !== -1)
    // Deux boutons portent ce libelle (la periode et l'entreprise) :
    // celui du panneau est le dernier rendu.
    expect(exports[exports.length - 1].disabled).toBe(true)
  })

  test('l export de l entreprise produit un fichier a son nom', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    mockReponseHistorique = { data: HISTORIQUE, error: null }
    const c = await ouvrir({ ...LIGNE_FONDATEUR, nom: 'Hotel Bellevue & Spa' })

    const blobs = []
    let nomTelecharge = null
    URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:fake' }
    URL.revokeObjectURL = () => {}
    const creerElement = document.createElement.bind(document)
    document.createElement = (balise) => {
      const el = creerElement(balise)
      if (balise === 'a') el.click = () => { nomTelecharge = el.download }
      return el
    }

    const exports = Array.from(c.querySelectorAll('button'))
      .filter(b => (b.textContent || '').indexOf('Exporter vers Excel') !== -1)
    await cliquer(exports[exports.length - 1])

    document.createElement = creerElement

    expect(blobs).toHaveLength(1)
    expect(nomTelecharge).toBe('facturation-hotel-bellevue-spa.xlsx')
  })

  test('le panneau se ferme', async () => {
    mockReponseProfils = { data: PROFILS, error: null }
    const c = await ouvrir()
    const fermer = Array.from(c.querySelectorAll('button')).find(b => b.textContent === '×')
    await cliquer(fermer)
    expect(c.textContent).not.toContain('CE QU')
  })
})
