// src/lib/erreurSuppressionMembre.js
// =====================================================================
// Un seul message, quel que soit l'ecran.
//
// La suppression d'un compte passait par DEUX chemins : une fonction
// serveur cote client, une fonction en base cote Super Admin. Deux codes,
// deux listes de nettoyage, deux facons d'echouer -- et de fait, elles ont
// echoue separement, a un jour d'intervalle, pour des raisons differentes.
//
// Tout passe desormais par supprimer_membre_complet, qui fait le travail
// en UNE transaction. Ce fichier traduit ce qu'elle renvoie.
//
// Les motifs sont ceux que la fonction leve elle-meme (RAISE EXCEPTION),
// plus le refus d'une cle etrangere quand une table retient encore la
// personne.
// =====================================================================

const MOTIFS = {
  authentication_required: 'Votre session a expire. Reconnectez-vous.',
  caller_profile_missing: 'Votre propre profil est introuvable. Reconnectez-vous.',
  target_profile_missing: "Ce compte n'existe plus. Rafraichissez la page.",
  protected_super_admin: 'Ce compte Super Admin est protege : il ne peut pas etre supprime.',
  forbidden: "Vous n'avez pas le droit de supprimer ce compte.",
  forbidden_cross_enterprise: 'Ce compte appartient a une autre entreprise.',
}

// Postgres nomme la table qui retient la ligne ; on la garde plutot que de
// dire "des donnees liees" sans preciser lesquelles.
function detailDependance(brut) {
  const table = brut.match(/on table "([^"]+)"/i)
  const contrainte = brut.match(/constraint "([^"]+)"/i)
  if (!table) return null
  return 'Suppression bloquee : des donnees liees subsistent dans « ' + table[1] + ' »'
    + (contrainte ? ' (contrainte ' + contrainte[1] + ').' : '.')
}

export function messageSuppressionMembre(erreur, secours = 'Suppression impossible.') {
  if (!erreur) return secours

  const brut = String(erreur.message || erreur || '')
  const minuscule = brut.toLowerCase()

  // Du plus long au plus court : "forbidden_cross_enterprise" contient
  // "forbidden", et chercher dans l'ordre de declaration donnerait le
  // mauvais message -- juste par hasard, et faux des qu'on ajoute un motif.
  const code = Object.keys(MOTIFS)
    .sort((a, b) => b.length - a.length)
    .find(c => minuscule.includes(c))
  if (code) return MOTIFS[code]

  if (minuscule.includes('foreign key') || minuscule.includes('violates')) {
    return detailDependance(brut) || 'Suppression bloquee : des donnees liees subsistent.'
  }

  if (minuscule.includes('failed to fetch') || minuscule.includes('networkerror')) {
    return "Le serveur n'a pas repondu. Rien n'a ete supprime, vous pouvez reessayer."
  }

  return brut || secours
}
