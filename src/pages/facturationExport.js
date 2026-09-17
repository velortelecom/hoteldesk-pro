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
import { getOffre, PLAFOND_FORFAIT } from '../lib/offres'

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

// =====================================================================
// DETAIL D'UNE SEULE ENTREPRISE
//
// Le tableau donne un total par entreprise ; ce n'est pas suffisant le
// jour ou un client appelle en disant « je ne suis que dix ». Il faut
// pouvoir montrer QUI est compte, et pourquoi les autres ne le sont pas.
// C'est la seule chose qui rende le chiffre defendable.
// =====================================================================

/** Nom commercial d'une formule, ou l'identifiant a defaut. */
export function nomFormule(planId) {
  const offre = getOffre(planId)
  return offre ? offre.nom : (planId || '—')
}

/**
 * Separe les comptes factures de ceux qui ne le sont pas, avec la
 * RAISON. La regle est celle de utilisateurs_factures() en base : profil
 * actif, super admin exclu.
 *
 * On renvoie aussi les exclus : une liste qui montre seulement les
 * comptes factures ne permet pas de repondre a « et Untel, il compte ? ».
 */
export function repartirUtilisateurs(profils = []) {
  const comptes = []
  const exclus = []

  profils.forEach(p => {
    if (!p) return
    if (p.is_super_admin === true) {
      exclus.push({ profil: p, raison: 'compte de supervision Velor' })
      return
    }
    if (p.actif === false) {
      exclus.push({ profil: p, raison: 'compte desactive' })
      return
    }
    comptes.push(p)
  })

  return { comptes, exclus }
}

/**
 * Les lignes de la facture, telles qu'on les montrerait au client.
 *
 * Aucun calcul : les montants viennent de etat_facturation(). On ne fait
 * que les mettre en phrases -- si un chiffre est faux, il est faux en
 * base, et on le verra au meme endroit que le client.
 */
export function lignesFacture(etat) {
  if (!etat) return []

  const lignes = []
  const inclus = etat.inclus == null ? null : Number(etat.inclus)
  const surplus = Number(etat.surplus || 0)
  const unitaire = etat.prix_utilisateur_sup == null ? null : Number(etat.prix_utilisateur_sup)

  lignes.push({
    cle: 'forfait',
    libelle: 'Forfait ' + nomFormule(etat.plan)
      + (inclus != null ? ' — jusqu’a ' + inclus + ' utilisateurs' : ''),
    montant: etat.prix_base == null ? null : Number(etat.prix_base),
  })

  if (surplus > 0 && Number(etat.supplement || 0) > 0) {
    lignes.push({
      cle: 'debordement',
      libelle: surplus + ' utilisateur' + (surplus > 1 ? 's' : '') + ' au-dela du forfait'
        + (unitaire != null ? ' × ' + euros(unitaire) : ''),
      montant: Number(etat.supplement),
    })
  }

  if (etat.sur_devis) {
    lignes.push({
      cle: 'devis',
      libelle: 'Au-dela de ' + PLAFOND_FORFAIT + ' utilisateurs : montant a etablir par devis',
      montant: null,
    })
  } else if (surplus > 0 && Number(etat.supplement || 0) === 0) {
    // Plan gratuit depasse : le plafond est un vrai plafond.
    lignes.push({
      cle: 'passage',
      libelle: 'Formule depassee de ' + surplus + ' utilisateur' + (surplus > 1 ? 's' : '')
        + ' : passage a une formule payante necessaire',
      montant: null,
    })
  }

  lignes.push({
    cle: 'total',
    libelle: 'Total du ce mois-ci',
    montant: etat.prix_total == null ? null : Number(etat.prix_total),
    total: true,
  })

  return lignes
}

export const COLONNES_EXPORT_ENTREPRISE = [
  'Periode', 'Plan', 'Utilisateurs factures', 'Inclus dans la formule',
  'Au-dela du forfait', 'Prix de base', 'Supplement', 'Total facture', 'Sur devis',
]

export const LARGEURS_EXPORT_ENTREPRISE = [12, 12, 20, 22, 19, 13, 12, 15, 10]

/**
 * Historique facture d'UNE entreprise, mois par mois.
 *
 * C'est ce qu'on envoie a un client qui demande un recapitulatif, ou
 * qu'on garde quand il conteste : chaque ligne est un releve fige, donc
 * un montant qui n'a pas bouge depuis le jour ou on l'a arrete.
 */
export function construireLignesExportEntreprise(releves = []) {
  const lignes = [COLONNES_EXPORT_ENTREPRISE.slice()]
  const tries = releves.slice().sort((a, b) => String(a.periode).localeCompare(String(b.periode)))

  tries.forEach(r => {
    if (!r) return
    lignes.push([
      r.periode || '',
      r.plan || '',
      Number(r.utilisateurs || 0),
      r.inclus == null ? '' : Number(r.inclus),
      Number(r.surplus || 0),
      r.prix_base == null ? '' : Number(r.prix_base),
      r.supplement == null ? '' : Number(r.supplement),
      r.prix_total == null ? '' : Number(r.prix_total),
      r.sur_devis ? 'oui' : 'non',
    ])
  })

  if (tries.length > 0) {
    const total = tries.reduce((s, r) => s + (r && r.prix_total != null ? Number(r.prix_total) : 0), 0)
    lignes.push([])
    lignes.push(['TOTAL', '', '', '', '', '', '', total, ''])
  }

  return lignes
}

export function nomFichierExportEntreprise(nomEntreprise) {
  const base = String(nomEntreprise || 'entreprise')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return 'facturation-' + (base || 'entreprise') + '.xlsx'
}
