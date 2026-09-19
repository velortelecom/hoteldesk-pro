// src/lib/modulesDeveloppes.js
// =====================================================================
// Quels modules existent VRAIMENT, par opposition a ceux qui n'ont
// qu'une entree dans le registre.
//
// Dans src/modules/registry.js, un module reel importe son composant :
//     composant: lazy(() => import('./conges/index.jsx'))
// tandis qu'un module pas encore ecrit passe par un squelette :
//     composant: lazy(() => Promise.resolve({ default: createModuleSquelette('stocks') }))
//
// Cette liste est donc une verite qui se perime : le jour ou un module
// est ecrit, il faut l'ajouter ici. src/lib/modulesDeveloppes.test.js lit
// le registre et fait echouer la suite si les deux divergent -- on ne
// depend pas de la vigilance de qui que ce soit.
// =====================================================================

export const MODULES_DEVELOPPES = ['organisation', 'pointage', 'conges', 'gps']

export function estModuleDeveloppe(moduleId) {
  return MODULES_DEVELOPPES.indexOf(moduleId) !== -1
}
