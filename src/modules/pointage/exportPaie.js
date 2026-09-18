// src/modules/pointage/exportPaie.js
// =====================================================================
// LE FICHIER QU'ON DONNE AU COMPTABLE.
//
// C'est le bout de la chaine : des pointages, des journees, et enfin un
// classeur qu'on envoie en paie. Tout ce qui precede n'a de valeur que
// s'il aboutit ici.
//
// DEUX REGLES, ET ELLES COMPTENT PLUS QUE LE RESTE
//
//   1. UNE JOURNEE INCOMPLETE NE VAUT PAS ZERO HEURE.
//      Elle apparait dans le detail, sans duree, avec la raison. Et le
//      recapitulatif annonce combien de journees n'ont pas pu etre
//      calculees. Un total qui les avale en silence est un total faux
//      dont rien ne dit qu'il est faux -- et c'est un salarie qui sera
//      paye en moins sans que personne s'en apercoive.
//
//   2. LES HEURES SORTENT EN NOMBRES, PAS EN TEXTE.
//      « 7h30 » est lisible mais inadditionnable. On sort donc une
//      colonne d'heures decimales (7,5) que le comptable additionne
//      directement, ET une colonne lisible a cote. Les deux disent la
//      meme chose ; seule la premiere sert a calculer.
// =====================================================================
import { construireJournees, formaterDuree, LIBELLES_ANOMALIES } from './journees.js'

export const COLONNES_PAIE = [
  'Salarie', 'Date', 'Arrivee', 'Depart', 'Pause', 'Heures', 'Heures (h:min)', 'Etat',
]

export const LARGEURS_PAIE = [24, 12, 10, 10, 10, 10, 14, 44]

/** Minutes -> heures decimales, arrondies au centieme. */
export function heuresDecimales(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return null
  return Math.round((Number(minutes) / 60) * 100) / 100
}

function jjmmaaaa(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return String(d.getDate()).padStart(2, '0')
    + '/' + String(d.getMonth() + 1).padStart(2, '0')
    + '/' + d.getFullYear()
}

function hhmm(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/**
 * Regroupe les journees par salarie, avec le total de chacun.
 *
 * Le total ne compte QUE les journees completes, et le nombre de
 * journees ecartees est renvoye a cote -- pas noye dedans.
 */
export function recapitulerParSalarie(journees = [], nomsParProfil = {}) {
  const parProfil = new Map()

  journees.forEach(j => {
    if (!j) return
    if (!parProfil.has(j.profileId)) {
      parProfil.set(j.profileId, {
        profileId: j.profileId,
        nom: nomsParProfil[j.profileId] || j.profileId,
        journees: [],
        minutes: 0,
        joursComptes: 0,
        joursNonCalcules: 0,
      })
    }
    const entree = parProfil.get(j.profileId)
    entree.journees.push(j)

    if (j.complete && j.minutesTravaillees != null) {
      entree.minutes += j.minutesTravaillees
      entree.joursComptes += 1
    } else {
      entree.joursNonCalcules += 1
    }
  })

  return [...parProfil.values()]
    .map(e => ({
      ...e,
      journees: e.journees.slice().sort((a, b) => {
        const da = a.debut || a.fin
        const db = b.debut || b.fin
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0)
      }),
      heures: heuresDecimales(e.minutes),
    }))
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'))
}

/**
 * Les lignes du classeur de paie.
 *
 * Detail par salarie, un sous-total apres chacun, un total general a la
 * fin. Les journees non calculees sont VISIBLES, avec leur raison.
 */
export function construireLignesPaie(journees = [], nomsParProfil = {}) {
  const lignes = [COLONNES_PAIE.slice()]
  const salaries = recapitulerParSalarie(journees, nomsParProfil)

  salaries.forEach((salarie, index) => {
    if (index > 0) lignes.push([])

    salarie.journees.forEach(j => {
      const calculable = j.complete && j.minutesTravaillees != null
      lignes.push([
        salarie.nom,
        jjmmaaaa(j.debut || j.fin),
        hhmm(j.debut),
        hhmm(j.fin),
        j.minutesPause > 0 ? formaterDuree(j.minutesPause) : '',
        // Case VIDE si la journee n'est pas calculable. Surtout pas 0 :
        // un zero se paie zero.
        calculable ? heuresDecimales(j.minutesTravaillees) : '',
        calculable ? formaterDuree(j.minutesTravaillees) : '',
        calculable
          ? ''
          : (j.anomalies || []).map(code => LIBELLES_ANOMALIES[code] || code).join(' ; '),
      ])
    })

    lignes.push([
      'TOTAL ' + salarie.nom, '', '', '', '',
      salarie.heures,
      formaterDuree(salarie.minutes),
      salarie.joursNonCalcules > 0
        ? salarie.joursNonCalcules + ' journee(s) non calculee(s), a corriger avant paie'
        : '',
    ])
  })

  if (salaries.length > 0) {
    const minutes = salaries.reduce((s, x) => s + x.minutes, 0)
    const nonCalculees = salaries.reduce((s, x) => s + x.joursNonCalcules, 0)
    lignes.push([])
    lignes.push([
      'TOTAL GENERAL', '', '', '', '',
      heuresDecimales(minutes),
      formaterDuree(minutes),
      nonCalculees > 0
        ? nonCalculees + ' journee(s) non calculee(s) ne sont PAS dans ce total'
        : '',
    ])
  }

  return lignes
}

/** AAAA-MM -> « mars 2026 », pour le nom d'onglet et le fichier. */
const MOIS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

export function libelleMois(periode) {
  const bouts = String(periode || '').split('-')
  if (bouts.length < 2) return String(periode || '')
  return (MOIS[Number(bouts[1]) - 1] || bouts[1]) + ' ' + bouts[0]
}

export function nomFichierPaie(periode) {
  return 'heures-' + String(periode || '').slice(0, 7) + '.xlsx'
}

/**
 * Bornes d'un mois, en heure locale.
 *
 * On prend le mois entier, du 1er a 00:00 au 1er du mois suivant. Les
 * bornes sont locales et non UTC : sinon une arrivee a 23h30 le 31 mars
 * basculerait sur avril.
 */
export function bornesMois(periode) {
  const bouts = String(periode || '').split('-')
  const annee = Number(bouts[0])
  const mois = Number(bouts[1])
  if (!Number.isFinite(annee) || !Number.isFinite(mois)) return null
  return {
    debut: new Date(annee, mois - 1, 1, 0, 0, 0, 0),
    fin: new Date(annee, mois, 1, 0, 0, 0, 0),
  }
}

/**
 * Journees d'un mois, a partir des evenements bruts.
 *
 * Le filtrage se fait sur la journee CONSTRUITE, pas sur chaque
 * evenement : une nuit du 31 mars au 1er avril appartient a mars, parce
 * qu'elle est ancree sur son arrivee. Filtrer les evenements couperait
 * cette nuit en deux et la paierait dans deux mois differents.
 */
export function journeesDuMois(evenements = [], periode) {
  const bornes = bornesMois(periode)
  if (!bornes) return []

  return construireJournees(evenements).filter(j => {
    const ancre = j.debut || j.fin
    return ancre && ancre >= bornes.debut && ancre < bornes.fin
  })
}
