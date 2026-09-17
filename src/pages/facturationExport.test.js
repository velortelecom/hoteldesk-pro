// src/pages/facturationExport.test.js
// =====================================================================
// Un montant a facturer doit etre teste. Tant que ce calcul vivait dans
// le JSX de l'ecran, la seule facon de le verifier etait de regarder
// l'ecran -- c'est-a-dire de faire confiance.
// =====================================================================
const {
  COLONNES_EXPORT, LARGEURS_EXPORT, construireLignesExport, euros,
  libellePeriode, nomFichierExport, periodesProposees, premierDuMois,
  totauxFacturation,
} = require('./facturationExport')

// Un jeu de releves qui couvre les quatre cas reels.
const RELEVES = [
  { entreprise_id: 'a', entreprises: { nom: 'Fondateur' }, periode: '2026-09-01', plan: 'starter', utilisateurs: 12, inclus: 10, surplus: 2, prix_base: 29, supplement: 4, prix_total: 33, sur_devis: false },
  { entreprise_id: 'b', entreprises: { nom: 'Standard' }, periode: '2026-09-01', plan: 'starter', utilisateurs: 10, inclus: 10, surplus: 0, prix_base: 39, supplement: 0, prix_total: 39, sur_devis: false },
  { entreprise_id: 'c', entreprises: { nom: 'Gros' }, periode: '2026-09-01', plan: 'starter', utilisateurs: 31, inclus: 10, surplus: 21, prix_base: 39, supplement: 0, prix_total: null, sur_devis: true },
  { entreprise_id: 'd', entreprises: { nom: 'Gratuit' }, periode: '2026-09-01', plan: 'gratuit', utilisateurs: 2, inclus: 3, surplus: 0, prix_base: 0, supplement: 0, prix_total: 0, sur_devis: false },
]

describe('periodes', () => {
  test('une periode est toujours le 1er du mois', () => {
    // La contrainte existe aussi en base (releves_facturation_periode_1er).
    // Si le navigateur envoyait le 17, l'insertion serait refusee.
    expect(premierDuMois(new Date(2026, 8, 17))).toBe('2026-09-01')
    expect(premierDuMois(new Date(2026, 11, 31))).toBe('2026-12-01')
    expect(premierDuMois(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  test('les douze mois proposes partent du mois en cours et remontent', () => {
    const p = periodesProposees(new Date(2026, 1, 10)) // fevrier 2026
    expect(p).toHaveLength(12)
    expect(p[0]).toBe('2026-02-01')
    expect(p[1]).toBe('2026-01-01')
    expect(p[2]).toBe('2025-12-01')   // le passage d'annee ne casse pas
    expect(p[11]).toBe('2025-03-01')
    expect(new Set(p).size).toBe(12)  // aucun doublon
  })

  test('le libelle est lisible et ne perd pas l annee', () => {
    expect(libellePeriode('2026-09-01')).toBe('septembre 2026')
    expect(libellePeriode('2026-01-01')).toBe('janvier 2026')
    expect(libellePeriode('')).toBe('')
  })

  test('le nom du fichier porte le mois, pas le jour', () => {
    expect(nomFichierExport('2026-09-01')).toBe('facturation-velor-one-2026-09.xlsx')
  })
})

describe('affichage des montants', () => {
  test('un montant absent s affiche en tiret, jamais en zero', () => {
    // Un zero dirait « rien a payer ». Pour une entreprise sur devis,
    // c'est faux : le montant est a etablir.
    expect(euros(null)).toBe('—')
    expect(euros(undefined)).toBe('—')
    expect(euros('')).toBe('—')
    expect(euros(0)).toBe('0,00 €')
    expect(euros(33)).toBe('33,00 €')
    expect(euros('41.5')).toBe('41,50 €')
  })
})

describe('totaux de l ecran', () => {
  const DIRECT = [
    { entreprise_id: 'a', nom: 'Fondateur', utilisateurs: 12, surplus: 2, supplement: 4, prix_total: 33, sur_devis: false, actif: true, fige: true },
    { entreprise_id: 'b', nom: 'Standard', utilisateurs: 11, surplus: 1, supplement: 2, prix_total: 41, sur_devis: false, actif: true, fige: false },
    { entreprise_id: 'c', nom: 'Gros', utilisateurs: 31, surplus: 21, supplement: 0, prix_total: null, sur_devis: true, actif: true, fige: false },
    { entreprise_id: 'e', nom: 'Fermee', utilisateurs: 4, surplus: 0, supplement: 0, prix_total: 39, sur_devis: false, actif: false, fige: false },
  ]

  test('le total n additionne que les montants reels', () => {
    // Compter une entreprise sur devis comme un zero donnerait un total
    // faux dont rien ne montrerait qu'il est faux.
    const t = totauxFacturation(DIRECT, RELEVES)
    expect(t.totalDirect).toBe(33 + 41 + 39)
    expect(t.nbDevis).toBe(1)
  })

  test('le compteur de debordement suit le supplement, pas le surplus', () => {
    // Gros a 21 utilisateurs au-dela mais AUCUN supplement facturable
    // (il est sur devis) : il ne doit pas etre compte comme un
    // debordement facture.
    expect(totauxFacturation(DIRECT, []).nbDebordement).toBe(2)
  })

  test('le bouton annonce le nombre d entreprises qu il va reellement figer', () => {
    // Ni celles deja figees, ni les entreprises inactives.
    expect(totauxFacturation(DIRECT, []).resteAFiger).toBe(2)
  })

  test('une liste vide n est pas une periode figee', () => {
    // Sinon l'ecran afficherait « periode figee » avant meme d'avoir lu
    // quoi que ce soit.
    expect(totauxFacturation([], []).periodeFigee).toBe(false)
    expect(totauxFacturation(DIRECT.map(l => ({ ...l, fige: true })), []).periodeFigee).toBe(true)
  })

  test('le total du releve est celui qui a ete fige, pas celui du direct', () => {
    const t = totauxFacturation(DIRECT, RELEVES)
    expect(t.totalReleve).toBe(33 + 39 + 0)   // Gros sur devis : aucun montant
    expect(t.totalReleve).not.toBe(t.totalDirect)
  })
})

describe('lignes exportees', () => {
  test('la premiere ligne est l entete', () => {
    const l = construireLignesExport(RELEVES)
    expect(l[0]).toEqual(COLONNES_EXPORT)
    expect(LARGEURS_EXPORT).toHaveLength(COLONNES_EXPORT.length)
  })

  test('les montants sortent en NOMBRES, pas en chaines', () => {
    // C'est toute la raison de ne pas exporter un CSV : dans Excel, il
    // faut pouvoir additionner la colonne sans la reconvertir.
    const ligne = construireLignesExport(RELEVES)[1]
    expect(typeof ligne[3]).toBe('number')   // utilisateurs
    expect(typeof ligne[6]).toBe('number')   // prix de base
    expect(typeof ligne[8]).toBe('number')   // total
    expect(ligne[8]).toBe(33)
  })

  test('une entreprise sur devis sort sans montant, pas avec un zero', () => {
    const gros = construireLignesExport(RELEVES).find(l => l[0] === 'Gros')
    expect(gros[8]).toBe('')
    expect(gros[9]).toBe('oui')
  })

  test('le total exporte exclut les entreprises sur devis', () => {
    const lignes = construireLignesExport(RELEVES)
    const total = lignes[lignes.length - 1]
    expect(total[0]).toBe('TOTAL')
    expect(total[8]).toBe(33 + 39 + 0)
  })

  test('sans releve, on exporte l entete seule et aucun total', () => {
    // Une periode non figee n'a rien a facturer : un total de 0 EUR
    // laisserait croire le contraire.
    const l = construireLignesExport([])
    expect(l).toHaveLength(1)
    expect(l[0]).toEqual(COLONNES_EXPORT)
  })

  test('une entreprise sans nom lisible garde son identifiant', () => {
    const l = construireLignesExport([{ entreprise_id: 'zz', periode: '2026-09-01', utilisateurs: 3, surplus: 0 }])
    expect(l[1][0]).toBe('zz')
  })
})
