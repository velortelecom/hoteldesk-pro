// src/pages/facturationProrata.test.js
// =====================================================================
// C'est ce tableau que Rayan lit avant d'envoyer des factures. Une
// erreur ici se transforme en client facture deux fois, ou pas du tout.
// =====================================================================
const {
  COLONNES_FACTURATION, LARGEURS_FACTURATION,
  aujourdhui, construireLignesFacturation, euros, jjmmaaaa,
  libelleRienAFacturer, nomFichierFacturation, totauxFacturation,
  trierFacturation,
} = require('./facturationProrata')

function ligne(nom, sur = {}) {
  return {
    nom,
    inscrite_le: '2026-09-01',
    plan: 'starter',
    inclus: 10,
    deja_facture_au: null,
    periode_debut: '2026-09-01',
    periode_fin: '2026-09-30',
    jours: 30,
    montant_abonnement: 39,
    montant_utilisateurs: 0,
    montant: 39,
    remarque: null,
    ...sur,
  }
}

const AJOUR = ligne('Hotel A Jour', {
  deja_facture_au: '2026-09-30',
  periode_debut: '2026-10-01',
  periode_fin: '2026-09-30',
  jours: 0,
  montant_abonnement: 0,
  montant_utilisateurs: 0,
  montant: 0,
})

describe('dates', () => {
  test('les dates s affichent a la francaise sans passer par un fuseau', () => {
    // new Date('2026-09-01') est interprete en UTC : affiche en France
    // l'ete, ca peut reculer au 31/08. On decoupe la chaine.
    expect(jjmmaaaa('2026-09-01')).toBe('01/09/2026')
    expect(jjmmaaaa('2026-01-31T00:00:00Z')).toBe('31/01/2026')
    expect(jjmmaaaa(null)).toBe('')
  })

  test('aujourd hui est local, pas UTC', () => {
    // Le 30 a 23h30 en France, toISOString() donne deja le 30 a 21h30
    // UTC -- mais un 01/01 a 00h30 donnerait le 31/12. On facture sur la
    // date que l'utilisateur voit a l'ecran.
    expect(aujourdhui(new Date(2027, 0, 1, 0, 30))).toBe('2027-01-01')
    expect(aujourdhui(new Date(2026, 8, 30, 23, 59))).toBe('2026-09-30')
  })

  test('les montants s ecrivent a la francaise', () => {
    expect(euros(10.625)).toBe('10,63 €')
    expect(euros(39)).toBe('39,00 €')
    expect(euros(null)).toBe('—')
  })
})

describe('separer ce qui est facturable de ce qui est a jour', () => {
  const lignes = [ligne('Hotel Un'), AJOUR, ligne('Hotel Deux')]

  test('un client sans jours a facturer n est pas melange aux autres', () => {
    const { aFacturer, ajour } = trierFacturation(lignes)
    expect(aFacturer.map(l => l.nom)).toEqual(['Hotel Un', 'Hotel Deux'])
    expect(ajour.map(l => l.nom)).toEqual(['Hotel A Jour'])
  })

  test('« a jour » ne se dit pas « 0,00 € »', () => {
    // Un zero se lit « ce client ne doit rien ». C'est faux : il est a
    // jour, ce qui n'est pas la meme chose et ne se verifie pas pareil.
    expect(libelleRienAFacturer(AJOUR)).toContain('A jour')
    expect(libelleRienAFacturer(AJOUR)).toContain('30/09/2026')
    expect(libelleRienAFacturer(ligne('X', { jours: 0, deja_facture_au: null })))
      .toBe('Rien a facturer')
  })

  test('une liste vide ne casse rien', () => {
    expect(trierFacturation()).toEqual({ aFacturer: [], ajour: [] })
    expect(trierFacturation(null).aFacturer).toEqual([])
  })
})

describe('totaux', () => {
  test('seuls les clients facturables comptent', () => {
    const t = totauxFacturation([ligne('A'), AJOUR, ligne('B')])
    expect(t.clients).toBe(2)
    expect(t.total).toBe(78)
  })

  test('abonnement et supplement sont additionnes separement', () => {
    const t = totauxFacturation([
      ligne('A', { montant_abonnement: 39, montant_utilisateurs: 4, montant: 43 }),
      ligne('B', { montant_abonnement: 29, montant_utilisateurs: 0, montant: 29 }),
    ])
    expect(t.abonnement).toBe(68)
    expect(t.utilisateurs).toBe(4)
    expect(t.total).toBe(72)
  })

  test('les lignes a verifier sont comptees, pas exclues', () => {
    // Les exclure donnerait un total rassurant et faux. On les garde
    // dans le total ET on annonce combien il y en a.
    const t = totauxFacturation([
      ligne('A'),
      ligne('B', { remarque: 'ATTENTION : prix_mensuel vaut 0' }),
    ])
    expect(t.clients).toBe(2)
    expect(t.total).toBe(78)
    expect(t.aVerifier).toBe(1)
  })
})

describe('classeur', () => {
  const lignes = [
    ligne('Hotel Un', { montant_utilisateurs: 4, montant: 43 }),
    AJOUR,
    ligne('Hotel Deux', { remarque: 'prix a 0' }),
  ]
  const sortie = construireLignesFacturation(lignes)

  test('l entete est complete et les largeurs suivent', () => {
    expect(sortie[0]).toEqual(COLONNES_FACTURATION)
    expect(LARGEURS_FACTURATION).toHaveLength(COLONNES_FACTURATION.length)
  })

  test('les clients a jour ne sont pas dans le classeur', () => {
    // Un tableur envoye a la compta n'a pas a contenir des lignes a zero
    // qu'il faudra ensuite expliquer.
    const noms = sortie.map(l => l[0])
    expect(noms).not.toContain('Hotel A Jour')
    expect(noms).toContain('Hotel Un')
  })

  test('les montants sortent en nombres, pas en texte', () => {
    const l = sortie.find(x => x[0] === 'Hotel Un')
    expect(typeof l[8]).toBe('number')
    expect(l[8]).toBe(39)
    expect(l[9]).toBe(4)
    expect(l[10]).toBe(43)
  })

  test('un client jamais facture le dit', () => {
    const l = sortie.find(x => x[0] === 'Hotel Un')
    expect(l[4]).toBe('jamais facture')
  })

  test('la remarque suit la ligne', () => {
    const l = sortie.find(x => x[0] === 'Hotel Deux')
    expect(l[11]).toBe('prix a 0')
  })

  test('le total previent qu il contient des lignes a verifier', () => {
    const total = sortie.find(x => x[0] === 'TOTAL')
    expect(total[10]).toBe(82)
    expect(total[11]).toContain('a verifier avant envoi')
  })

  test('toutes les lignes ont la largeur de l entete', () => {
    // Une ligne trop courte decale les montants d'une colonne, en
    // silence, dans le classeur.
    sortie.filter(l => l.length > 0).forEach(l => {
      expect(l).toHaveLength(COLONNES_FACTURATION.length)
    })
  })

  test('sans rien a facturer, on n exporte ni total ni ligne vide', () => {
    const vide = construireLignesFacturation([AJOUR])
    expect(vide).toHaveLength(1)
    expect(vide[0]).toEqual(COLONNES_FACTURATION)
  })
})

describe('nommage', () => {
  test('le fichier porte la date d arrete', () => {
    expect(nomFichierFacturation('2026-09-30')).toBe('facturation-clients-2026-09-30.xlsx')
  })
})
