// src/lib/menus.js
// =====================================================================
// Onglets visibles par employe.
//
// Jusqu'ici la visibilite etait GLOBALE : un onglet s'affichait si le
// module etait actif pour l'entreprise et si le role avait la permission
// 'voir' dans le registre. Tous les employes d'une entreprise voyaient
// donc exactement la meme chose, et 'organisation' (RH) etant ouvert au
// role employe, tout le monde y avait acces.
//
// profiles.menus_autorises porte desormais une liste blanche par
// personne. Deux regles :
//
//   NULL ou liste vide  -> aucune restriction, comportement d'avant
//   liste               -> seuls ces onglets restent
//
// La liste ne peut que RESTREINDRE. On l'applique en filtrant la
// navigation deja calculee, jamais en y ajoutant : impossible d'accorder
// ainsi un module que l'entreprise n'a pas active, ou un onglet Super
// Admin a quelqu'un qui ne l'est pas.
// =====================================================================

// L'accueil reste joignable meme hors liste : c'est la page de repli quand
// une restriction laisse l'utilisateur sans onglet du tout.
export const MENU_ACCUEIL = 'dashboard'

export function aUneRestriction(menusAutorises) {
  return Array.isArray(menusAutorises) && menusAutorises.length > 0
}

export function filtrerMenus(navItems, menusAutorises) {
  if (!Array.isArray(navItems)) return []
  if (!aUneRestriction(menusAutorises)) return navItems

  const permis = new Set(menusAutorises)
  const filtres = navItems.filter(item => item && permis.has(item.id))

  // Une liste qui ne laisse rien -- onglets renommes, modules desactives
  // depuis -- enfermerait l'employe sur un ecran vide. On lui rend au
  // moins l'accueil.
  if (filtres.length === 0) {
    const accueil = navItems.find(item => item && item.id === MENU_ACCUEIL)
    return accueil ? [accueil] : []
  }

  return filtres
}

// Sur quelle page ouvrir l'application pour cette personne.
export function pageParDefaut(navItems, menusAutorises) {
  const visibles = filtrerMenus(navItems, menusAutorises)
  if (visibles.some(item => item.id === MENU_ACCUEIL)) return MENU_ACCUEIL
  return visibles.length > 0 ? visibles[0].id : MENU_ACCUEIL
}

// La page demandee est-elle encore autorisee ? Sert a rediriger quelqu'un
// qui garde une ancienne page en memoire, ou dont les droits ont change.
export function pageAutorisee(page, navItems, menusAutorises) {
  if (!aUneRestriction(menusAutorises)) return true
  return filtrerMenus(navItems, menusAutorises).some(item => item.id === page)
}
