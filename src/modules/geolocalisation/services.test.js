// src/modules/geolocalisation/services.test.js
// =====================================================================
// LA REGLE QUI PRIME : un releve qui echoue ne doit JAMAIS empecher
// l'action metier. Un module de suivi qui empeche de travailler se fait
// desactiver dans la semaine -- et on perd tout, pas seulement la
// position manquante.
// =====================================================================
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: () => {}, from: () => {} } }))

const {
  ACTIONS_RELEVE, RESULTATS,
  enregistrerReleve, estInscrit, etatActuelParProfil, inscrire,
  refusNormal, resultatDepuisErreur,
} = require('./services')

const POSITION_OK = {
  getCurrentPosition: (ok) => ok({ coords: { latitude: 43.7, longitude: 7.26, accuracy: 9 }, timestamp: 1 }),
}
const POSITION_REFUSEE = { getCurrentPosition: (_ok, ko) => ko({ code: 1 }) }

function rpcQuiReussit(id = 'releve-1') {
  const appels = []
  return { appels, fn: (nom, params) => { appels.push({ nom, params }); return Promise.resolve({ data: id, error: null }) } }
}
function rpcQuiEchoue(message) {
  return () => Promise.resolve({ data: null, error: { message } })
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('un releve reussi', () => {
  test('envoie bien la position et l action', async () => {
    const r = rpcQuiReussit()
    const res = await enregistrerReleve(ACTIONS_RELEVE.TACHE_TERMINEE, {
      api: POSITION_OK, rpc: r.fn, actionId: 'tache-7', userAgent: 'iPhone',
    })

    expect(res.resultat).toBe(RESULTATS.ENREGISTRE)
    expect(r.appels[0].nom).toBe('enregistrer_releve_position')
    expect(r.appels[0].params.p_action_type).toBe('tache_terminee')
    expect(r.appels[0].params.p_action_id).toBe('tache-7')
    expect(r.appels[0].params.p_latitude).toBe(43.7)
    expect(r.appels[0].params.p_precision_metres).toBe(9)
  })

  test('l appareil reste grossier', async () => {
    const r = rpcQuiReussit()
    await enregistrerReleve(ACTIONS_RELEVE.CONNEXION, { api: POSITION_OK, rpc: r.fn, userAgent: 'Mozilla/5.0 (iPhone)' })
    expect(r.appels[0].params.p_appareil).toBe('iOS')
  })
})

describe('rien ne remonte jamais en exception', () => {
  test.each([
    ['position refusee', { api: POSITION_REFUSEE, rpc: rpcQuiReussit().fn }],
    ['base en erreur', { api: POSITION_OK, rpc: rpcQuiEchoue('boom') }],
    ['rpc qui explose', { api: POSITION_OK, rpc: () => { throw new Error('reseau') } }],
    ['rpc qui rejette', { api: POSITION_OK, rpc: () => Promise.reject(new Error('coupure')) }],
  ])('%s : la promesse se resout quand meme', async (_nom, options) => {
    await expect(enregistrerReleve(ACTIONS_RELEVE.PHOTO, options)).resolves.toBeDefined()
  })

  test('une position impossible n empeche pas l action', async () => {
    const res = await enregistrerReleve(ACTIONS_RELEVE.PHOTO, { api: POSITION_REFUSEE, rpc: rpcQuiReussit().fn })
    expect(res.resultat).toBe(RESULTATS.POSITION_INDISPONIBLE)
    expect(res.definitif).toBe(true)
    expect(res.message).toMatch(/reglages/i)
  })
})

describe('les refus attendus ne sont pas des erreurs', () => {
  test('« pas inscrite » est reconnu et silencieux', async () => {
    const res = await enregistrerReleve(ACTIONS_RELEVE.CONNEXION, {
      api: POSITION_OK,
      rpc: rpcQuiEchoue('Cette personne n\'est pas inscrite au suivi de position.'),
    })
    expect(res.resultat).toBe(RESULTATS.NON_INSCRIT)
    expect(refusNormal(res.resultat)).toBe(true)
    // Pas de console.error : sinon la console d'un salarie non inscrit
    // se remplit de rouge a chaque action, et on n'y voit plus les
    // vrais problemes.
    expect(console.error).not.toHaveBeenCalled()
    expect(console.info).toHaveBeenCalled()
  })

  test('« hors temps de travail » aussi', async () => {
    const res = await enregistrerReleve(ACTIONS_RELEVE.CONNEXION, {
      api: POSITION_OK,
      rpc: rpcQuiEchoue('Hors temps de travail : aucun releve. Hors de la plage 06:00-22:00.'),
    })
    expect(res.resultat).toBe(RESULTATS.HORS_TEMPS_TRAVAIL)
    expect(refusNormal(res.resultat)).toBe(true)
    expect(console.error).not.toHaveBeenCalled()
  })

  test('un message inconnu est traite en VRAIE erreur', async () => {
    // En cas de doute on signale. Classer en « refus normal » ce qu'on
    // n'a pas reconnu ferait disparaitre des pannes reelles.
    const res = await enregistrerReleve(ACTIONS_RELEVE.CONNEXION, {
      api: POSITION_OK, rpc: rpcQuiEchoue('colonne machin inexistante'),
    })
    expect(res.resultat).toBe(RESULTATS.ERREUR)
    expect(refusNormal(res.resultat)).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  test.each([
    ['Cette personne n\'est pas inscrite au suivi de position.', RESULTATS.NON_INSCRIT],
    ['Hors temps de travail : aucun releve.', RESULTATS.HORS_TEMPS_TRAVAIL],
    ['Position absente.', RESULTATS.POSITION_INDISPONIBLE],
    ['n importe quoi', RESULTATS.ERREUR],
    ['', RESULTATS.ERREUR],
  ])('« %s » -> %s', (message, attendu) => {
    expect(resultatDepuisErreur({ message })).toBe(attendu)
  })
})

describe('le bandeau de transparence', () => {
  test('dit vrai quand la personne est inscrite', async () => {
    const r = await estInscrit({ id: 'p1' }, { rpc: () => Promise.resolve({ data: true, error: null }) })
    expect(r).toBe(true)
  })

  test('en cas d echec de lecture, on ne dit PAS « vous etes suivi »', async () => {
    // Annoncer un suivi a quelqu'un qui n'en fait pas l'objet est un
    // mensonge de plus mauvais aloi que l'inverse.
    const r = await estInscrit({ id: 'p1' }, { rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }) })
    expect(r).toBe(false)
  })

  test('sans profil, rien', async () => {
    expect(await estInscrit(null)).toBe(false)
    expect(await estInscrit({})).toBe(false)
  })
})

describe('etat actuel deduit de l historique', () => {
  test('la decision la plus recente fait foi', () => {
    const etats = etatActuelParProfil([
      { profile_id: 'p1', inscrit: false, suivre_pointage: null, decide_le: '2026-09-19T12:00:00Z' },
      { profile_id: 'p1', inscrit: true, suivre_pointage: true, decide_le: '2026-09-18T12:00:00Z' },
    ])
    expect(etats).toHaveLength(1)
    expect(etats[0].inscrit).toBe(false)
  })

  test('un mode fixe plus tot est repris si la derniere decision ne le dit pas', () => {
    // Retirer puis reinscrire quelqu'un sans repreciser le mode ne doit
    // pas perdre le mode qu'on lui avait choisi.
    const etats = etatActuelParProfil([
      { profile_id: 'p1', inscrit: true, suivre_pointage: null, decide_le: '2026-09-19T12:00:00Z' },
      { profile_id: 'p1', inscrit: true, suivre_pointage: false, decide_le: '2026-09-18T12:00:00Z' },
    ])
    expect(etats[0].suivrePointage).toBe(false)
  })

  test('un mode jamais choisi reste null, et l ecran pourra le dire', () => {
    const etats = etatActuelParProfil([
      { profile_id: 'p1', inscrit: true, suivre_pointage: null, decide_le: '2026-09-19T12:00:00Z' },
    ])
    expect(etats[0].suivrePointage).toBeNull()
  })

  test('une liste vide ou abimee ne casse rien', () => {
    expect(etatActuelParProfil()).toEqual([])
    expect(etatActuelParProfil([null, {}, { profile_id: null }])).toEqual([])
  })
})

describe('inscrire quelqu un', () => {
  test('un refus de la base remonte son message, sans lever', async () => {
    const r = await inscrire('p1', true, { rpc: rpcQuiEchoue('Reserve a l\'administrateur.') })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/administrateur/i)
  })

  test('« rien n a change » se distingue de « enregistre »', async () => {
    // Sinon l'ecran annonce un enregistrement qui n'a rien enregistre.
    const r = await inscrire('p1', true, { rpc: () => Promise.resolve({ data: null, error: null }) })
    expect(r.ok).toBe(true)
    expect(r.sansChangement).toBe(true)
  })

  test('le mode est transmis tel quel, y compris false', async () => {
    // `false` doit passer : un `|| null` mal place le transformerait en
    // « pas de choix », et la case decochee ne servirait a rien.
    const r = rpcQuiReussit('insc-1')
    await inscrire('p1', true, { rpc: r.fn, suivrePointage: false, motif: 'Commercial' })
    expect(r.appels[0].params.p_suivre_pointage).toBe(false)
    expect(r.appels[0].params.p_motif).toBe('Commercial')
  })
})
