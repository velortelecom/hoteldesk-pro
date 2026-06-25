// src/lib/modules.js
// Registre des modules Velor One V4
// Plans, secteurs, SOCLE_MENUS (avec emojis), MODULE_ROUTES

export const PLANS = {
  starter:    { id: 'starter',    nom: 'Starter',    prix: 29,   max_utilisateurs: 10,  description: 'Ideal pour les petites structures',         couleur: '#6B7280' },
  business:   { id: 'business',   nom: 'Business',   prix: 79,   max_utilisateurs: 50,  description: 'Pour les entreprises en croissance',        couleur: '#3B82F6' },
  premium:    { id: 'premium',    nom: 'Premium',    prix: 199,  max_utilisateurs: 200, description: 'Fonctionnalites avancees et multi-sites',   couleur: '#8B5CF6' },
  enterprise: { id: 'enterprise', nom: 'Enterprise', prix: null, max_utilisateurs: null, description: 'Sur mesure, illimite, white-label',         couleur: '#F59E0B' },
}

export const PLAN_ORDER = ['starter', 'business', 'premium', 'enterprise']

export function planAllows(planEntreprise, planMinimumModule) {
  const idx1 = PLAN_ORDER.indexOf(planEntreprise)
  const idx2 = PLAN_ORDER.indexOf(planMinimumModule)
  return idx1 >= idx2
}

// Menus du socle - INALTERABLES - toujours presents dans tous les plans
// icone = emoji directement affiche dans la nav
export const SOCLE_MENUS = [
  { id: 'dashboard',  label: 'Accueil',  nom: 'Accueil',  path: '/',         icone: '🏠' },
  { id: 'planning',   label: 'Planning', nom: 'Planning', path: '/planning', icone: '📅' },
  { id: 'taches',     label: 'Taches',   nom: 'Taches',   path: '/taches',   icone: '✅' },
  { id: 'messagerie', label: 'Messages', nom: 'Messages', path: '/messages', icone: '💬' },
  { id: 'rappels',    label: 'Rappels',  nom: 'Rappels',  path: '/rappels',  icone: '🔔' },
  { id: 'personnel',  label: 'Equipe',   nom: 'Equipe',   path: '/equipe',   icone: '👥' },
]

// Mapping module_id -> route frontend
export const MODULE_ROUTES = {
  conges:          '/conges',
  gps:             '/gps',
  documents:       '/documents',
  vehicules:       '/vehicules',
  ia:              '/ia',
  stocks:          '/stocks',
  facturation:     '/facturation',
  reservations:    '/reservations',
  clients:         '/clients',
  qualite:         '/qualite',
  formations:      '/formations',
  securite:        '/securite',
  rapports:        '/rapports',
  planning_avance: '/planning-avance',
  multi_sites:     '/multi-sites',
  api:             '/api-config',
  white_label:     '/white-label',
}

export const SECTEURS = [
  { id: 'hotel',        nom: 'Hotel & Hebergement' },
  { id: 'restaurant',   nom: 'Restauration' },
  { id: 'sante',        nom: 'EHPAD & Sante' },
  { id: 'btp',          nom: 'BTP & Construction' },
  { id: 'commerce',     nom: 'Commerce & Retail' },
  { id: 'pharmacie',    nom: 'Pharmacie' },
  { id: 'collectivite', nom: 'Mairie & Collectivite' },
  { id: 'pme',          nom: 'PME Generique' },
  { id: 'nettoyage',    nom: 'Nettoyage & Proprete' },
  { id: 'maintenance',  nom: 'Maintenance Industrielle' },
]
