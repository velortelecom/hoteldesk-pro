// src/modules/pointage/reseau.test.js
// =====================================================================
// Le piege de ce fichier : une reference mal deduite ACCUSE les gens
// honnetes. Chaque test ci-dessous protege quelqu'un.
// =====================================================================
const {
  PROVENANCES, SEUIL_PERSONNES, SEUIL_POINTAGES,
  comptesParSalarie, empreinteReseau, marquerProvenance, provenance,
  reseauDeReference,
} = require('./reseau')
const { ANOMALIES, construireJournees, ACTIONS } = require('./journees')

const HOTEL = '82.65.10.20'
const MAISON = '90.12.34.56'

function pt(profileId, ip, jour = 10, action = 'arrivee') {
  return {
    id: profileId + ip + jour + action,
    profile_id: profileId,
    action,
    statut: 'accepte',
    ip_address: ip,
    horodatage_evenement: new Date(2026, 2, jour, 8, 0),
  }
}

/** n personnes x 2 pointages depuis l'hotel. */
function equipe(n, ip = HOTEL) {
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(pt('p' + i, ip, 10), pt('p' + i, ip, 11))
  }
  return out
}

describe('empreinte du reseau', () => {
  test('en IPv4, l adresse entiere identifie le reseau', () => {
    expect(empreinteReseau('82.65.10.20')).toBe('82.65.10.20')
    expect(empreinteReseau('82.65.10.20/32')).toBe('82.65.10.20')
  })

  test('en IPv6, seul le prefixe est commun a l etablissement', () => {
    // Chaque telephone a sa propre adresse IPv6. Comparer l'adresse
    // entiere dirait « autre reseau » pour tout le monde, tout le temps.
    const a = empreinteReseau('2a01:cb00:1234:5678:aaaa:bbbb:cccc:dddd')
    const b = empreinteReseau('2a01:cb00:1234:5678:1111:2222:3333:4444')
    expect(a).toBe(b)
    expect(a).toBe('2a01:cb00:1234:5678')
  })

  test('deux prefixes IPv6 differents ne se confondent pas', () => {
    expect(empreinteReseau('2a01:cb00:1234:5678::1'))
      .not.toBe(empreinteReseau('2a01:cb00:9999:0000::1'))
  })

  test('une adresse absente ou illisible ne vaut pas empreinte', () => {
    expect(empreinteReseau(null)).toBeNull()
    expect(empreinteReseau('')).toBeNull()
    expect(empreinteReseau('pas une ip')).toBeNull()
    expect(empreinteReseau('999.1.1')).toBeNull()
  })
})

describe('la reference se deduit de la majorite', () => {
  test('le reseau de la plupart des gens est celui de l etablissement', () => {
    const ref = reseauDeReference([...equipe(6), pt('tricheur', MAISON, 10)])
    expect(ref.etabli).toBe(true)
    expect(ref.empreinte).toBe(HOTEL)
  })

  test('un seul salarie ne peut pas imposer la reference, meme en pointant beaucoup', () => {
    // C'est le coeur du sujet : on compte les PERSONNES. Sinon quelqu'un
    // qui pointe quatre fois par jour depuis chez lui gagne l'election,
    // et tous ses collegues deviennent des anomalies.
    const acharne = []
    for (let i = 0; i < 20; i++) acharne.push(pt('acharne', MAISON, 10 + i))
    const ref = reseauDeReference([...equipe(3), ...acharne])
    expect(ref.empreinte).toBe(HOTEL)
  })

  test('sous le seuil de pointages, le systeme se tait', () => {
    // Avec trois pointages on ne sait rien, et accuser sur trois
    // pointages serait pire que ne rien dire.
    const ref = reseauDeReference([pt('a', HOTEL), pt('b', HOTEL), pt('c', HOTEL)])
    expect(ref.etabli).toBe(false)
    expect(ref.empreinte).toBeNull()
    expect(SEUIL_POINTAGES).toBeGreaterThan(3)
  })

  test('sous le seuil de personnes, le systeme se tait aussi', () => {
    // Deux personnes qui pointent beaucoup ne font pas une majorite.
    const deux = []
    for (let i = 0; i < 8; i++) { deux.push(pt('a', HOTEL, i + 1), pt('b', HOTEL, i + 1)) }
    const ref = reseauDeReference(deux)
    expect(ref.personnes).toBe(2)
    expect(ref.etabli).toBe(false)
    expect(SEUIL_PERSONNES).toBeGreaterThan(2)
  })

  test('une egalite parfaite ne se tranche pas au hasard', () => {
    const a = []
    for (let i = 0; i < 3; i++) { a.push(pt('h' + i, HOTEL, 10), pt('h' + i, HOTEL, 11)) }
    for (let i = 0; i < 3; i++) { a.push(pt('m' + i, MAISON, 10), pt('m' + i, MAISON, 11)) }
    expect(reseauDeReference(a).etabli).toBe(false)
  })

  test('les pointages sans adresse sont ignores, pas comptes', () => {
    // equipe(6) = 12 pointages : au-dessus du seuil. Avec equipe(4) on
    // serait a 8, donc sous le seuil, et le test aurait teste le seuil
    // au lieu de tester ce qu'il annonce.
    const ref = reseauDeReference([...equipe(6), pt('x', null, 10), pt('y', '', 10)])
    expect(ref.empreinte).toBe(HOTEL)
    expect(ref.pointages).toBe(12)
  })

  test('quand la box change d adresse, la majorite migre toute seule', () => {
    const NOUVELLE = '82.65.99.99'
    const ref = reseauDeReference([...equipe(5, NOUVELLE), pt('retardataire', HOTEL, 10)])
    expect(ref.empreinte).toBe(NOUVELLE)
  })

  test('une liste vide ne casse rien et n affirme rien', () => {
    const ref = reseauDeReference([])
    expect(ref.etabli).toBe(false)
    expect(ref.empreinte).toBeNull()
  })
})

describe('provenance d un pointage', () => {
  const ref = reseauDeReference(equipe(6))

  test('depuis l etablissement', () => {
    expect(provenance(pt('a', HOTEL), ref)).toBe(PROVENANCES.ETABLISSEMENT)
  })

  test('depuis ailleurs', () => {
    expect(provenance(pt('a', MAISON), ref)).toBe(PROVENANCES.AUTRE)
  })

  test('sans reference etablie, on ne qualifie rien', () => {
    // Le systeme ne doit jamais dire « autre reseau » alors qu'il ne sait
    // pas quel est le bon.
    const sansRef = reseauDeReference([pt('a', HOTEL)])
    expect(provenance(pt('a', MAISON), sansRef)).toBe(PROVENANCES.INCONNUE)
  })

  test('sans adresse sur le pointage, on ne qualifie rien non plus', () => {
    expect(provenance(pt('a', null), ref)).toBe(PROVENANCES.INCONNUE)
  })
})

describe('marquage des journees', () => {
  const ref = reseauDeReference(equipe(6))

  const journeesDepuisHotel = construireJournees([
    { ...pt('z', HOTEL, 12, ACTIONS.ARRIVEE) },
    { ...pt('z', HOTEL, 12, ACTIONS.DEPART), action: ACTIONS.DEPART, horodatage_evenement: new Date(2026, 2, 12, 17, 0) },
  ])

  const journeesDepuisMaison = construireJournees([
    { ...pt('z', MAISON, 12, ACTIONS.ARRIVEE) },
    { ...pt('z', HOTEL, 12, ACTIONS.DEPART), action: ACTIONS.DEPART, horodatage_evenement: new Date(2026, 2, 12, 17, 0) },
  ])

  test('une journee entierement depuis l etablissement n est pas signalee', () => {
    const m = marquerProvenance(journeesDepuisHotel, ref, ANOMALIES.RESEAU_INCONNU)
    expect(m[0].provenance).toBe(PROVENANCES.ETABLISSEMENT)
    expect(m[0].anomalies).not.toContain(ANOMALIES.RESEAU_INCONNU)
  })

  test('un seul pointage venu d ailleurs suffit a signaler la journee', () => {
    const m = marquerProvenance(journeesDepuisMaison, ref, ANOMALIES.RESEAU_INCONNU)
    expect(m[0].provenance).toBe(PROVENANCES.AUTRE)
    expect(m[0].anomalies).toContain(ANOMALIES.RESEAU_INCONNU)
    expect(m[0].pointagesHorsEtablissement).toBe(1)
  })

  test('les heures ne sont PAS retirees pour autant', () => {
    // Le temoin s'allume, il ne coupe pas le moteur. Retirer des heures
    // sur un soupcon serait retenir un salaire sur un soupcon.
    const m = marquerProvenance(journeesDepuisMaison, ref, ANOMALIES.RESEAU_INCONNU)
    expect(m[0].minutesTravaillees).toBe(journeesDepuisMaison[0].minutesTravaillees)
    expect(m[0].minutesTravaillees).toBe(9 * 60)
  })

  test('sans reference etablie, aucune journee n est marquee', () => {
    const sansRef = reseauDeReference([pt('a', HOTEL)])
    const m = marquerProvenance(journeesDepuisMaison, sansRef, ANOMALIES.RESEAU_INCONNU)
    expect(m[0].anomalies).not.toContain(ANOMALIES.RESEAU_INCONNU)
  })
})

describe('comptes par salarie', () => {
  test('on peut dire « 21 sur 22 depuis l etablissement »', () => {
    const ref = reseauDeReference(equipe(6))
    const comptes = comptesParSalarie(
      [pt('julien', HOTEL, 10), pt('julien', HOTEL, 11), pt('julien', MAISON, 12)],
      ref,
    )
    const julien = comptes.find(c => c.profileId === 'julien')
    expect(julien.total).toBe(3)
    expect(julien.etablissement).toBe(2)
    expect(julien.autre).toBe(1)
  })
})
