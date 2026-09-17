// src/lib/plan1.js
// =====================================================================
// L'OFFRE DE SOUSCRIPTION - definition d'AFFICHAGE cote frontend.
//
// ATTENTION : ce fichier ne fait PAS autorite.
//   - La grille commerciale (prix, plafonds, contenu) vient de
//     src/lib/offres.js, source unique.
//   - Ce qui est reellement ECRIT a l'inscription vient de l'Edge Function
//     (supabase/functions/_shared/plan1.ts) et de la RPC SQL, appliquees en
//     service_role. Aucune valeur d'ici ne les influence.
//
// Le nom "PLAN_1" est historique : il designe l'offre de souscription,
// aujourd'hui "Velor One". Les constantes gardent leur nom pour ne pas
// casser leurs appelants.
// =====================================================================
import { OFFRE_INSCRIPTION, getOffre, modulesInclus } from './offres'

const OFFRE_1 = getOffre(OFFRE_INSCRIPTION)

export const PLAN_1_ID = OFFRE_INSCRIPTION
export const PLAN_1_LABEL = OFFRE_1.nom
export const PLAN_1_PRIX_MENSUEL = OFFRE_1.prix
export const PLAN_1_MAX_UTILISATEURS = OFFRE_1.maxUtilisateurs

// Modules actives automatiquement a l'inscription. Derive, jamais recopie.
export const PLAN_1_MODULES = modulesInclus(OFFRE_INSCRIPTION)

// Le socle est inalterable : present pour toute entreprise, quel que soit
// le plan, sans aucun module a activer.
export const PLAN_1_SOCLE = [
  { id: 'dashboard', label: 'Accueil', icone: '🏠', detail: 'Vue d’ensemble de l’activite' },
  { id: 'planning', label: 'Planning', icone: '📅', detail: 'Planning mensuel des equipes' },
  { id: 'taches', label: 'Taches', icone: '✅', detail: 'Taches avec photo et discussion' },
  { id: 'messagerie', label: 'Messages', icone: '💬', detail: 'Messagerie interne' },
  { id: 'rappels', label: 'Rappels', icone: '🔔', detail: 'Rappels et echeances' },
]

const DETAILS_MODULES = {
  organisation: { label: 'Organisation & RH', icone: '🏢', detail: 'Employes, departements, postes, organigramme' },
  conges: { label: 'Conges & Absences', icone: '🏖', detail: 'Demandes, validation, soldes CP et RTT' },
  pointage: { label: 'Pointage', icone: '⏱️', detail: 'Decompte du temps de travail, heures supplementaires, preuve legale' },
}

export const PLAN_1_MODULES_DETAIL = PLAN_1_MODULES.map(id => ({
  id,
  ...(DETAILS_MODULES[id] || { label: id, icone: '📦', detail: '' }),
}))

export function estModulePlan1(moduleId) {
  return PLAN_1_MODULES.includes(moduleId)
}

export const STATUT_SUR_DEMANDE = 'Sur demande'
