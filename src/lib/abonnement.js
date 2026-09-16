// src/lib/abonnement.js
// =====================================================================
// Etat de fin d'abonnement, cote client.
//
// Regle produit :
//   abonnement_recurrent coche   -> la date avance d'un mois toute seule
//                                   (job pg_cron renouveler_abonnements),
//                                   le client n'a rien a anticiper
//   decoche                      -> la date est ferme. Le jour ou elle
//                                   passe, l'espace bascule en lecture
//                                   seule. C'est la qu'il faut prevenir.
//
// On previent a partir de 5 jours restants, et on continue apres
// l'echeance : une alerte qui disparait au moment ou la situation devient
// la pire serait absurde.
// =====================================================================

export const SEUIL_ALERTE_JOURS = 5

export function etatFinAbonnement(entreprise, maintenant = new Date()) {
  if (!entreprise) return null
  if (entreprise.abonnement_recurrent) return null
  if (!entreprise.date_fin_abonnement) return null

  const fin = new Date(entreprise.date_fin_abonnement)
  if (Number.isNaN(fin.getTime())) return null

  // Decompte en jours pleins : une echeance ce soir affiche "aujourd'hui",
  // pas "dans 0 jour".
  const jours = Math.ceil((fin - maintenant) / 86400000)

  if (jours <= 0) return { niveau: 'expire', jours, fin }
  if (jours <= SEUIL_ALERTE_JOURS) return { niveau: 'alerte', jours, fin }
  return null
}

export function texteDecompte(etat) {
  if (!etat) return ''
  if (etat.niveau === 'expire') return 'Echu'
  if (etat.jours === 1) return 'Dernier jour'
  return 'J-' + etat.jours
}
