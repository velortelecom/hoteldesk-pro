// src/lib/modules.js
// Registre des modules Velor One V4
// Plans, secteurs, SOCLE_MENUS (avec emojis), MODULE_ROUTES
import { OFFRES, ORDRE_OFFRES } from './offres'

// PLANS et PLAN_ORDER ne sont plus ecrits ici : ils DERIVENT de la grille
// commerciale (src/lib/offres.js), seule source de verite depuis qu'on a
// constate que les packs etaient definis a quatre endroits divergents.
// La forme des objets est conservee telle quelle pour ne rien casser chez
// les appelants (Offres.jsx, SuperAdmin.jsx, useModules...).
export const PLANS = OFFRES.reduce((acc, offre) => {
  acc[offre.id] = {
    id: offre.id,
    nom: offre.nom,
    prix: offre.prix,
    max_utilisateurs: offre.maxUtilisateurs,
    description: offre.resume,
    couleur: offre.couleur,
    debordement: offre.debordement,
  }
  return acc
}, {})

export const PLAN_ORDER = ORDRE_OFFRES

// planAllows() a ete SUPPRIME.
//   Il decidait si le plan d'une entreprise autorisait un module. Il
//   n'etait plus appele par personne, et surtout il etait devenu FAUX :
//   l'acces a un module vient de entreprise_modules, pas du plan. Le garder
//   c'etait laisser une deuxieme regle d'acces dormir dans le code, prete a
//   contredire la vraie le jour ou quelqu'un la rebrancherait.

// Menus du socle - INALTERABLES - toujours presents dans tous les plans
// icone = emoji directement affiche dans la nav
export const SOCLE_MENUS = [
  { id: 'dashboard',  label: 'Accueil',   nom: 'Accueil',   path: '/',         icone: '🏠' },
  { id: 'planning',   label: 'Planning',  nom: 'Planning',  path: '/planning', icone: '📅' },
  { id: 'taches',     label: 'Taches',    nom: 'Taches',    path: '/taches',   icone: '✅' },
  { id: 'messagerie', label: 'Messages',  nom: 'Messages',  path: '/messages', icone: '💬' },
  { id: 'rappels',    label: 'Rappels',   nom: 'Rappels',   path: '/rappels',  icone: '🔔' },
]

// Mapping module_id -> route frontend
export const MODULE_ROUTES = {
  organisation:   '/organisation',
  pointage:       '/pointage',
  conges:         '/conges',
  gps:            '/gps',
  documents:      '/documents',
  vehicules:      '/vehicules',
  ia:             '/ia',
  stocks:         '/stocks',
  facturation:    '/facturation',
  reservations:   '/reservations',
  clients:        '/clients',
  qualite:        '/qualite',
  formations:     '/formations',
  securite:       '/securite',
  rapports:       '/rapports',
  planning_avance: '/planning-avance',
  multi_sites:    '/multi-sites',
  api:            '/api-config',
  white_label:    '/white-label',
}

