// src/lib/profilPayload.js
// =====================================================================
// Un champ de formulaire vide vaut "", pas NULL.
//
// La fiche employe initialise ses champs avec `valeur || ''`, ce qui est
// juste pour un <input> mais faux pour la base : Postgres refuse une
// chaine vide dans une colonne date ou uuid.
//
//   invalid input syntax for type date: ""
//   invalid input syntax for type uuid: ""
//
// Concretement, enregistrer une fiche sans date d'entree faisait echouer
// TOUTE la sauvegarde -- y compris l'affectation aux departements, qui
// n'a pourtant rien a voir. C'est ce qui donnait l'impression que les
// departements ne marchaient pas.
//
// On ne traite QUE les colonnes ou "" est invalide pour la base. Les
// champs texte gardent leur chaine vide : la transformer en NULL
// changerait leur sens sans qu'on l'ait demande.
// =====================================================================

export const CHAMPS_VIDE_INTERDIT = [
  'date_entree',
  'date_sortie',
  'date_naissance',
  'poste_id',
  'poste_secondaire_id',
  'site_id',
  'departement_id',
  'entreprise_id',
]

export function normaliserPayloadProfil(payload) {
  if (!payload || typeof payload !== 'object') return payload

  const sortie = { ...payload }
  CHAMPS_VIDE_INTERDIT.forEach((champ) => {
    if (champ in sortie && typeof sortie[champ] === 'string' && sortie[champ].trim() === '') {
      sortie[champ] = null
    }
  })
  return sortie
}
