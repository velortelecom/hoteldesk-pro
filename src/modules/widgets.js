// src/modules/widgets.js
// SYSTEME DE WIDGETS DASHBOARD - Plugin Widget System
// Chaque module peut fournir des widgets au Dashboard.
// Ce fichier definit le contrat et le registre des widgets.
// Les widgets sont charges uniquement si le module est actif.

// ===========================================================
// TYPES DE WIDGETS DISPONIBLES
// ===========================================================
export const WIDGET_TYPES = {
  STATS:          'stats',         // Carte chiffre + libelle
  ALERTES:        'alertes',       // Liste d'alertes
  GRAPHIQUE:      'graphiques',    // Chart (bar, line, pie)
  KPIS:           'kpis',          // Indicateurs cles
  PLANNING:       'planning',      // Mini-planning
  CARTE:          'carte',         // Carte GPS
  GANTT:          'gantt',         // Diagramme Gantt
  COMPARATIF:     'comparatif',    // Comparaison multi-sites
  SUGGESTIONS:    'suggestions',   // Suggestions IA
  CHIFFRE:        'chiffre_affaires', // CA
  COMPTEUR:       'compteur',      // Compteur simple
}

// ===========================================================
// CONTRAT D'UN WIDGET (interface obligatoire)
// ===========================================================
// {
//   moduleId:    string  - ID du module proprietaire
//   type:        string  - type parmi WIDGET_TYPES
//   ordre:       number  - position dans le dashboard
//   titre:       string  - libelle du widget
//   taille:      string  - 'sm' | 'md' | 'lg' | 'xl'
//   composant:   React component ou null (squelette)
//   config:      object  - configuration specifique
// }

// ===========================================================
// REGISTRE DES WIDGETS PAR MODULE
// (squelettes - a remplir quand le module est developpe)
// ===========================================================
export const WIDGETS_REGISTRY = {
  conges: [
    {
      moduleId: 'conges',
      type: WIDGET_TYPES.STATS,
      ordre: 10,
      titre: 'Conges en attente',
      taille: 'sm',
      composant: null, // A implementer dans conges/components/WidgetConges.jsx
      config: { couleur: '#6366F1' },
    },
    {
      moduleId: 'conges',
      type: WIDGET_TYPES.ALERTES,
      ordre: 11,
      titre: 'Absences aujourd\'hui',
      taille: 'md',
      composant: null,
      config: { maxItems: 5 },
    },
  ],
  gps: [
    {
      moduleId: 'gps',
      type: WIDGET_TYPES.CARTE,
      ordre: 20,
      titre: 'Equipes terrain',
      taille: 'lg',
      composant: null, // A implementer dans gps/components/WidgetCarte.jsx
      config: { zoom: 12 },
    },
  ],
  documents: [
    {
      moduleId: 'documents',
      type: WIDGET_TYPES.COMPTEUR,
      ordre: 30,
      titre: 'Documents recents',
      taille: 'sm',
      composant: null,
      config: { couleur: '#3B82F6' },
    },
  ],
  vehicules: [
    {
      moduleId: 'vehicules',
      type: WIDGET_TYPES.STATS,
      ordre: 40,
      titre: 'Vehicules disponibles',
      taille: 'sm',
      composant: null,
      config: { couleur: '#F59E0B' },
    },
  ],
  stocks: [
    {
      moduleId: 'stocks',
      type: WIDGET_TYPES.ALERTES,
      ordre: 50,
      titre: 'Stock faible',
      taille: 'md',
      composant: null,
      config: { seuilAlerte: 10 },
    },
    {
      moduleId: 'stocks',
      type: WIDGET_TYPES.STATS,
      ordre: 51,
      titre: 'References en stock',
      taille: 'sm',
      composant: null,
      config: { couleur: '#8B5CF6' },
    },
  ],
  facturation: [
    {
      moduleId: 'facturation',
      type: WIDGET_TYPES.CHIFFRE,
      ordre: 60,
      titre: 'CA du mois',
      taille: 'md',
      composant: null,
      config: { couleur: '#EF4444', devise: 'EUR' },
    },
    {
      moduleId: 'facturation',
      type: WIDGET_TYPES.STATS,
      ordre: 61,
      titre: 'Factures en attente',
      taille: 'sm',
      composant: null,
      config: { couleur: '#EF4444' },
    },
  ],
  reservations: [
    {
      moduleId: 'reservations',
      type: WIDGET_TYPES.PLANNING,
      ordre: 70,
      titre: 'Reservations du jour',
      taille: 'lg',
      composant: null,
      config: {},
    },
    {
      moduleId: 'reservations',
      type: WIDGET_TYPES.STATS,
      ordre: 71,
      titre: 'Taux d\'occupation',
      taille: 'sm',
      composant: null,
      config: { couleur: '#06B6D4', unite: '%' },
    },
  ],
  clients: [
    {
      moduleId: 'clients',
      type: WIDGET_TYPES.STATS,
      ordre: 80,
      titre: 'Clients actifs',
      taille: 'sm',
      composant: null,
      config: { couleur: '#EC4899' },
    },
  ],
  qualite: [
    {
      moduleId: 'qualite',
      type: WIDGET_TYPES.ALERTES,
      ordre: 90,
      titre: 'Non-conformites ouvertes',
      taille: 'md',
      composant: null,
      config: { couleur: '#22C55E' },
    },
    {
      moduleId: 'qualite',
      type: WIDGET_TYPES.STATS,
      ordre: 91,
      titre: 'Audits planifies',
      taille: 'sm',
      composant: null,
      config: { couleur: '#22C55E' },
    },
  ],
  formations: [
    {
      moduleId: 'formations',
      type: WIDGET_TYPES.STATS,
      ordre: 100,
      titre: 'Formations en cours',
      taille: 'sm',
      composant: null,
      config: { couleur: '#A78BFA' },
    },
  ],
  securite: [
    {
      moduleId: 'securite',
      type: WIDGET_TYPES.ALERTES,
      ordre: 110,
      titre: 'Incidents non resolus',
      taille: 'md',
      composant: null,
      config: { couleur: '#F97316' },
    },
    {
      moduleId: 'securite',
      type: WIDGET_TYPES.STATS,
      ordre: 111,
      titre: 'Jours sans accident',
      taille: 'sm',
      composant: null,
      config: { couleur: '#F97316' },
    },
  ],
  rapports: [
    {
      moduleId: 'rapports',
      type: WIDGET_TYPES.GRAPHIQUE,
      ordre: 120,
      titre: 'Performance globale',
      taille: 'xl',
      composant: null,
      config: { chartType: 'bar' },
    },
    {
      moduleId: 'rapports',
      type: WIDGET_TYPES.KPIS,
      ordre: 121,
      titre: 'KPIs du mois',
      taille: 'lg',
      composant: null,
      config: {},
    },
  ],
  planning_avance: [
    {
      moduleId: 'planning_avance',
      type: WIDGET_TYPES.GANTT,
      ordre: 130,
      titre: 'Gantt projets',
      taille: 'xl',
      composant: null,
      config: {},
    },
  ],
  multi_sites: [
    {
      moduleId: 'multi_sites',
      type: WIDGET_TYPES.COMPARATIF,
      ordre: 140,
      titre: 'Comparaison sites',
      taille: 'lg',
      composant: null,
      config: {},
    },
  ],
  ia: [
    {
      moduleId: 'ia',
      type: WIDGET_TYPES.SUGGESTIONS,
      ordre: 170,
      titre: 'Suggestions IA',
      taille: 'md',
      composant: null,
      config: { maxSuggestions: 3 },
    },
  ],
}

// ===========================================================
// HELPERS WIDGETS
// ===========================================================

// Recuperer les widgets des modules actifs (pour le dashboard)
export function getActiveWidgets(activeModuleIds) {
  const widgets = []
  for (const moduleId of activeModuleIds) {
    const moduleWidgets = WIDGETS_REGISTRY[moduleId]
    if (moduleWidgets) {
      widgets.push(...moduleWidgets)
    }
  }
  return widgets.sort((a, b) => a.ordre - b.ordre)
}

// Recuperer les widgets d'un type specifique
export function getWidgetsByType(activeModuleIds, type) {
  return getActiveWidgets(activeModuleIds).filter(w => w.type === type)
}

// Verifier si un widget a un composant React implementé
export function isWidgetImplemented(widget) {
  return widget.composant !== null
}

// Registrer un composant pour un widget (utilise lors du dev d'un module)
// Usage : registerWidget('conges', 'stats', MonComposant)
export function registerWidget(moduleId, type, composant) {
  const moduleWidgets = WIDGETS_REGISTRY[moduleId]
  if (!moduleWidgets) return false
  const widget = moduleWidgets.find(w => w.type === type)
  if (!widget) return false
  widget.composant = composant
  return true
}

export default WIDGETS_REGISTRY
