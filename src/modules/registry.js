// src/modules/registry.js
// REGISTRE CENTRAL VELOR ONE - Plugin System
// Chaque module est defini ici avec son contrat complet.
// Ce fichier est la source unique de verite pour tous les modules.
// L'ajout d'un module = ajouter une entree ici uniquement.
import { lazy } from 'react'

// ===========================================================
// CONTRAT D'UN MODULE (interface obligatoire)
// ===========================================================
// {
//   id:           string  - identifiant unique (= module_id en BDD)
//   nom:          string  - libelle affiche dans la nav
//   version:      string  - version semver du module
//   icone:        string  - emoji affiche dans la nav
//   iconeLib:     string  - identifiant icone librairie (lucide, etc.)
//   description:  string  - description courte
//   route:        string  - chemin de navigation (/conges)
//   composant:    lazy()  - composant charge en lazy
//   permissions:  object  - permissions granulaires du module
//   dependances:  string[]- modules requis avant activation
//   plans:        string[]- plans qui incluent ce module
//   templates:    string[]- secteurs qui activent ce module par defaut
//   ordre:        number  - position dans la nav
//   categorie:    string  - groupe dans la nav
//   couleur:      string  - couleur hex du module
//   badge:        string  - badge optionnel (BETA, NEW, PRO)
//   actif:        boolean - actif dans le catalogue
//   widgets:      object  - widgets optionnels pour le dashboard
// }

// ===========================================================
// PERMISSIONS PAR DEFAUT (chaque module peut surcharger)
// ===========================================================
export const DEFAULT_PERMISSIONS = {
  voir: true,
  creer: false,
  modifier: false,
  supprimer: false,
  exporter: false,
  valider: false,
  administrer: false,
}

// ===========================================================
// PERMISSIONS PAR ROLE (appliquees si le module ne surcharge pas)
// ===========================================================
export const ROLE_PERMISSIONS = {
  employe:     { voir: true, creer: true, modifier: false, supprimer: false, exporter: false, valider: false, administrer: false },
  responsable: { voir: true, creer: true, modifier: true,  supprimer: false, exporter: true,  valider: true,  administrer: false },
  admin:       { voir: true, creer: true, modifier: true,  supprimer: true,  exporter: true,  valider: true,  administrer: true  },
  super_admin: { voir: true, creer: true, modifier: true,  supprimer: true,  exporter: true,  valider: true,  administrer: true  },
}

// ===========================================================
// REGISTRE DES MODULES
// ===========================================================
export const MODULES_REGISTRY = [
  {
    id: 'conges',
    nom: 'Conges & Absences',
    version: '0.1.0',
    icone: '🏖',
    iconeLib: 'calendar-off',
    description: 'Gestion des demandes de conges, absences et jours feries',
    route: '/conges',
    composant: lazy(() => import('./conges/index.jsx')),
    permissions: {
      voir: true,
      creer: true,
      modifier: true,
      supprimer: false,
      exporter: true,
      valider: false,
    },
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false, valider: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true  },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'ehpad', 'pme', 'commerce', 'pharmacie', 'mairie'],
    ordre: 10,
    categorie: 'rh',
    couleur: '#6366F1',
    badge: null,
    actif: true,
    widgets: {
      stats: true,
      alertes: true,
    },
  },
  {
    id: 'gps',
    nom: 'Geolocalisation',
    version: '0.1.0',
    icone: '📍',
    iconeLib: 'map-pin',
    description: 'Suivi GPS des equipes terrain en temps reel',
    route: '/gps',
    composant: lazy(() => import('./gps/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [],
    plans: ['premium', 'enterprise'],
    templates: ['btp', 'nettoyage', 'maintenance', 'collectivite'],
    ordre: 20,
    categorie: 'terrain',
    couleur: '#10B981',
    badge: 'BETA',
    actif: true,
    widgets: { carte: true },
  },
  {
    id: 'documents',
    nom: 'Gestion Documents',
    version: '0.1.0',
    icone: '📄',
    iconeLib: 'file-text',
    description: 'GED, stockage, partage et gestion des documents',
    route: '/documents',
    composant: lazy(() => import('./documents/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true, creer: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: true  },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'ehpad', 'pharmacie', 'mairie', 'pme', 'btp'],
    ordre: 30,
    categorie: 'admin',
    couleur: '#3B82F6',
    badge: null,
    actif: true,
    widgets: { compteur: true },
  },
  {
    id: 'vehicules',
    nom: 'Flotte Vehicules',
    version: '0.1.0',
    icone: '🚗',
    iconeLib: 'car',
    description: 'Gestion du parc automobile, reservations et entretiens',
    route: '/vehicules',
    composant: lazy(() => import('./vehicules/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['btp', 'mairie', 'nettoyage', 'maintenance'],
    ordre: 40,
    categorie: 'logistique',
    couleur: '#F59E0B',
    badge: null,
    actif: true,
    widgets: { stats: true },
  },
  {
    id: 'stocks',
    nom: 'Gestion Stocks',
    version: '0.1.0',
    icone: '📦',
    iconeLib: 'package',
    description: 'Inventaire, approvisionnements et suivi des stocks',
    route: '/stocks',
    composant: lazy(() => import('./stocks/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true, creer: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'pharmacie', 'commerce', 'btp'],
    ordre: 50,
    categorie: 'logistique',
    couleur: '#8B5CF6',
    badge: null,
    actif: true,
    widgets: { alertes: true, stats: true },
  },
  {
    id: 'facturation',
    nom: 'Facturation',
    version: '0.1.0',
    icone: '🧾',
    iconeLib: 'receipt',
    description: 'Devis, factures, avoirs et suivi des paiements',
    route: '/facturation',
    composant: lazy(() => import('./facturation/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'commerce', 'pme'],
    ordre: 60,
    categorie: 'finance',
    couleur: '#EF4444',
    badge: null,
    actif: true,
    widgets: { chiffre_affaires: true, stats: true },
  },
  {
    id: 'reservations',
    nom: 'Reservations',
    version: '0.1.0',
    icone: '📆',
    iconeLib: 'calendar-check',
    description: 'Systeme de reservations, bookings et disponibilites',
    route: '/reservations',
    composant: lazy(() => import('./reservations/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true, creer: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant'],
    ordre: 70,
    categorie: 'metier',
    couleur: '#06B6D4',
    badge: null,
    actif: true,
    widgets: { planning: true, stats: true },
  },
  {
    id: 'clients',
    nom: 'CRM Clients',
    version: '0.1.0',
    icone: '🤝',
    iconeLib: 'users',
    description: 'Gestion de la relation client, historique et fidelisation',
    route: '/clients',
    composant: lazy(() => import('./clients/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true, creer: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'commerce', 'pme'],
    ordre: 80,
    categorie: 'commercial',
    couleur: '#EC4899',
    badge: null,
    actif: true,
    widgets: { stats: true },
  },
  {
    id: 'qualite',
    nom: 'Controle Qualite',
    version: '0.1.0',
    icone: '✅',
    iconeLib: 'check-square',
    description: 'Audits, non-conformites, actions correctives et KPIs',
    route: '/qualite',
    composant: lazy(() => import('./qualite/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [],
    plans: ['premium', 'enterprise'],
    templates: ['hotel', 'ehpad', 'pharmacie', 'btp', 'nettoyage'],
    ordre: 90,
    categorie: 'metier',
    couleur: '#22C55E',
    badge: null,
    actif: true,
    widgets: { stats: true, alertes: true },
  },
  {
    id: 'formations',
    nom: 'Formations',
    version: '0.1.0',
    icone: '🎓',
    iconeLib: 'graduation-cap',
    description: 'Plan de formation, suivi des competences et certifications',
    route: '/formations',
    composant: lazy(() => import('./formations/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [],
    plans: ['premium', 'enterprise'],
    templates: ['ehpad', 'pharmacie', 'mairie', 'btp'],
    ordre: 100,
    categorie: 'rh',
    couleur: '#A78BFA',
    badge: null,
    actif: true,
    widgets: { stats: true },
  },
  {
    id: 'securite',
    nom: 'Securite & HSE',
    version: '0.1.0',
    icone: '🛡',
    iconeLib: 'shield',
    description: 'Incidents, accidents, EPI et conformite securite',
    route: '/securite',
    composant: lazy(() => import('./securite/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true, creer: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [],
    plans: ['premium', 'enterprise'],
    templates: ['btp', 'ehpad', 'nettoyage', 'maintenance'],
    ordre: 110,
    categorie: 'metier',
    couleur: '#F97316',
    badge: null,
    actif: true,
    widgets: { alertes: true, stats: true },
  },
  {
    id: 'rapports',
    nom: 'Rapports Avances',
    version: '0.1.0',
    icone: '📊',
    iconeLib: 'bar-chart',
    description: 'Tableaux de bord personnalises et analytics avances',
    route: '/rapports',
    composant: lazy(() => import('./rapports/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: false, modifier: false, supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [],
    plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'commerce', 'pme', 'btp'],
    ordre: 120,
    categorie: 'analyse',
    couleur: '#0EA5E9',
    badge: null,
    actif: true,
    widgets: { graphiques: true, kpis: true },
  },
  {
    id: 'planning_avance',
    nom: 'Planning Avance',
    version: '0.1.0',
    icone: '🗂',
    iconeLib: 'layout',
    description: 'Gantt, capacite de production et planification avancee',
    route: '/planning-avance',
    composant: lazy(() => import('./planning_avance/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [],
    plans: ['premium', 'enterprise'],
    templates: ['btp', 'maintenance', 'nettoyage'],
    ordre: 130,
    categorie: 'planification',
    couleur: '#14B8A6',
    badge: null,
    actif: true,
    widgets: { gantt: true },
  },
  {
    id: 'multi_sites',
    nom: 'Multi-Sites',
    version: '0.1.0',
    icone: '🔀',
    iconeLib: 'git-branch',
    description: 'Gestion et comparaison entre plusieurs sites',
    route: '/multi-sites',
    composant: lazy(() => import('./multi_sites/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: false, modifier: false, supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  administrer: true },
    },
    dependances: [],
    plans: ['premium', 'enterprise'],
    templates: ['hotel', 'pharmacie', 'commerce', 'mairie'],
    ordre: 140,
    categorie: 'organisation',
    couleur: '#6B7280',
    badge: null,
    actif: true,
    widgets: { comparatif: true },
  },
  {
    id: 'api',
    nom: 'API & Integrations',
    version: '0.1.0',
    icone: '💻',
    iconeLib: 'code',
    description: 'Connexion avec vos outils existants via API REST et webhooks',
    route: '/api-config',
    composant: lazy(() => import('./api/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  administrer: true },
    },
    dependances: [],
    plans: ['enterprise'],
    templates: [],
    ordre: 150,
    categorie: 'technique',
    couleur: '#374151',
    badge: 'PRO',
    actif: true,
    widgets: { stats: true },
  },
  {
    id: 'white_label',
    nom: 'White Label',
    version: '0.1.0',
    icone: '🎨',
    iconeLib: 'palette',
    description: 'Personnalisation complete : couleurs, logo, domaine',
    route: '/white-label',
    composant: lazy(() => import('./white_label/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      admin:       { voir: true,  creer: false, modifier: true,  supprimer: false, exporter: false, administrer: true },
    },
    dependances: [],
    plans: ['enterprise'],
    templates: [],
    ordre: 160,
    categorie: 'personnalisation',
    couleur: '#F472B6',
    badge: 'PRO',
    actif: true,
    widgets: null,
  },
  {
    id: 'ia',
    nom: 'Assistant IA',
    version: '0.1.0',
    icone: '🤖',
    iconeLib: 'cpu',
    description: 'Assistant intelligent pour optimisation et suggestions',
    route: '/ia',
    composant: lazy(() => import('./ia/index.jsx')),
    permissions: { ...DEFAULT_PERMISSIONS, voir: true },
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  administrer: true },
    },
    dependances: [],
    plans: ['enterprise'],
    templates: [],
    ordre: 170,
    categorie: 'avance',
    couleur: '#7C3AED',
    badge: 'BETA',
    actif: true,
    widgets: { suggestions: true },
  },
]

// ===========================================================
// HELPERS DU REGISTRE
// ===========================================================

// Recuperer un module par son ID
export function getModuleById(id) {
  return MODULES_REGISTRY.find(m => m.id === id) || null
}

// Recuperer les modules actifs dans le catalogue
export function getActiveModules() {
  return MODULES_REGISTRY.filter(m => m.actif)
}

// Recuperer les modules compatibles avec un plan
export function getModulesForPlan(plan) {
  const PLAN_ORDER = ['starter', 'business', 'premium', 'enterprise']
  const planIdx = PLAN_ORDER.indexOf(plan)
  return MODULES_REGISTRY.filter(m =>
    m.actif && m.plans.some(p => PLAN_ORDER.indexOf(p) <= planIdx)
  )
}

// Recuperer les modules par defaut pour un template secteur
export function getModulesForTemplate(secteur) {
  return MODULES_REGISTRY.filter(m => m.actif && m.templates.includes(secteur))
}

// Verifier si une permission est accordee (module + role)
export function checkPermission(moduleId, role, permission) {
  const mod = getModuleById(moduleId)
  if (!mod) return false
  if (role === 'super_admin') return true
  const rolePerms = mod.permissionsParRole?.[role] || ROLE_PERMISSIONS[role] || {}
  return rolePerms[permission] === true
}

// Recuperer les permissions d'un module pour un role donne
export function getPermissions(moduleId, role) {
  const mod = getModuleById(moduleId)
  if (!mod) return {}
  if (role === 'super_admin') return Object.fromEntries(Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true]))
  return mod.permissionsParRole?.[role] || ROLE_PERMISSIONS[role] || DEFAULT_PERMISSIONS
}

// Recuperer les modules qui ont des widgets
export function getModulesWithWidgets() {
  return MODULES_REGISTRY.filter(m => m.actif && m.widgets)
}

// Grouper les modules par categorie
export function getModulesByCategory() {
  return MODULES_REGISTRY.reduce((acc, m) => {
    if (!m.actif) return acc
    if (!acc[m.categorie]) acc[m.categorie] = []
    acc[m.categorie].push(m)
    return acc
  }, {})
}

export default MODULES_REGISTRY
