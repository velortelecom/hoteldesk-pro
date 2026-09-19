// src/modules/geolocalisation/ecrans.test.js
// =====================================================================
// LES DEUX ECRANS DU MODULE, MONTES POUR DE VRAI.
//
// carte.test.js verifie les fonctions qui preparent les donnees. Ici on
// monte les composants, parce que trois fautes ne se voient nulle part
// ailleurs :
//
//   - un ecran qui affiche une liste vide quand la lecture a ECHOUE ;
//   - la case « suit son pointage » cliquable pour quelqu'un qui n'est
//     pas suivi -- on croit avoir regle quelque chose, on n'a rien
//     regle ;
//   - le super admin propose a l'inscription comme s'il etait un
//     salarie de l'entreprise du client.
//
// Et un salarie qui arriverait sur l'URL du module doit tomber sur un
// mur, pas sur les positions de ses collegues.
// =====================================================================
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

global.IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------
// Le client Supabase, reduit a ce que les deux ecrans en utilisent.
// ---------------------------------------------------------------------
const reponsesProfiles = { data: [], error: null }

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        in: () => Promise.resolve(global.__reponseProfiles),
        order: () => Promise.resolve(global.__reponseProfiles),
      }
      return chaine
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}))

// Les services sont remplaces, SAUF les constantes et le calcul d'etat :
// ce sont eux qu'on veut voir a l'oeuvre dans l'ecran.
jest.mock('./services.js', () => {
  const vrai = jest.requireActual('./services.js')
  return {
    ...vrai,
    getReleves: jest.fn(),
    getInscriptions: jest.fn(),
    getModes: jest.fn(),
    inscrire: jest.fn(),
  }
})

const { ACTIONS_RELEVE, getInscriptions, getModes, getReleves, inscrire } = require('./services.js')
const CarteReleves = require('./components/CarteReleves.jsx').default
const InscriptionsGeo = require('./components/InscriptionsGeo.jsx').default
const Module = require('./index.jsx').default

const ENTREPRISE = 'ent-1'
const ADMIN = { id: 'p-admin', role: 'admin', entreprise_id: ENTREPRISE }

async function rendre(element) {
  const conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  const racine = createRoot(conteneur)
  await act(async () => { racine.render(element) })
  return {
    conteneur,
    get texte() { return conteneur.textContent },
    cases: () => [...conteneur.querySelectorAll('input[type="checkbox"]')],
    boutons: () => [...conteneur.querySelectorAll('button')],
    liens: () => [...conteneur.querySelectorAll('a')],
    cliquer: async (el) => { await act(async () => { el.click() }) },
    demonter: () => act(() => racine.unmount()),
  }
}

function releve(sur = {}) {
  return {
    id: 'r' + Math.random(),
    profile_id: 'p-tech',
    action_type: ACTIONS_RELEVE.TACHE_TERMINEE,
    latitude: 43.7,
    longitude: 7.26,
    precision_metres: 12,
    distance_site_metres: 30,
    dans_le_rayon: true,
    releve_le: new Date(2026, 8, 19, 9, 30).toISOString(),
    ...sur,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  // Par defaut : aucun mode connu. Chaque test qui s'y interesse le dit.
  getModes.mockResolvedValue([])
  global.__reponseProfiles = { ...reponsesProfiles }
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { console.error.mockRestore && console.error.mockRestore() })

// =====================================================================
// L'ECRAN DES RELEVES
// =====================================================================
describe('l ecran des releves', () => {
  test('une lecture qui echoue ne ressemble PAS a « aucun releve »', async () => {
    // C'est la faute la plus couteuse de tout le module : le
    // responsable conclurait que le technicien n'a rien fait alors que
    // c'est la base qui n'a pas repondu.
    getReleves.mockRejectedValue(new Error('permission denied for table releves_position'))

    const vue = await rendre(<CarteReleves profile={ADMIN} />)
    expect(vue.texte).toContain("n'ont pas pu être lus")
    expect(vue.texte).toContain('permission denied')
    expect(vue.texte).not.toContain('Aucun relevé sur la période')
    vue.demonter()
  })

  test('aucun releve le dit, et dit pourquoi c est peut-etre normal', async () => {
    getReleves.mockResolvedValue([])

    const vue = await rendre(<CarteReleves profile={ADMIN} />)
    expect(vue.texte).toContain('Aucun relevé sur la période')
    expect(vue.texte).toContain("personne n'est inscrit")
    vue.demonter()
  })

  test('les releves sont groupes, nommes, et le detail est replie', async () => {
    getReleves.mockResolvedValue([
      releve(),
      releve({ releve_le: new Date(2026, 8, 19, 14, 0).toISOString(), dans_le_rayon: false, distance_site_metres: 4200 }),
      releve({ releve_le: new Date(2026, 8, 19, 8, 0).toISOString(), action_type: ACTIONS_RELEVE.CONNEXION, dans_le_rayon: null, distance_site_metres: null }),
    ])
    global.__reponseProfiles = { data: [{ id: 'p-tech', prenom: 'Paul', nom: 'Marin' }], error: null }

    const vue = await rendre(<CarteReleves profile={ADMIN} />)

    expect(vue.texte).toContain('Paul Marin')
    expect(vue.texte).toContain('19/09/2026')
    expect(vue.texte).toContain('2 actes de travail')
    expect(vue.texte).toContain('1 connexion')
    // « hors zone » ne compte que le false : la connexion sans site
    // comparable (null) ne doit accuser personne.
    expect(vue.texte).toContain('1 hors zone')

    // Replie : aucune coordonnee ni lien avant le clic.
    expect(vue.liens()).toHaveLength(0)
    expect(vue.texte).not.toContain('43.70000')

    const entete = vue.boutons().find((b) => b.textContent.includes('19/09/2026'))
    await vue.cliquer(entete)

    expect(vue.texte).toContain('43.70000, 7.26000')
    const liens = vue.liens()
    expect(liens.length).toBeGreaterThan(0)
    expect(liens[0].getAttribute('href')).toMatch(/^https:\/\/www\.openstreetmap\.org\//)
    // Un lien vers un tiers s'ouvre sans lui donner la page d'origine.
    expect(liens[0].getAttribute('rel')).toContain('noopener')
    vue.demonter()
  })

  test('le filtre « actes de travail seulement » retire les connexions', async () => {
    getReleves.mockResolvedValue([
      releve(),
      releve({ releve_le: new Date(2026, 8, 19, 8, 0).toISOString(), action_type: ACTIONS_RELEVE.CONNEXION }),
    ])
    global.__reponseProfiles = { data: [{ id: 'p-tech', prenom: 'Paul', nom: 'Marin' }], error: null }

    const vue = await rendre(<CarteReleves profile={ADMIN} />)
    expect(vue.texte).toContain('1 connexion')

    const filtre = vue.cases()[0]
    await vue.cliquer(filtre)

    expect(vue.texte).not.toContain('1 connexion')
    expect(vue.texte).toContain('1 acte de travail')
    vue.demonter()
  })

  test('changer de periode relit, avec la bonne periode', async () => {
    getReleves.mockResolvedValue([])
    const vue = await rendre(<CarteReleves profile={ADMIN} />)

    expect(getReleves.mock.calls[0][1]).toEqual({ depuisJours: 7 })

    const bouton30 = vue.boutons().find((b) => b.textContent === '30 jours')
    await vue.cliquer(bouton30)

    expect(getReleves.mock.calls[1][1]).toEqual({ depuisJours: 30 })
    vue.demonter()
  })
})

// =====================================================================
// L'ECRAN D'INSCRIPTION
// =====================================================================
describe('l ecran des personnes suivies', () => {
  const EQUIPE = [
    { id: 'p-tech', prenom: 'Paul', nom: 'Marin', role: 'employe', actif: true, is_super_admin: false },
    { id: 'p-rh', prenom: 'Rose', nom: 'Aubert', role: 'responsable', actif: true, is_super_admin: false },
    { id: 'p-nous', prenom: 'Velor', nom: 'Telecom', role: 'employe', actif: true, is_super_admin: true },
  ]

  function inscription(profileId, sur = {}) {
    return {
      id: 'i-' + profileId,
      profile_id: profileId,
      inscrit: true,
      suivre_pointage: null,
      motif: null,
      decide_le: new Date(2026, 8, 19, 10, 0).toISOString(),
      decide_par: ADMIN.id,
      ...sur,
    }
  }

  test('le super admin n est PAS propose a l inscription', async () => {
    // Il n'est pas salarie de l'entreprise du client : le geolocaliser
    // n'a aucun sens, et le proposer laisse croire que c'est possible.
    global.__reponseProfiles = { data: EQUIPE, error: null }
    getInscriptions.mockResolvedValue([])

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    expect(vue.texte).toContain('Paul Marin')
    expect(vue.texte).toContain('Rose Aubert')
    expect(vue.texte).not.toContain('Velor Telecom')
    vue.demonter()
  })

  test('« suit son pointage » est bloquee tant que la personne n est pas suivie', async () => {
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([])

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    const [suivi, mode] = vue.cases()

    expect(suivi.checked).toBe(false)
    expect(mode.disabled).toBe(true)
    vue.demonter()
  })

  test('la case montre le mode QUI S APPLIQUERA, pas la valeur stockee', async () => {
    // Le bug du 19/09 : la case s'affichait decochee avec « reglage de
    // l'entreprise » pour quelqu'un dont le mode effectif etait « suit
    // son pointage ». L'ecran disait le contraire de ce qui allait se
    // passer, et cocher ne changeait rien -- la base comparait elle
    // aussi a l'effectif et repondait « rien n'a change ».
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([inscription('p-tech')])
    getModes.mockResolvedValue([
      { profileId: 'p-tech', inscrit: true, suivrePointage: true, origine: 'defaut', choixExplicite: false },
    ])

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    const [suivi, mode] = vue.cases()

    expect(suivi.checked).toBe(true)
    expect(mode.disabled).toBe(false)
    // Cochee, parce que c'est ce qui s'applique.
    expect(mode.checked).toBe(true)
    expect(vue.texte).toContain('son arrivée et son départ')
    // Et on dit d'ou ca vient : la case seule ne peut pas l'exprimer.
    expect(vue.texte).toContain('par défaut')
    expect(vue.texte).toContain('19/09/2026')
    vue.demonter()
  })

  test('un mode herite de l entreprise le dit', async () => {
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([inscription('p-tech')])
    getModes.mockResolvedValue([
      { profileId: 'p-tech', inscrit: true, suivrePointage: false, origine: 'entreprise', choixExplicite: false },
    ])

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    expect(vue.cases()[1].checked).toBe(false)
    expect(vue.texte).toContain('plage horaire')
    expect(vue.texte).toContain('réglage de l’entreprise')
    vue.demonter()
  })

  test('un choix pose pour la personne le dit aussi', async () => {
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([inscription('p-tech', { suivre_pointage: true })])
    getModes.mockResolvedValue([
      { profileId: 'p-tech', inscrit: true, suivrePointage: true, origine: 'personne', choixExplicite: true },
    ])

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    expect(vue.texte).toContain('choisi pour cette personne')
    vue.demonter()
  })

  test('decocher le mode envoie false, pas null', async () => {
    // `??` et non `||` dans le composant : « plage horaire » est un
    // choix, pas une absence de choix. Un `||` renverrait null et la
    // case redeviendrait « réglage de l’entreprise » a chaque clic.
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([inscription('p-tech', { suivre_pointage: true })])
    getModes.mockResolvedValue([
      { profileId: 'p-tech', inscrit: true, suivrePointage: true, origine: 'personne', choixExplicite: true },
    ])
    inscrire.mockResolvedValue({ ok: true, id: 'nouvelle', sansChangement: false })

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    const mode = vue.cases()[1]
    expect(mode.checked).toBe(true)
    expect(vue.texte).toContain('son arrivée et son départ')

    await vue.cliquer(mode)

    expect(inscrire).toHaveBeenCalledWith('p-tech', true, expect.objectContaining({ suivrePointage: false }))
    vue.demonter()
  })

  test('inscrire quelqu un garde le fait qu il l est deja, et un motif', async () => {
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([])
    inscrire.mockResolvedValue({ ok: true, id: 'nouvelle', sansChangement: false })

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    await vue.cliquer(vue.cases()[0])

    expect(inscrire).toHaveBeenCalledWith('p-tech', true, expect.objectContaining({
      motif: expect.stringContaining('Inscrit'),
    }))
    expect(vue.texte).toContain('modification enregistrée')
    vue.demonter()
  })

  test('« rien n a change » ne s annonce pas comme un enregistrement', async () => {
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([])
    inscrire.mockResolvedValue({ ok: true, id: null, sansChangement: true })

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    await vue.cliquer(vue.cases()[0])

    expect(vue.texte).toContain('Rien n’a changé')
    expect(vue.texte).not.toContain('modification enregistrée')
    vue.demonter()
  })

  test('un refus de la base est MONTRE, pas avale', async () => {
    global.__reponseProfiles = { data: [EQUIPE[0]], error: null }
    getInscriptions.mockResolvedValue([])
    inscrire.mockResolvedValue({ ok: false, message: 'Droits insuffisants pour inscrire au suivi.' })

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    await vue.cliquer(vue.cases()[0])

    expect(vue.texte).toContain('Droits insuffisants')
    vue.demonter()
  })

  test('une liste illisible le dit au lieu de montrer une entreprise vide', async () => {
    global.__reponseProfiles = { data: null, error: { message: 'permission denied for table profiles' } }
    getInscriptions.mockResolvedValue([])

    const vue = await rendre(<InscriptionsGeo profile={ADMIN} />)
    expect(vue.texte).toContain("n'a pas pu être lue")
    expect(vue.texte).not.toContain('Aucun salarié')
    vue.demonter()
  })
})

// =====================================================================
// LE MUR
// =====================================================================
describe('un salarie qui arrive sur le module', () => {
  test('tombe sur un mur, pas sur les positions de ses collegues', async () => {
    getReleves.mockResolvedValue([releve()])

    const vue = await rendre(<Module profile={{ id: 'p-tech', role: 'employe', entreprise_id: ENTREPRISE }} />)

    expect(vue.texte).toContain('Accès non autorisé')
    expect(vue.texte).not.toContain('43.70000')
    // Le composant de la carte n'est meme pas monte : rien n'est lu.
    expect(getReleves).not.toHaveBeenCalled()
    vue.demonter()
  })

  test('le responsable voit les releves et AUCUNE barre d onglets', async () => {
    // Un seul onglet autorise : afficher une barre a un onglet
    // suggererait qu'il en existe d'autres, caches.
    getReleves.mockResolvedValue([])

    const vue = await rendre(<Module profile={{ id: 'p-rh', role: 'responsable', entreprise_id: ENTREPRISE }} />)

    expect(vue.texte).toContain('Où le travail a été fait')
    expect(vue.texte).not.toContain('Personnes suivies')
    expect(getReleves).toHaveBeenCalled()
    vue.demonter()
  })

  test('l admin peut passer d un onglet a l autre', async () => {
    getReleves.mockResolvedValue([])
    getInscriptions.mockResolvedValue([])
    global.__reponseProfiles = { data: [], error: null }

    const vue = await rendre(<Module profile={ADMIN} />)
    expect(vue.texte).toContain('Où le travail a été fait')

    const onglet = vue.boutons().find((b) => b.textContent.includes('Personnes suivies'))
    await vue.cliquer(onglet)

    expect(vue.texte).toContain('On inscrit des personnes')
    expect(getInscriptions).toHaveBeenCalled()
    vue.demonter()
  })
})
