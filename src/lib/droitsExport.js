// src/lib/droitsExport.js
// =====================================================================
// QUI PEUT SORTIR UN FICHIER DE L'APPLICATION.
//
// UNE SEULE REGLE, POUR TOUTE L'APPLICATION ET POUR TOUTES LES OFFRES.
//
//   Un salarie n'exporte RIEN. Ni les heures de l'equipe, ni les
//   siennes, ni quoi que ce soit d'autre, quelle que soit l'offre
//   souscrite par son entreprise. S'il veut son releve par ecrit, il le
//   demande a son responsable, qui l'exporte et le lui envoie.
//
// CE QUE CETTE FONCTION NE REGARDE PAS, ET POURQUOI
//
//   Elle ne prend ni le plan, ni l'offre, ni les modules actifs, ni un
//   objet `permissions` fabrique par l'appelant. Uniquement le PROFIL.
//
//   L'offre decide de ce que l'entreprise ACHETE -- quels modules
//   existent, combien d'utilisateurs. Elle ne decide pas de qui, dans
//   l'entreprise, a le droit de sortir une piece qui sert de preuve
//   d'heures. Les deux questions n'ont aucun rapport, et les melanger
//   creerait ce qu'on veut justement eviter : une offre premium qui,
//   sans que personne l'ait voulu, ouvrirait l'export aux salaries.
//
//   Un objet `permissions` recu en props est ecarte pour la meme raison.
//   Il est fabrique ailleurs, il peut changer, et le jour ou il
//   dependrait de l'offre, l'export suivrait sans un mot.
//
// LE SUPER ADMIN PASSE PAR is_super_admin
//
//   Il n'a jamais role = 'super_admin' : il porte is_super_admin = true,
//   et sa colonne role vaut celle de l'entreprise qu'il consulte par le
//   contexte -- souvent 'employe'. En lisant la seule colonne role, il
//   perdrait l'export en entrant dans une entreprise.
//
// UN BOUTON DESACTIVE N'EST PAS UN REFUS
//
//   `disabled` est un attribut du DOM ; on l'enleve en trois secondes.
//   Le refus appartient a la FONCTION qui exporte, pas au bouton qui
//   l'appelle. Chaque point d'export appelle donc peutExporter() dans
//   son corps, et pas seulement pour griser un bouton.
// =====================================================================

/** Les roles qui peuvent sortir un fichier. Volontairement court. */
export const ROLES_EXPORT = ['responsable', 'admin']

/**
 * @param {object|null} profile le profil de la personne connectee
 * @returns {boolean} vrai si elle peut exporter -- quelle que soit l'offre
 */
export function peutExporter(profile) {
  if (!profile) return false
  // Exactement true : une chaine 'false' ou un 1 ne sont pas un droit.
  if (profile.is_super_admin === true) return true
  return ROLES_EXPORT.includes(profile.role)
}

/** Le message a afficher a qui n'a pas le droit. Un seul, partout. */
export const MESSAGE_EXPORT_REFUSE = 'Reserve aux responsables. Demandez-leur le fichier, ils peuvent vous l’envoyer.'
