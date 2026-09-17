// src/pages/facturationExport.js
// =====================================================================
// LA LOGIQUE DE L'ECRAN FACTURATION, SANS REACT.
//
// Elle est sortie du composant pour une raison simple : un montant a
// facturer doit etre teste. Tant que ce calcul vivait dans le JSX, la
// seule facon de le verifier etait de regarder l'ecran -- c'est-a-dire
// de faire confiance.
//
// Aucun euro n'est calcule ici : les montants arrivent deja faits de
// etat_facturation() (la base). Ce fichier ne fait que choisir QUOI
// exporter, additionner, et nommer.
// =====================================================================

/** Premier jour du mois, au format que Postgres attend (AAAA-MM-01). */
export function premierDuMois(d) {
  const x = d instanceof Date ? d : new Date(d)
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01'
}

const MOIS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

export function libellePeriode(iso) {
  const bouts = String(iso || '').split('-')
  if (bouts.length < 2) return String(iso || '')
  return (MOIS[Number(bouts[1]) - 1] || bouts[1]) + ' ' + bouts[0]
}

/** Douze mois glissants, le mois en cours en premier. */
export function periodesProposees(aujourdhui) {
  const base = aujourdhui instanceof Date ? aujourdhui : new Date()
  const out = []
  for (let i = 0; i < 12; i++) {
    out.push(premierDuMois(new Date(base.getFullYear(), base.getMonth() - i, 1)))
  }
  return out
}

/** Montant lisible, ou tiret quand il n'y a pas de montant. */
export function euros(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2).replace('.', ',') + ' €'
}

/**
 * Totaux de l'ecran.
 *
 * Le total ne compte QUE ce qui a un montant : une entreprise sur devis
 * a prix_total null, et l'additionner comme un zero donnerait un total
 * faux dont on ne verrait pas qu'il est faux. On la compte a part.
 */
export function totauxFacturation(direct = [], releves = []) {
  const avecPrix = direct.filter(l => l && l.prix_total != null)

  return {
    totalDirect: avecPrix.reduce((s, l) => s + Number(l.prix_total), 0),
    totalReleve: releves.reduce((s, r) => s + (r && r.prix_total != null ? Number(r.prix_total) : 0), 0),
    nbDevis: direct.filter(l => l && l.sur_devis).length,
    nbDebordement: direct.filter(l => l && Number(l.supplement || 0) > 0).length,
    // Entreprises actives pas encore figees sur la periode : c'est ce que
    // le bouton va reellement creer.
    resteAFiger: direct.filter(l => l && !l.fige && l.actif !== false).length,
    // Vrai seulement s'il y a des entreprises ET qu'elles sont toutes
    // figees. Sur une liste vide, « tout est fige » serait un mensonge.
    periodeFigee: direct.length > 0 && direct.every(l => l && l.fige),
  }
}

export const COLONNES_EXPORT = [
  'Entreprise', 'Periode', 'Plan', 'Utilisateurs factures', 'Inclus dans la formule',
  'Au-dela du forfait', 'Prix de base', 'Supplement', 'Total a facturer', 'Sur devis',
]

export const LARGEURS_EXPORT = [28, 12, 12, 20, 22, 19, 13, 12, 17, 10]

/**
 * Lignes du classeur, a partir des releves FIGES.
 *
 * On exporte le releve, jamais le calcul en direct : un export sert a
 * facturer, et le direct change encore. Tant que la periode n'est pas
 * figee, il n'y a rien a exporter -- et c'est voulu.
 *
 * Les montants sortent en NOMBRES pour qu'Excel puisse les additionner ;
 * seule la derniere colonne est du texte (oui / non).
 */
export function construireLignesExport(releves = []) {
  const lignes = [COLONNES_EXPORT.slice()]

  releves.forEach(r => {
    if (!r) return
    lignes.push([
      (r.entreprises && r.entreprises.nom) || r.entreprise_id || '',
      r.periode || '',
      r.plan || '',
      Number(r.utilisateurs || 0),
      r.inclus == null ? '' : Number(r.inclus),
      Number(r.surplus || 0),
      r.prix_base == null ? '' : Number(r.prix_base),
      r.supplement == null ? '' : Number(r.supplement),
      // Sur devis : pas de montant. Une case vide dit « a etablir » ;
      // un zero dirait « rien a payer », ce qui est faux.
      r.prix_total == null ? '' : Number(r.prix_total),
      r.sur_devis ? 'oui' : 'non',
    ])
  })

  // Ligne de total, seulement s'il y a quelque chose a totaliser. Elle
  // n'additionne que les montants reels : les entreprises sur devis en
  // sont absentes, comme dans totauxFacturation.
  if (releves.length > 0) {
    const total = releves.reduce((s, r) => s + (r && r.prix_total != null ? Number(r.prix_total) : 0), 0)
    lignes.push([])
    lignes.push(['TOTAL', '', '', '', '', '', '', '', total, ''])
  }

  return lignes
}

export function nomFichierExport(periode) {
  return 'facturation-velor-one-' + String(periode || '').slice(0, 7) + '.xlsx'
}
