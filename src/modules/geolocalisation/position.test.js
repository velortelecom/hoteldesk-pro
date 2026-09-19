// src/modules/geolocalisation/position.test.js
// =====================================================================
// C'est la brique qui decide si on enregistre une position ou rien.
// Une erreur ici enregistre une position fausse -- qui aura l'air
// parfaitement valide.
// =====================================================================
const {
  ECHECS, appareilCourt, echecDefinitif, messageEchec, motifDepuisErreur, relever,
} = require('./position')

/** Un faux navigator.geolocation, pilotable. */
function apiQuiReussit(coords, timestamp = 1700000000000) {
  return {
    getCurrentPosition: (ok) => ok({ coords, timestamp }),
  }
}
function apiQuiEchoue(code) {
  return {
    getCurrentPosition: (_ok, ko) => ko({ code }),
  }
}
function apiMuette() {
  return { getCurrentPosition: () => {} }
}

describe('un relevement reussi', () => {
  test('rend les coordonnees et la precision', async () => {
    const r = await relever({ api: apiQuiReussit({ latitude: 43.697, longitude: 7.2706, accuracy: 12 }) })
    expect(r.ok).toBe(true)
    expect(r.latitude).toBe(43.697)
    expect(r.longitude).toBe(7.2706)
    expect(r.precisionMetres).toBe(12)
  })

  test('une precision absente ne devient pas zero', async () => {
    // 0 metre de precision se lirait « position parfaite ». C'est
    // l'inverse : on ne sait pas.
    const r = await relever({ api: apiQuiReussit({ latitude: 1, longitude: 2 }) })
    expect(r.precisionMetres).toBeNull()
  })

  test('l heure de l appareil est gardee a titre indicatif', async () => {
    // Elle ne fait pas foi : l'horodatage qui compte est pose par le
    // serveur. Changer l'heure d'un telephone prend dix secondes.
    const r = await relever({ api: apiQuiReussit({ latitude: 1, longitude: 2 }, 42) })
    expect(r.horodatageAppareil).toBe(42)
  })
})

describe('un « succes » sans coordonnees exploitables', () => {
  test.each([
    ['latitude absente', { longitude: 7 }],
    ['longitude absente', { latitude: 43 }],
    ['valeurs non numeriques', { latitude: 'nord', longitude: 'est' }],
    ['NaN', { latitude: NaN, longitude: NaN }],
  ])('%s : on refuse plutot que d enregistrer n importe quoi', async (_nom, coords) => {
    const r = await relever({ api: apiQuiReussit(coords) })
    expect(r.ok).toBe(false)
    expect(r.motif).toBe(ECHECS.INDISPONIBLE)
  })
})

describe('refus et absence de signal ne se soignent pas pareil', () => {
  test('une permission refusee est DEFINITIVE', async () => {
    // Le navigateur ne redemandera plus rien. Proposer « reessayer »
    // serait une promesse qu'on ne peut pas tenir.
    const r = await relever({ api: apiQuiEchoue(1) })
    expect(r.motif).toBe(ECHECS.REFUSE)
    expect(r.definitif).toBe(true)
    expect(r.message).toMatch(/reglages/i)
  })

  test('une absence de signal se reessaie', async () => {
    const r = await relever({ api: apiQuiEchoue(2) })
    expect(r.motif).toBe(ECHECS.INDISPONIBLE)
    expect(r.definitif).toBe(false)
    expect(r.message).toMatch(/ressortez|reessayez/i)
  })

  test('un delai depasse se reessaie aussi', async () => {
    const r = await relever({ api: apiQuiEchoue(3) })
    expect(r.motif).toBe(ECHECS.DELAI_DEPASSE)
    expect(r.definitif).toBe(false)
  })

  test('un appareil sans geolocalisation est definitif', async () => {
    const r = await relever({ api: null })
    expect(r.motif).toBe(ECHECS.NON_SUPPORTE)
    expect(r.definitif).toBe(true)
  })

  test('chaque motif a son propre message', () => {
    const messages = Object.values(ECHECS).map(messageEchec)
    expect(new Set(messages).size).toBe(messages.length)
    messages.forEach(m => expect(m.length).toBeGreaterThan(10))
  })

  test('le classement definitif / reessayable est explicite', () => {
    expect(echecDefinitif(ECHECS.REFUSE)).toBe(true)
    expect(echecDefinitif(ECHECS.NON_SUPPORTE)).toBe(true)
    expect(echecDefinitif(ECHECS.INDISPONIBLE)).toBe(false)
    expect(echecDefinitif(ECHECS.DELAI_DEPASSE)).toBe(false)
  })
})

describe('un navigateur qui ne repond jamais', () => {
  test('la promesse se resout quand meme', async () => {
    // Certains navigateurs n'appellent NI succes NI erreur quand
    // l'onglet passe en arriere-plan. Sans filet, le bouton resterait
    // bloque sur « ... » indefiniment.
    jest.useFakeTimers()
    const promesse = relever({ api: apiMuette(), delaiMs: 100 })
    jest.advanceTimersByTime(3000)
    const r = await promesse
    jest.useRealTimers()
    expect(r.ok).toBe(false)
    expect(r.motif).toBe(ECHECS.DELAI_DEPASSE)
  })
})

describe('options envoyees au navigateur', () => {
  test('aucune position en cache n est acceptee', async () => {
    // Une position mise en cache daterait d'un autre endroit et serait
    // enregistree comme celle d'ici.
    let recues = null
    await relever({ api: { getCurrentPosition: (ok, _ko, opts) => { recues = opts; ok({ coords: { latitude: 1, longitude: 2 } }) } } })
    expect(recues.maximumAge).toBe(0)
    expect(recues.enableHighAccuracy).toBe(true)
  })

  test('une erreur ne fait jamais rejeter la promesse', async () => {
    // Un appelant qui oublie un catch ne doit pas faire tomber l'ecran
    // pour une position manquante.
    await expect(relever({ api: apiQuiEchoue(1) })).resolves.toBeDefined()
    await expect(relever({ api: null })).resolves.toBeDefined()
  })
})

describe('description de l appareil', () => {
  test('reste grossiere, et c est voulu', () => {
    // On veut « iOS » ou « Android » pour retrouver d'ou vient un
    // releve, pas une empreinte qui permettrait de suivre quelqu'un
    // ailleurs.
    expect(appareilCourt('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iOS')
    expect(appareilCourt('Mozilla/5.0 (Linux; Android 14; SM-S911B)')).toBe('Android')
    expect(appareilCourt('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows')
    expect(appareilCourt('')).toBe('Inconnu')
    expect(appareilCourt(null)).toBe('Inconnu')
  })
})

describe('correspondance des codes navigateur', () => {
  test.each([
    [1, ECHECS.REFUSE],
    [2, ECHECS.INDISPONIBLE],
    [3, ECHECS.DELAI_DEPASSE],
    [99, ECHECS.INCONNU],
    [undefined, ECHECS.INCONNU],
  ])('code %s -> %s', (code, attendu) => {
    expect(motifDepuisErreur({ code })).toBe(attendu)
  })

  test('une erreur absente ne casse rien', () => {
    expect(motifDepuisErreur(null)).toBe(ECHECS.INCONNU)
  })
})
