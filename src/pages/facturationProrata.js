// src/pages/facturationProrata.js
// =====================================================================
// LA LOGIQUE DE L'ECRAN DE FACTURATION AU PRORATA.
//
// Separee du composant pour une raison simple : ce qui produit des
// montants doit pouvoir etre teste sans monter un navigateur. Le
// composant, lui, ne fait qu'afficher ce que ces fonctions renvoient.
//
// LE CALCUL N'EST PAS ICI
//   Il est en SQL (facturation_clients_global). Ce fichier met en forme,
//   il ne recalcule rien -- sinon on aurait deux calculs qui finiraient
//   par ne plus dire la meme chose, ce qu'on passe la semaine a
//   reparer ailleurs.
// =====================================================================

export const COLONNES_FACTURATION = [
  'Client', 'Inscrit le', 'Pack', 'Inclus', 'Deja facture au',
  'Du', 'Au', 'Jours', 'Abonnement', 'Supplement', 'Total', 'A verifier',
]

export const LARGEURS_FACTURATION = [26, 12, 14, 8, 16, 12, 12, 8, 12, 12, 12, 52]

/** JJ/MM/AAAA a partir d'une date ISO, sans passer par un fuseau. */
export function jjmmaaaa(iso) {
  if (!iso) return ''
  const bouts = String(iso).slice(0, 10).split('-')
  if (bouts.length !== 3) return String(iso)
  return bouts[2] + '/' + bouts[1] + '/' + bouts[0]
}

/** AAAA-MM-JJ d'aujourd'hui, en heure LOCALE (pas toISOString). */
export function aujourdhui(date = new Date()) {
  return date.getFullYear()
    + '-' + String(date.getMonth() + 1).padStart(2, '0')
    + '-' + String(date.getDate()).padStart(2, '0')
}

export function euros(montant) {
  if (montant == null || !Number.isFinite(Number(montant))) return '—'
  return Number(montant).toFixed(2).replace('.', ',') + ' €'
}

/**
 * Les lignes a facturer, et celles qui n'ont rien a facturer.
 *
 * On ne jette pas les secondes : un client absent du tableau se lit
 * « je l'ai oublie », alors qu'il est simplement deja a jour. La
 * difference doit se voir.
 */
export function trierFacturation(lignes = []) {
  const aFacturer = []
  const ajour = []

  ;(lignes || []).forEach((l) => {
    if (!l) return
    if (Number(l.jours) > 0) aFacturer.push(l)
    else ajour.push(l)
  })

  return { aFacturer, ajour }
}

/** Le total de ce qui est effectivement facturable. */
export function totauxFacturation(lignes = []) {
  const { aFacturer } = trierFacturation(lignes)

  return aFacturer.reduce((t, l) => ({
    clients: t.clients + 1,
    abonnement: t.abonnement + Number(l.montant_abonnement || 0),
    utilisateurs: t.utilisateurs + Number(l.montant_utilisateurs || 0),
    total: t.total + Number(l.montant || 0),
    // Une remarque signale un montant qu'on ne peut pas garantir. Le
    // total les inclut quand meme -- les cacher donnerait un total
    // rassurant et faux -- mais leur nombre est annonce.
    aVerifier: t.aVerifier + (l.remarque ? 1 : 0),
  }), { clients: 0, abonnement: 0, utilisateurs: 0, total: 0, aVerifier: 0 })
}

/**
 * Les lignes du classeur.
 *
 * Seuls les clients ayant quelque chose a facturer y figurent : un
 * tableur qu'on envoie a la compta n'a pas a contenir des lignes a zero
 * qu'il faudra ensuite expliquer.
 */
export function construireLignesFacturation(lignes = []) {
  const { aFacturer } = trierFacturation(lignes)
  const sortie = [COLONNES_FACTURATION.slice()]

  aFacturer.forEach((l) => {
    sortie.push([
      l.nom || '(sans nom)',
      jjmmaaaa(l.inscrite_le),
      l.plan || '—',
      l.inclus == null ? '' : Number(l.inclus),
      l.deja_facture_au ? jjmmaaaa(l.deja_facture_au) : 'jamais facture',
      jjmmaaaa(l.periode_debut),
      jjmmaaaa(l.periode_fin),
      Number(l.jours || 0),
      // Les montants sortent en NOMBRES : « 10,63 € » est lisible mais
      // inadditionnable dans un tableur.
      Number(l.montant_abonnement || 0),
      Number(l.montant_utilisateurs || 0),
      Number(l.montant || 0),
      l.remarque || '',
    ])
  })

  if (aFacturer.length > 0) {
    const t = totauxFacturation(lignes)
    sortie.push([])
    sortie.push([
      'TOTAL', '', '', '', '', '', '',
      aFacturer.reduce((s, l) => s + Number(l.jours || 0), 0),
      Number(t.abonnement.toFixed(2)),
      Number(t.utilisateurs.toFixed(2)),
      Number(t.total.toFixed(2)),
      t.aVerifier > 0
        ? t.aVerifier + ' ligne(s) portent une remarque : a verifier avant envoi'
        : '',
    ])
  }

  return sortie
}

export function nomFichierFacturation(jusquAu) {
  return 'facturation-clients-' + String(jusquAu || '').slice(0, 10) + '.xlsx'
}

/**
 * Ce qu'on affiche a la place d'un montant quand la periode est vide.
 *
 * « 0,00 € » se lit « ce client ne doit rien », ce qui est faux : il est
 * a jour. Les deux ne se disent pas pareil.
 */
export function libelleRienAFacturer(ligne) {
  if (!ligne) return ''
  return ligne.deja_facture_au
    ? 'A jour jusqu’au ' + jjmmaaaa(ligne.deja_facture_au)
    : 'Rien a facturer'
}
