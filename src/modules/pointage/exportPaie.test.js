// src/modules/pointage/exportPaie.test.js
// =====================================================================
// C'est le fichier que le comptable additionne. Une erreur ici se
// transforme en salaire faux, et personne ne la voit avant la fiche de
// paie.
// =====================================================================
const { construireJournees, ACTIONS } = require('./journees')
const {
  COLONNES_PAIE, LARGEURS_PAIE, bornesMois, construireLignesPaie,
  heuresDecimales, journeesDuMois, libelleMois, nomFichierPaie,
  recapitulerParSalarie,
} = require('./exportPaie')

const ALICE = 'profil-alice'
const BOB = 'profil-bob'
const NOMS = { [ALICE]: 'Alice Bertin', [BOB]: 'Bob Carre' }

function ev(profileId, action, heure, jour = 10, mois = 2, statut = 'accepte') {
  const [h, m] = heure.split(':').map(Number)
  return {
    id: profileId + action + jour + heure,
    profile_id: profileId,
    site_id: 'site-1',
    action,
    statut,
    horodatage_evenement: new Date(2026, mois, jour, h, m, 0),
  }
}

/** Une journee complete de 8h (9h moins 1h de pause). */
function journeeComplete(profileId, jour) {
  return [
    ev(profileId, ACTIONS.ARRIVEE, '08:00', jour),
    ev(profileId, ACTIONS.DEBUT_PAUSE, '12:00', jour),
    ev(profileId, ACTIONS.FIN_PAUSE, '13:00', jour),
    ev(profileId, ACTIONS.DEPART, '17:00', jour),
  ]
}

describe('conversion en heures decimales', () => {
  test('les heures sortent additionnables', () => {
    // « 7h30 » est lisible mais inadditionnable dans un tableur.
    expect(heuresDecimales(450)).toBe(7.5)
    expect(heuresDecimales(480)).toBe(8)
    expect(heuresDecimales(485)).toBe(8.08)
    expect(heuresDecimales(0)).toBe(0)
  })

  test('une duree inconnue ne devient pas zero', () => {
    expect(heuresDecimales(null)).toBeNull()
    expect(heuresDecimales(undefined)).toBeNull()
  })
})

describe('recapitulatif par salarie', () => {
  const journees = construireJournees([
    ...journeeComplete(ALICE, 10),
    ...journeeComplete(ALICE, 11),
    ...journeeComplete(BOB, 10),
    ev(BOB, ACTIONS.ARRIVEE, '08:00', 11),   // depart oublie
  ])

  test('chaque salarie a son total', () => {
    const recap = recapitulerParSalarie(journees, NOMS)
    const alice = recap.find(r => r.profileId === ALICE)
    expect(alice.nom).toBe('Alice Bertin')
    expect(alice.minutes).toBe(16 * 60)
    expect(alice.heures).toBe(16)
    expect(alice.joursComptes).toBe(2)
  })

  test('une journee non calculable est comptee a part, jamais pour zero', () => {
    // Bob a travaille le 11, on ne sait juste pas combien. Le compter
    // zero, c'est le payer un jour de moins sans que personne le voie.
    const bob = recapitulerParSalarie(journees, NOMS).find(r => r.profileId === BOB)
    expect(bob.minutes).toBe(8 * 60)
    expect(bob.joursComptes).toBe(1)
    expect(bob.joursNonCalcules).toBe(1)
  })

  test('les salaries sortent par ordre alphabetique', () => {
    expect(recapitulerParSalarie(journees, NOMS).map(r => r.nom))
      .toEqual(['Alice Bertin', 'Bob Carre'])
  })

  test('un salarie sans nom connu garde son identifiant', () => {
    const recap = recapitulerParSalarie(construireJournees(journeeComplete(ALICE, 10)), {})
    expect(recap[0].nom).toBe(ALICE)
  })
})

describe('lignes du classeur', () => {
  const journees = construireJournees([
    ...journeeComplete(ALICE, 10),
    ev(BOB, ACTIONS.ARRIVEE, '08:00', 10),   // depart oublie
  ])
  const lignes = construireLignesPaie(journees, NOMS)

  test('l entete est complete et les largeurs suivent', () => {
    expect(lignes[0]).toEqual(COLONNES_PAIE)
    expect(LARGEURS_PAIE).toHaveLength(COLONNES_PAIE.length)
  })

  test('une journee complete sort avec ses heures en nombre', () => {
    const ligne = lignes.find(l => l[0] === 'Alice Bertin')
    expect(ligne[2]).toBe('08:00')
    expect(ligne[3]).toBe('17:00')
    expect(typeof ligne[5]).toBe('number')
    expect(ligne[5]).toBe(8)
    expect(ligne[6]).toBe('8h00')
    expect(ligne[7]).toBe('')            // aucun probleme a signaler
  })

  test('une journee non calculable sort SANS heures et AVEC sa raison', () => {
    const ligne = lignes.find(l => l[0] === 'Bob Carre')
    expect(ligne[5]).toBe('')            // pas 0
    expect(ligne[6]).toBe('')
    expect(ligne[7]).toContain('Aucun depart enregistre')
  })

  test('chaque salarie a son sous-total', () => {
    const total = lignes.find(l => String(l[0]).startsWith('TOTAL Alice'))
    expect(total[5]).toBe(8)
  })

  test('le sous-total d un salarie annonce ses journees non calculees', () => {
    const total = lignes.find(l => String(l[0]).startsWith('TOTAL Bob'))
    expect(total[5]).toBe(0)
    expect(total[7]).toContain('1 journee(s) non calculee(s)')
  })

  test('le total general previent que des journees en sont absentes', () => {
    // C'est la phrase qui evite qu'un comptable paie un total incomplet
    // en croyant qu'il est complet.
    const general = lignes.find(l => l[0] === 'TOTAL GENERAL')
    expect(general[5]).toBe(8)
    expect(general[7]).toContain('ne sont PAS dans ce total')
  })

  test('toutes les lignes ont la largeur de l entete', () => {
    // Une ligne trop courte decale les montants d'une colonne dans le
    // classeur, en silence.
    lignes.filter(l => l.length > 0).forEach(l => {
      expect(l).toHaveLength(COLONNES_PAIE.length)
    })
  })

  test('sans journee, on n exporte ni total ni ligne vide', () => {
    const vide = construireLignesPaie([], NOMS)
    expect(vide).toHaveLength(1)
    expect(vide[0]).toEqual(COLONNES_PAIE)
  })
})

describe('perimetre du mois', () => {
  test('les bornes sont locales, pas UTC', () => {
    const b = bornesMois('2026-03')
    expect(b.debut.getDate()).toBe(1)
    expect(b.debut.getMonth()).toBe(2)
    expect(b.debut.getHours()).toBe(0)
    expect(b.fin.getMonth()).toBe(3)
  })

  test('une nuit a cheval appartient au mois de son arrivee', () => {
    // 31 mars 22h -> 1er avril 6h. C'est une journee de mars : elle est
    // ancree sur l'arrivee. La couper la paierait sur deux mois.
    const evenements = [
      ev(ALICE, ACTIONS.ARRIVEE, '22:00', 31, 2),
      ev(ALICE, ACTIONS.DEPART, '06:00', 1, 3),
    ]
    expect(journeesDuMois(evenements, '2026-03')).toHaveLength(1)
    expect(journeesDuMois(evenements, '2026-04')).toHaveLength(0)
  })

  test('les journees hors mois sont ecartees', () => {
    const evenements = [
      ...journeeComplete(ALICE, 10),          // mars
      ...journeeComplete(ALICE, 10).map(e => ({
        ...e,
        id: e.id + '-avril',
        horodatage_evenement: new Date(2026, 3, 10, e.horodatage_evenement.getHours(), 0),
      })),
    ]
    expect(journeesDuMois(evenements, '2026-03')).toHaveLength(1)
    expect(journeesDuMois(evenements, '2026-04')).toHaveLength(1)
  })

  test('une periode illisible ne renvoie rien plutot que tout', () => {
    expect(journeesDuMois([...journeeComplete(ALICE, 10)], 'nawak')).toEqual([])
    expect(bornesMois('')).toBeNull()
  })
})

describe('nommage', () => {
  test('le mois est lisible', () => {
    expect(libelleMois('2026-03')).toBe('mars 2026')
    expect(libelleMois('2026-12')).toBe('decembre 2026')
  })

  test('le fichier porte le mois', () => {
    expect(nomFichierPaie('2026-03')).toBe('heures-2026-03.xlsx')
  })
})
