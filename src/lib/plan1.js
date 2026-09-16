// src/lib/plan1.js
// =====================================================================
// PLAN 1 - definition d'AFFICHAGE cote frontend.
//
// ATTENTION : ce fichier ne fait PAS autorite. La seule definition qui
// compte est celle de l'Edge Function (supabase/functions/_shared/plan1.ts),
// appliquee en service_role au moment de l'inscription. Ici, on ne fait que
// decrire ce qui est vendu, pour l'afficher.
//
// Contenu arrete le 15/09/2026 : uniquement ce qui est reellement developpe
// et utilisable en production.
// =====================================================================

export const PLAN_1_ID = 'starter'
export const PLAN_1_LABEL = 'Plan 1 - Essentiel'
export const PLAN_1_PRIX_MENSUEL = 29
export const PLAN_1_MAX_UTILISATEURS = 10

// Modules actives automatiquement a l'inscription.
export const PLAN_1_MODULES = ['organisation', 'conges']

// Le socle est inalterable : present pour toute entreprise, quel que soit
// le plan, sans aucun module a activer.
export const PLAN_1_SOCLE = [
  { id: 'dashboard', label: 'Accueil', icone: '🏠', detail: 'Vue d’ensemble de l’activite' },
  { id: 'planning', label: 'Planning', icone: '📅', detail: 'Planning mensuel des equipes' },
  { id: 'taches', label: 'Taches', icone: '✅', detail: 'Attribution et suivi des taches' },
  { id: 'messagerie', label: 'Messages', icone: '💬', detail: 'Messagerie interne' },
  { id: 'rappels', label: 'Rappels', icone: '🔔', detail: 'Rappels et echeances' },
  { id: 'personnel', label: 'Equipe', icone: '👥', detail: 'Annuaire de l’equipe' },
]

export const PLAN_1_MODULES_DETAIL = [
  { id: 'organisation', label: 'Organisation & RH', icone: '🏢', detail: 'Employes, departements, postes, organigramme' },
  { id: 'conges', label: 'Conges & Absences', icone: '🏖', detail: 'Demandes, validation, soldes CP et RTT' },
]

export function estModulePlan1(moduleId) {
  return PLAN_1_MODULES.includes(moduleId)
}

// ---------------------------------------------------------------------
// PACKS SUPERIEURS
// Non developpes, donc jamais activables par le client. Ils sont presentes
// comme des offres a venir : le client depose une demande, le Super Admin
// Velor One active manuellement quand le module existe reellement.
// ---------------------------------------------------------------------
export const STATUT_SUR_DEMANDE = 'Disponible sur demande'

export const PACKS_SUPERIEURS = [
  {
    id: 'business',
    nom: 'Pack Business',
    couleur: '#3B82F6',
    resume: 'Pour structurer la gestion documentaire et le reporting',
    modules: ['documents', 'rapports'],
  },
  {
    id: 'premium',
    nom: 'Pack Premium',
    couleur: '#8B5CF6',
    resume: 'Terrain, logistique et qualite',
    modules: ['gps', 'vehicules', 'stocks', 'qualite', 'planning_avance', 'multi_sites'],
  },
  {
    id: 'enterprise',
    nom: 'Pack Enterprise',
    couleur: '#F59E0B',
    resume: 'Sur mesure : integrations, marque blanche, assistant IA',
    modules: ['api', 'white_label', 'ia'],
  },
]
