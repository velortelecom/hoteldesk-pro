// src/modules/registry.js
// REGISTRE CENTRAL VELOR ONE - Plugin System V4
// Source unique de verite pour tous les modules.
// Ajouter un module = ajouter une entree ici uniquement.
import { lazy } from 'react'
import { createModuleSquelette } from './_squelette.jsx'

// ===========================================================
// PERMISSIONS
// ===========================================================
export const DEFAULT_PERMISSIONS = {
  voir: true, creer: false, modifier: false,
  supprimer: false, exporter: false, valider: false, administrer: false,
}

export const ROLE_PERMISSIONS = {
  employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false, valider: false, administrer: false },
  responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true,  administrer: false },
  admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true,  administrer: true  },
  super_admin: { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true,  administrer: true  },
}

// ===========================================================
// REGISTRE DES MODULES
// composant: lazy() pour code splitting - charge uniquement si le module est utilise
// Les modules avec leur propre dossier utilisent lazy(() => import('./id/index.jsx'))
// Les modules squelettes utilisent lazy(() => Promise.resolve({ default: createModuleSquelette('id') }))
// ===========================================================
export const MODULES_REGISTRY = [
  {
    id: 'organisation',
    nom: 'Organisation & RH',
    version: '1.0.0',
    icone: '🏢',
    iconeLib: 'building',
    description: 'Gestion des employés, départements, postes et organigramme',
    route: '/organisation',
    composant: lazy(() => import('./organisation/index.jsx')),
    permissions: {
      voir:        { employe: true,  responsable: true,  admin: true,  super_admin: true  },
      creer:       { employe: false, responsable: true,  admin: true,  super_admin: true  },
      modifier:    { employe: false, responsable: true,  admin: true,  super_admin: true  },
      supprimer:   { employe: false, responsable: false, admin: true,  super_admin: true  },
      exporter:    { employe: false, responsable: true,  admin: true,  super_admin: true  },
      administrer: { employe: false, responsable: false, admin: true,  super_admin: true  },
    },
    dependances: [], plans: ['starter', 'business', 'premium', 'enterprise'],
    templates: ['hotel', 'pharmacie', 'commerce', 'mairie', 'restaurant', 'residence'],
    ordre: 10, categorie: 'rh', couleur: '#6366f1', badge: null, actif: true,
    widgets: { employes_actifs: true, departements: true, postes: true },
  },
  {
    id: 'conges', nom: 'Conges & Absences', version: '0.1.0',
    icone: '🏖', iconeLib: 'calendar-off',
    description: 'Gestion des demandes de conges, absences et jours feries',
    route: '/conges',
    composant: lazy(() => import('./conges/index.jsx')),
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false, valider: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true  },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'ehpad', 'pme', 'commerce', 'pharmacie', 'mairie'],
    ordre: 10, categorie: 'rh', couleur: '#6366F1', badge: null, actif: true,
    widgets: { stats: true, alertes: true },
  },
  {
    id: 'gps', nom: 'Geolocalisation', version: '0.1.0',
    icone: '📍', iconeLib: 'map-pin',
    description: 'Suivi GPS des equipes terrain en temps reel',
    route: '/gps',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('gps') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [], plans: ['premium', 'enterprise'],
    templates: ['btp', 'nettoyage', 'maintenance', 'collectivite'],
    ordre: 20, categorie: 'terrain', couleur: '#10B981', badge: 'BETA', actif: true,
    widgets: { carte: true },
  },
  {
    id: 'documents', nom: 'Gestion Documents', version: '0.1.0',
    icone: '📄', iconeLib: 'file-text',
    description: 'GED, stockage, partage et gestion des documents',
    route: '/documents',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('documents') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: true  },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'ehpad', 'pharmacie', 'mairie', 'pme', 'btp'],
    ordre: 30, categorie: 'admin', couleur: '#3B82F6', badge: null, actif: true,
    widgets: { compteur: true },
  },
  {
    id: 'vehicules', nom: 'Flotte Vehicules', version: '0.1.0',
    icone: '🚗', iconeLib: 'car',
    description: 'Gestion du parc automobile, reservations et entretiens',
    route: '/vehicules',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('vehicules') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['btp', 'mairie', 'nettoyage', 'maintenance'],
    ordre: 40, categorie: 'logistique', couleur: '#F59E0B', badge: null, actif: true,
    widgets: { stats: true },
  },
  {
    id: 'stocks', nom: 'Gestion Stocks', version: '0.1.0',
    icone: '📦', iconeLib: 'package',
    description: 'Inventaire, approvisionnements et suivi des stocks',
    route: '/stocks',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('stocks') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'pharmacie', 'commerce', 'btp'],
    ordre: 50, categorie: 'logistique', couleur: '#8B5CF6', badge: null, actif: true,
    widgets: { alertes: true, stats: true },
  },
  {
    id: 'facturation', nom: 'Facturation', version: '0.1.0',
    icone: '🧾', iconeLib: 'receipt',
    description: 'Devis, factures, avoirs et suivi des paiements',
    route: '/facturation',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('facturation') })),
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'commerce', 'pme'],
    ordre: 60, categorie: 'finance', couleur: '#EF4444', badge: null, actif: true,
    widgets: { chiffre_affaires: true, stats: true },
  },
  {
    id: 'reservations', nom: 'Reservations', version: '0.1.0',
    icone: '📆', iconeLib: 'calendar-check',
    description: 'Systeme de reservations, bookings et disponibilites',
    route: '/reservations',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('reservations') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant'],
    ordre: 70, categorie: 'metier', couleur: '#06B6D4', badge: null, actif: true,
    widgets: { planning: true, stats: true },
  },
  {
    id: 'clients', nom: 'CRM Clients', version: '0.1.0',
    icone: '🤝', iconeLib: 'users',
    description: 'Gestion de la relation client, historique et fidelisation',
    route: '/clients',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('clients') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'commerce', 'pme'],
    ordre: 80, categorie: 'commercial', couleur: '#EC4899', badge: null, actif: true,
    widgets: { stats: true },
  },
  {
    id: 'qualite', nom: 'Controle Qualite', version: '0.1.0',
    icone: '✅', iconeLib: 'check-square',
    description: 'Audits, non-conformites, actions correctives et KPIs',
    route: '/qualite',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('qualite') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [], plans: ['premium', 'enterprise'],
    templates: ['hotel', 'ehpad', 'pharmacie', 'btp', 'nettoyage'],
    ordre: 90, categorie: 'metier', couleur: '#22C55E', badge: null, actif: true,
    widgets: { stats: true, alertes: true },
  },
  {
    id: 'formations', nom: 'Formations', version: '0.1.0',
    icone: '🎓', iconeLib: 'graduation-cap',
    description: 'Plan de formation, suivi des competences et certifications',
    route: '/formations',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('formations') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [], plans: ['premium', 'enterprise'],
    templates: ['ehpad', 'pharmacie', 'mairie', 'btp'],
    ordre: 100, categorie: 'rh', couleur: '#A78BFA', badge: null, actif: true,
    widgets: { stats: true },
  },
  {
    id: 'securite', nom: 'Securite & HSE', version: '0.1.0',
    icone: '🛡', iconeLib: 'shield',
    description: 'Incidents, accidents, EPI et conformite securite',
    route: '/securite',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('securite') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  valider: true },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  valider: true },
    },
    dependances: [], plans: ['premium', 'enterprise'],
    templates: ['btp', 'ehpad', 'nettoyage', 'maintenance'],
    ordre: 110, categorie: 'metier', couleur: '#F97316', badge: null, actif: true,
    widgets: { alertes: true, stats: true },
  },
  {
    id: 'rapports', nom: 'Rapports Avances', version: '0.1.0',
    icone: '📊', iconeLib: 'bar-chart',
    description: 'Tableaux de bord personnalises et analytics avances',
    route: '/rapports',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('rapports') })),
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: false, modifier: false, supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [], plans: ['business', 'premium', 'enterprise'],
    templates: ['hotel', 'restaurant', 'commerce', 'pme', 'btp'],
    ordre: 120, categorie: 'analyse', couleur: '#0EA5E9', badge: null, actif: true,
    widgets: { graphiques: true, kpis: true },
  },
  {
    id: 'planning_avance', nom: 'Planning Avance', version: '0.1.0',
    icone: '🗂', iconeLib: 'layout',
    description: 'Gantt, capacite de production et planification avancee',
    route: '/planning-avance',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('planning_avance') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true  },
    },
    dependances: [], plans: ['premium', 'enterprise'],
    templates: ['btp', 'maintenance', 'nettoyage'],
    ordre: 130, categorie: 'planification', couleur: '#14B8A6', badge: null, actif: true,
    widgets: { gantt: true },
  },
  {
    id: 'multi_sites', nom: 'Multi-Sites', version: '0.1.0',
    icone: '🔀', iconeLib: 'git-branch',
    description: 'Gestion et comparaison entre plusieurs sites',
    route: '/multi-sites',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('multi_sites') })),
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: false, modifier: false, supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  administrer: true },
    },
    dependances: [], plans: ['premium', 'enterprise'],
    templates: ['hotel', 'pharmacie', 'commerce', 'mairie'],
    ordre: 140, categorie: 'organisation', couleur: '#6B7280', badge: null, actif: true,
    widgets: { comparatif: true },
  },
  {
    id: 'api', nom: 'API & Integrations', version: '0.1.0',
    icone: '💻', iconeLib: 'code',
    description: 'Connexion avec vos outils existants via API REST et webhooks',
    route: '/api-config',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('api') })),
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: true,  exporter: true,  administrer: true },
    },
    dependances: [], plans: ['enterprise'], templates: [],
    ordre: 150, categorie: 'technique', couleur: '#374151', badge: 'PRO', actif: true,
    widgets: { stats: true },
  },
  {
    id: 'white_label', nom: 'White Label', version: '0.1.0',
    icone: '🎨', iconeLib: 'palette',
    description: 'Personnalisation complete : couleurs, logo, domaine',
    route: '/white-label',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('white_label') })),
    permissionsParRole: {
      employe:     { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: false, creer: false, modifier: false, supprimer: false, exporter: false },
      admin:       { voir: true,  creer: false, modifier: true,  supprimer: false, exporter: false, administrer: true },
    },
    dependances: [], plans: ['enterprise'], templates: [],
    ordre: 160, categorie: 'personnalisation', couleur: '#F472B6', badge: 'PRO', actif: true,
    widgets: null,
  },
  {
    id: 'ia', nom: 'Assistant IA', version: '0.1.0',
    icone: '🤖', iconeLib: 'cpu',
    description: 'Assistant intelligent pour optimisation et suggestions',
    route: '/ia',
    composant: lazy(() => Promise.resolve({ default: createModuleSquelette('ia') })),
    permissionsParRole: {
      employe:     { voir: true,  creer: false, modifier: false, supprimer: false, exporter: false },
      responsable: { voir: true,  creer: true,  modifier: false, supprimer: false, exporter: true  },
      admin:       { voir: true,  creer: true,  modifier: true,  supprimer: false, exporter: true,  administrer: true },
    },
    dependances: [], plans: ['enterprise'], templates: [],
    ordre: 170, categorie: 'avance', couleur: '#7C3AED', badge: 'BETA', actif: true,
    widgets: { suggestions: true },
  },
]

// ===========================================================
// HELPERS
// ===========================================================
export function getModuleById(id) { return MODULES_REGISTRY.find(m => m.id === id) || null }
export function getActiveModules() { return MODULES_REGISTRY.filter(m => m.actif) }
export function getModulesForPlan(plan) {
  const ORDER = ['starter', 'business', 'premium', 'enterprise']
  const idx = ORDER.indexOf(plan)
  return MODULES_REGISTRY.filter(m => m.actif && m.plans.some(p => ORDER.indexOf(p) <= idx))
}
export function getModulesForTemplate(secteur) {
  return MODULES_REGISTRY.filter(m => m.actif && m.templates.includes(secteur))
}
export function checkPermission(moduleId, role, permission) {
  const mod = getModuleById(moduleId)
  if (!mod) return false
  if (role === 'super_admin') return true
  const rolePerms = mod.permissionsParRole?.[role] || ROLE_PERMISSIONS[role] || {}
  return rolePerms[permission] === true
}
export function getPermissions(moduleId, role) {
  const mod = getModuleById(moduleId)
  if (!mod) return {}
  if (role === 'super_admin') return Object.fromEntries(Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true]))
  return mod.permissionsParRole?.[role] || ROLE_PERMISSIONS[role] || DEFAULT_PERMISSIONS
}
export function getModulesWithWidgets() { return MODULES_REGISTRY.filter(m => m.actif && m.widgets) }
export function getModulesByCategory() {
  return MODULES_REGISTRY.reduce((acc, m) => {
    if (!m.actif) return acc
    if (!acc[m.categorie]) acc[m.categorie] = []
    acc[m.categorie].push(m)
    return acc
  }, {})
}
export default MODULES_REGISTRY
