// src/lib/recurrence.js
// =====================================================================
// Une tache recurrente se produit-elle un jour donne ?
//
// La recurrence etait stockee (recurrence_type, recurrence_fin) et
// exploitee par les rappels, mais le planning comparait simplement
// date_echeance au jour affiche : une tache quotidienne n'y apparaissait
// qu'une seule fois, le jour de sa creation.
//
// On repond par un predicat plutot que d'enumerer les occurrences : le
// calendrier interroge un jour a la fois, et une tache quotidienne sans
// date de fin generait sinon une liste sans borne.
//
// Limite assumee : une occurrence deplacee ou supprimee individuellement
// n'existe pas. Le modele ne stocke pas d'exceptions, donc toutes les
// occurrences d'une serie sont identiques.
// =====================================================================

export const RECURRENCES = ['quotidienne', 'hebdomadaire', 'mensuelle', 'annuelle']

function memeJour(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function minuit(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function joursDansLeMois(annee, mois) {
  return new Date(annee, mois + 1, 0).getDate()
}

// Le 31 tombe-t-il ce mois-ci ? Sinon on rattache l'occurrence au dernier
// jour du mois : sans ca, une tache mensuelle du 31 disparaitrait en
// fevrier, avril, juin, septembre et novembre.
function jourDuMoisCorrespond(jour, jourVise) {
  if (jour.getDate() === jourVise) return true
  const dernier = joursDansLeMois(jour.getFullYear(), jour.getMonth())
  return jourVise > dernier && jour.getDate() === dernier
}

export function seProduitLe(tache, jour) {
  if (!tache || !tache.date_echeance || !jour) return false

  const debut = minuit(new Date(tache.date_echeance))
  if (Number.isNaN(debut.getTime())) return false
  const cible = minuit(jour)

  const type = tache.recurrence_type
  if (!type || RECURRENCES.indexOf(type) === -1) {
    return memeJour(debut, cible)
  }

  // Jamais avant la premiere occurrence.
  if (cible < debut) return false

  if (tache.recurrence_fin) {
    const fin = minuit(new Date(tache.recurrence_fin))
    if (!Number.isNaN(fin.getTime()) && cible > fin) return false
  }

  if (type === 'quotidienne') return true
  if (type === 'hebdomadaire') return cible.getDay() === debut.getDay()
  if (type === 'mensuelle') return jourDuMoisCorrespond(cible, debut.getDate())
  if (type === 'annuelle') {
    return cible.getMonth() === debut.getMonth() && jourDuMoisCorrespond(cible, debut.getDate())
  }

  return false
}

// Vrai si la tache affichee ce jour-la est une repetition, pas l'originale.
export function estRepetition(tache, jour) {
  if (!tache || !tache.recurrence_type || !tache.date_echeance || !jour) return false
  return !memeJour(minuit(new Date(tache.date_echeance)), minuit(jour))
}
