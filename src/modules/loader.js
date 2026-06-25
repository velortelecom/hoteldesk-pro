// src/modules/loader.js
// SYSTEME DE CHARGEMENT DES MODULES - Plugin Loader
// Pont entre le registre (registry.js), la BDD (entreprise_modules) et l'UI (App.jsx)
// Ce module est le seul a connaitre les deux sources de verite :
//   1. Le registre local (ce qui PEUT exister)
//   2. La BDD (ce qui EST ACTIVE pour cette entreprise)

import { MODULES_REGISTRY, getModuleById, getPermissions, checkPermission } from './registry.js'

// ===========================================================
// TYPES (documentation du contrat de donnees)
// ===========================================================
// ModuleCharge = {
//   id:          string
//   nom:         string
//   icone:       string
//   route:       string
//   composant:   React.lazy component
//   permissions: object (pour le role courant)
//   couleur:     string
//   badge:       string|null
//   ordre:       number
//   categorie:   string
//   description: string
//   widgets:     object|null
// }

// ===========================================================
// FONCTION PRINCIPALE : construire les modules charges
// A partir de : modules BDD actifs + registre local
// ===========================================================
export function buildLoadedModules(modulesActifsBDD, profile) {
  if (!modulesActifsBDD || !profile) return []

  const role = profile.role || 'employe'
  const isSuperAdmin = profile.is_super_admin === true

  // super_admin voit tout le catalogue
  if (isSuperAdmin) {
    return MODULES_REGISTRY
      .filter(m => m.actif)
      .sort((a, b) => a.ordre - b.ordre)
      .map(m => ({
        id: m.id,
        nom: m.nom,
        icone: m.icone,
        route: m.route,
        composant: m.composant,
        permissions: getPermissions(m.id, 'admin'), // super_admin = admin complet
        couleur: m.couleur,
        badge: m.badge,
        ordre: m.ordre,
        categorie: m.categorie,
        description: m.description,
        widgets: m.widgets,
      }))
  }

  // Utilisateur normal : croisement BDD actifs + registre
  const loaded = []
  for (const modBDD of modulesActifsBDD) {
    if (!modBDD.actif) continue
    const moduleId = modBDD.module_id || modBDD.id
    const modRegistre = getModuleById(moduleId)

    // Le module existe dans la BDD mais pas (encore) dans le registre local : ignore
    if (!modRegistre || !modRegistre.actif) continue

    // Verifier la permission 'voir' pour ce role
    const peutVoir = checkPermission(moduleId, role, 'voir')
    if (!peutVoir && role === 'employe') continue // employe sans permission voir : cache

    loaded.push({
      id: modRegistre.id,
      nom: modRegistre.nom,
      icone: modRegistre.icone,
      route: modRegistre.route,
      composant: modRegistre.composant,
      permissions: getPermissions(moduleId, role),
      couleur: modRegistre.couleur,
      badge: modRegistre.badge,
      ordre: modRegistre.ordre,
      categorie: modRegistre.categorie,
      description: modRegistre.description,
      widgets: modRegistre.widgets,
    })
  }

  return loaded.sort((a, b) => a.ordre - b.ordre)
}

// ===========================================================
// GENERATION DE LA NAVIGATION
// A partir des modules charges, genere les items de nav
// ===========================================================
export function buildNavItems(modulesCharges) {
  return modulesCharges.map(m => ({
    id: m.id,
    label: m.nom,
    icone: m.icone,
    route: m.route,
    couleur: m.couleur,
    badge: m.badge,
    categorie: m.categorie,
    isModule: true,
  }))
}

// ===========================================================
// GENERATION DES ROUTES
// Retourne un map id -> composant pour le rendu
// ===========================================================
export function buildRouteMap(modulesCharges) {
  const map = {}
  for (const m of modulesCharges) {
    map[m.id] = {
      composant: m.composant,
      permissions: m.permissions,
      description: m.description,
      nom: m.nom,
      icone: m.icone,
    }
  }
  return map
}

// ===========================================================
// VERIFICATION D'ACCES A UNE ROUTE
// ===========================================================
export function canAccessRoute(moduleId, modulesCharges) {
  return modulesCharges.some(m => m.id === moduleId)
}

// ===========================================================
// WIDGETS : recuperer les widgets des modules actifs
// ===========================================================
export function buildWidgetList(modulesCharges) {
  const widgets = []
  for (const m of modulesCharges) {
    if (!m.widgets) continue
    Object.entries(m.widgets).forEach(([type, enabled]) => {
      if (enabled) {
        widgets.push({
          moduleId: m.id,
          moduleName: m.nom,
          moduleColor: m.couleur,
          type,
        })
      }
    })
  }
  return widgets
}

// ===========================================================
// IDS DES MODULES ACTIFS
// ===========================================================
export function getActiveModuleIds(modulesCharges) {
  return modulesCharges.map(m => m.id)
}

// ===========================================================
// INFORMATIONS DE DEBUG
// ===========================================================
export function getLoaderInfo(modulesCharges) {
  return {
    total: modulesCharges.length,
    categories: [...new Set(modulesCharges.map(m => m.categorie))],
    ids: modulesCharges.map(m => m.id),
  }
}
