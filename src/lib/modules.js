// src/lib/modules.js
// Registre des modules Velor One
// Infrastructure d'activation/desactivation par entreprise

export const PLANS = {
  starter: {
    id: 'starter',
    nom: 'Starter',
    prix: 29,
    max_utilisateurs: 10,
    description: 'Ideal pour les petites structures',
    couleur: '#6B7280',
  },
  business: {
    id: 'business',
    nom: 'Business',
    prix: 79,
    max_utilisateurs: 50,
    description: 'Pour les entreprises en croissance',
    couleur: '#3B82F6',
  },
  premium: {
    id: 'premium',
    nom: 'Premium',
    prix: 199,
    max_utilisateurs: 200,
    description: 'Fonctionnalites avancees et multi-sites',
    couleur: '#8B5CF6',
  },
  enterprise: {
    id: 'enterprise',
    nom: 'Enterprise',
    prix: null,
    max_utilisateurs: null,
    description: 'Sur mesure, illimite, white-label',
    couleur: '#F59E0B',
  },
}

// Ordre de precedence des plans
export const PLAN_ORDER = ['starter', 'business', 'premium', 'enterprise']

// Verifie si un plan permet d'acceder a un module
export function planAllows(planEntreprise, planMinimumModule) {
  const idx1 = PLAN_ORDER.indexOf(planEntreprise)
  const idx2 = PLAN_ORDER.indexOf(planMinimumModule)
  return idx1 >= idx2
}

// Modules du socle — non desactivables, inclus dans tous les plans
export const SOCLE_MENUS = [
  { id: 'accueil', nom: 'Accueil', path: '/', icone: 'home' },
  { id: 'planning', nom: 'Planning', path: '/planning', icone: 'calendar' },
  { id: 'taches', nom: 'Taches', path: '/taches', icone: 'check-square' },
  { id: 'messages', nom: 'Messages', path: '/messages', icone: 'message-circle' },
  { id: 'rappels', nom: 'Rappels', path: '/rappels', icone: 'bell' },
  { id: 'equipe', nom: 'Equipe', path: '/equipe', icone: 'users' },
]

// Mapping module_id -> route frontend (pour la navigation dynamique future)
export const MODULE_ROUTES = {
  conges: '/conges',
  gps: '/gps',
  documents: '/documents',
  vehicules: '/vehicules',
  ia: '/ia',
  stocks: '/stocks',
  facturation: '/facturation',
  reservations: '/reservations',
  clients: '/clients',
  qualite: '/qualite',
  formations: '/formations',
  securite: '/securite',
  rapports: '/rapports',
  planning_avance: '/planning-avance',
  multi_sites: '/multi-sites',
  api: '/api-config',
  white_label: '/white-label',
}

// Secteurs disponibles
export const SECTEURS = [
  { id: 'hotel', nom: 'Hotel & Hebergement' },
  { id: 'restaurant', nom: 'Restauration' },
  { id: 'sante', nom: 'EHPAD & Sante' },
  { id: 'btp', nom: 'BTP & Construction' },
  { id: 'commerce', nom: 'Commerce & Retail' },
  { id: 'pharmacie', nom: 'Pharmacie' },
  { id: 'collectivite', nom: 'Mairie & Collectivite' },
  { id: 'pme', nom: 'PME Generique' },
  { id: 'nettoyage', nom: 'Nettoyage & Proprete' },
  { id: 'maintenance', nom: 'Maintenance Industrielle' },
]
