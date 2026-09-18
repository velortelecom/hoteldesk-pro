// src/modules/pointage/journees.test.js
// =====================================================================
// C'est le fichier qui decide ce qu'un salarie sera paye. Chaque cas
// tordu ci-dessous vient d'une situation reelle : un depart oublie, une
// equipe de nuit, une pause jamais refermee, un pointage refuse.
//
// La regle testee partout : quand on ne sait pas, on ne devine pas.
// =====================================================================
const {
  ACTIONS, ANOMALIES, STATUTS_COMPTES, DUREE_INVRAISEMBLABLE_MINUTES,
  cleJour, construireJournees, formaterDuree, journeesAvecAnomalie, totalMinutes,
} = require('./journees')

const ALICE = 'profil-alice'
const BOB = 'profil-bob'

/** Raccourci : un evenement a une heure donnee du 10 mars 2026. */
function ev(profileId, action, heure, options = {}) {
  const [h, m] = heure.split(':').map(Number)
  const jour = options.jour == null ? 10 : options.jour
  return {
    id: profileId + '-' + action + '-' + jour + '-' + heure,
    profile_id: profileId,
    site_id: options.siteId || 'site-1',
    action,
    statut: options.statut || 'accepte',
    horodatage_evenement: new Date(2026, 2, jour, h, m, 0),
  }
}

describe('une journee ordinaire', () => {
  const journees = construireJournees([
    ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
    ev(ALICE, ACTIONS.DEBUT_PAUSE, '12:00'),
    ev(ALICE, ACTIONS.FIN_PAUSE, '13:00'),
    ev(ALICE, ACTIONS.DEPART, '17:00'),
  ])

  test('produit une seule journee', () => {
    expect(journees).toHaveLength(1)
  })

  test('le temps travaille est mesure, pas suppose', () => {
    // 8h -> 17h = 9h, moins 1h de pause = 8h. Si ce test tombe parce que
    // quelqu'un a remis un forfait de 8h quelque part, c'est tout le
    // module qui ne prouve plus rien.
    expect(journees[0].minutesTravaillees).toBe(8 * 60)
    expect(journees[0].minutesPause).toBe(60)
  })

  test('elle est complete et sans anomalie', () => {
    expect(journees[0].complete).toBe(true)
    expect(journees[0].anomalies).toEqual([])
  })

  test('elle porte sa date, son site et ses evenements', () => {
    expect(journees[0].date).toBe('2026-03-10')
    expect(journees[0].siteId).toBe('site-1')
    expect(journees[0].evenements).toHaveLength(4)
  })
})

describe('l ordre des evenements ne depend pas de l ordre de lecture', () => {
  test('une liste melangee donne le meme resultat', () => {
    const melange = construireJournees([
      ev(ALICE, ACTIONS.DEPART, '17:00'),
      ev(ALICE, ACTIONS.FIN_PAUSE, '13:00'),
      ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
      ev(ALICE, ACTIONS.DEBUT_PAUSE, '12:00'),
    ])
    expect(melange).toHaveLength(1)
    expect(melange[0].minutesTravaillees).toBe(8 * 60)
  })
})

describe('le depart oublie', () => {
  const journees = construireJournees([
    ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
  ])

  test('le temps vaut null, jamais zero ni une estimation', () => {
    // Zero se lirait « n'a pas travaille ». Une estimation serait une
    // invention. « Jusqu'a maintenant » grossirait a chaque
    // rafraichissement de l'ecran.
    expect(journees[0].minutesTravaillees).toBeNull()
  })

  test('elle est signalee comme incomplete', () => {
    expect(journees[0].complete).toBe(false)
    expect(journees[0].anomalies).toContain(ANOMALIES.DEPART_MANQUANT)
  })
})

describe('deux arrivees sans depart', () => {
  const journees = construireJournees([
    ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
    ev(ALICE, ACTIONS.ARRIVEE, '14:00'),
    ev(ALICE, ACTIONS.DEPART, '18:00'),
  ])

  test('la premiere journee n est pas ecrasee', () => {
    // Ecraser reviendrait a effacer une demi-journee de presence.
    expect(journees).toHaveLength(2)
    expect(journees[0].anomalies).toContain(ANOMALIES.DOUBLE_ARRIVEE)
  })

  test('la seconde est mesuree normalement', () => {
    expect(journees[1].minutesTravaillees).toBe(4 * 60)
    expect(journees[1].complete).toBe(true)
  })
})

describe('le depart sans arrivee', () => {
  const journees = construireJournees([
    ev(ALICE, ACTIONS.DEPART, '17:00'),
  ])

  test('la journee existe quand meme, pour etre corrigeable', () => {
    // La jeter ferait disparaitre une preuve de presence.
    expect(journees).toHaveLength(1)
    expect(journees[0].anomalies).toContain(ANOMALIES.ARRIVEE_MANQUANTE)
    expect(journees[0].minutesTravaillees).toBeNull()
  })
})

describe('l equipe de nuit', () => {
  const journees = construireJournees([
    ev(BOB, ACTIONS.ARRIVEE, '22:00', { jour: 10 }),
    ev(BOB, ACTIONS.DEPART, '06:00', { jour: 11 }),
  ])

  test('une nuit est UNE journee, pas deux', () => {
    expect(journees).toHaveLength(1)
    expect(journees[0].minutesTravaillees).toBe(8 * 60)
  })

  test('elle est rattachee au jour de l arrivee', () => {
    // Rattacher au calendrier couperait la nuit en deux journees fausses,
    // et un salarie de nuit ne serait jamais paye correctement.
    expect(journees[0].date).toBe('2026-03-10')
    expect(journees[0].complete).toBe(true)
  })
})

describe('la pause', () => {
  test('une pause non refermee est signalee', () => {
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
      ev(ALICE, ACTIONS.DEBUT_PAUSE, '12:00'),
      ev(ALICE, ACTIONS.DEPART, '17:00'),
    ])
    expect(journees[0].anomalies).toContain(ANOMALIES.PAUSE_NON_FERMEE)
    expect(journees[0].complete).toBe(false)
  })

  test('une pause non refermee ne retire pas de temps au hasard', () => {
    // On ne sait pas quand elle s'est terminee : on ne soustrait rien et
    // on le signale, plutot que de retirer une duree inventee.
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
      ev(ALICE, ACTIONS.DEBUT_PAUSE, '12:00'),
      ev(ALICE, ACTIONS.DEPART, '17:00'),
    ])
    expect(journees[0].minutesPause).toBe(0)
    expect(journees[0].minutesTravaillees).toBe(9 * 60)
  })

  test('plusieurs pauses s additionnent', () => {
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
      ev(ALICE, ACTIONS.DEBUT_PAUSE, '10:00'),
      ev(ALICE, ACTIONS.FIN_PAUSE, '10:15'),
      ev(ALICE, ACTIONS.DEBUT_PAUSE, '12:00'),
      ev(ALICE, ACTIONS.FIN_PAUSE, '13:00'),
      ev(ALICE, ACTIONS.DEPART, '17:00'),
    ])
    expect(journees[0].minutesPause).toBe(75)
    expect(journees[0].minutesTravaillees).toBe(9 * 60 - 75)
  })

  test('une fin de pause sans debut est signalee', () => {
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
      ev(ALICE, ACTIONS.FIN_PAUSE, '13:00'),
      ev(ALICE, ACTIONS.DEPART, '17:00'),
    ])
    expect(journees[0].anomalies).toContain(ANOMALIES.PAUSE_HORS_JOURNEE)
  })
})

describe('les pointages non valides', () => {
  test('un pointage refuse fait basculer la journee en anomalie', () => {
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00', { statut: 'refuse' }),
      ev(ALICE, ACTIONS.DEPART, '17:00'),
    ])
    expect(journees[0].anomalies).toContain(ANOMALIES.POINTAGE_NON_VALIDE)
    expect(journees[0].complete).toBe(false)
  })

  test('un pointage a verifier aussi', () => {
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
      ev(ALICE, ACTIONS.DEPART, '17:00', { statut: 'en_attente_correction' }),
    ])
    expect(journees[0].anomalies).toContain(ANOMALIES.POINTAGE_NON_VALIDE)
  })

  test('un pointage corrige compte normalement', () => {
    // C'est tout l'interet d'une correction : redonner sa valeur a la
    // journee. Si 'corrige' ne comptait pas, corriger ne servirait a rien.
    expect(STATUTS_COMPTES).toContain('corrige')
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00', { statut: 'corrige' }),
      ev(ALICE, ACTIONS.DEPART, '17:00', { statut: 'corrige' }),
    ])
    expect(journees[0].complete).toBe(true)
    expect(journees[0].minutesTravaillees).toBe(9 * 60)
  })
})

describe('les durees invraisemblables', () => {
  test('au-dela du seuil, la journee est signalee', () => {
    // Cas courant : depart du soir jamais pointe, journee refermee par un
    // depart le lendemain. Le total serait juste arithmetiquement et faux
    // en pratique.
    const journees = construireJournees([
      ev(ALICE, ACTIONS.ARRIVEE, '08:00', { jour: 10 }),
      ev(ALICE, ACTIONS.DEPART, '09:00', { jour: 11 }),
    ])
    expect(journees[0].anomalies).toContain(ANOMALIES.DUREE_INVRAISEMBLABLE)
    expect(journees[0].complete).toBe(false)
    // Le temps reste calcule : c'est a l'humain de trancher, pas au code
    // de l'effacer.
    expect(journees[0].minutesTravaillees).toBe(25 * 60)
    expect(journees[0].minutesTravaillees).toBeGreaterThan(DUREE_INVRAISEMBLABLE_MINUTES)
  })
})

describe('plusieurs salaries', () => {
  const journees = construireJournees([
    ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
    ev(BOB, ACTIONS.ARRIVEE, '09:00'),
    ev(ALICE, ACTIONS.DEPART, '12:00'),
    ev(BOB, ACTIONS.DEPART, '18:00'),
  ])

  test('les journees ne se melangent jamais entre profils', () => {
    // Le depart de Bob ne doit pas fermer la journee d'Alice.
    expect(journees).toHaveLength(2)
    const alice = journees.find(j => j.profileId === ALICE)
    const bob = journees.find(j => j.profileId === BOB)
    expect(alice.minutesTravaillees).toBe(4 * 60)
    expect(bob.minutesTravaillees).toBe(9 * 60)
  })
})

describe('les totaux', () => {
  const journees = construireJournees([
    ev(ALICE, ACTIONS.ARRIVEE, '08:00'),
    ev(ALICE, ACTIONS.DEPART, '12:00'),
    ev(BOB, ACTIONS.ARRIVEE, '09:00'),   // depart oublie
  ])

  test('le total n additionne que les journees completes', () => {
    const t = totalMinutes(journees)
    expect(t.minutes).toBe(4 * 60)
    expect(t.completes).toBe(1)
  })

  test('les incompletes sont comptees a part, pas avalees', () => {
    // Un total qui les absorbe silencieusement est un total faux dont
    // rien ne dit qu'il est faux.
    expect(totalMinutes(journees).incompletes).toBe(1)
  })

  test('journeesAvecAnomalie remonte exactement ce qu il faut corriger', () => {
    const aCorriger = journeesAvecAnomalie(journees)
    expect(aCorriger).toHaveLength(1)
    expect(aCorriger[0].profileId).toBe(BOB)
  })
})

describe('entrees inutilisables', () => {
  test('une liste vide ne casse rien', () => {
    expect(construireJournees([])).toEqual([])
    expect(construireJournees()).toEqual([])
    expect(totalMinutes([])).toEqual({ minutes: 0, completes: 0, incompletes: 0 })
  })

  test('les lignes sans profil ou sans horodatage sont ecartees', () => {
    const journees = construireJournees([
      { action: ACTIONS.ARRIVEE, statut: 'accepte', horodatage_evenement: new Date() },
      { profile_id: ALICE, action: ACTIONS.ARRIVEE, statut: 'accepte', horodatage_evenement: null },
      { profile_id: ALICE, action: ACTIONS.ARRIVEE, statut: 'accepte', horodatage_evenement: 'pas une date' },
      null,
    ])
    expect(journees).toEqual([])
  })
})

describe('affichage', () => {
  test('les durees sont lisibles', () => {
    expect(formaterDuree(0)).toBe('0h00')
    expect(formaterDuree(5)).toBe('0h05')
    expect(formaterDuree(450)).toBe('7h30')
    expect(formaterDuree(1440)).toBe('24h00')
  })

  test('une duree inconnue affiche un tiret, jamais 0h00', () => {
    // « 0h00 » se lit « n'a pas travaille ». C'est faux : on ne sait pas.
    expect(formaterDuree(null)).toBe('—')
    expect(formaterDuree(undefined)).toBe('—')
    expect(formaterDuree('abc')).toBe('—')
  })

  test('la cle de jour suit le fuseau local, pas UTC', () => {
    // toISOString() aurait fait basculer une soiree d'hiver au lendemain.
    expect(cleJour(new Date(2026, 2, 10, 23, 30))).toBe('2026-03-10')
    expect(cleJour(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})
