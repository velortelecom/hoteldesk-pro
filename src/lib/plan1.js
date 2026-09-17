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
import {
  OFFRES, OFFRES_VENDUES, OFFRE_INSCRIPTION,
  TARIF_FONDATEUR, FONDATEURS_MAX,
  getOffre, modulesInclus, rangOffre,
} from './offres'

const OFFRE_1 = getOffre(OFFRE_INSCRIPTION)

export const PLAN_1_ID = OFFRE_INSCRIPTION
export const PLAN_1_LABEL = OFFRE_1.nom
export const PLAN_1_PRIX_MENSUEL = OFFRE_1.prix
export const PLAN_1_MAX_UTILISATEURS = OFFRE_1.maxUtilisateurs

// Le tarif des premieres entreprises, reexporte pour l'affichage.
export const PLAN_1_TARIF_FONDATEUR = TARIF_FONDATEUR
export const PLAN_1_FONDATEURS_MAX = FONDATEURS_MAX

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

// ---------------------------------------------------------------------
// AU-DESSUS DE L'OFFRE
//
// Il n'y a plus de packs superieurs a vendre : une seule offre payante,
// et le sur-mesure au-dela. Les anciens packs (business, premium) sont
// marques vendu: false dans offres.js et n'apparaissent donc pas ici --
// mais ils restent definis, parce qu'une entreprise peut encore les
// porter dans entreprises.plan et doit voir un nom, pas un identifiant.
// ---------------------------------------------------------------------
export const STATUT_SUR_DEMANDE = 'Sur demande'

export const PACKS_SUPERIEURS = OFFRES_VENDUES
  .filter(o => rangOffre(o.id) > rangOffre(OFFRE_INSCRIPTION))
  .map(o => ({
    id: o.id,
    nom: o.nom,
    couleur: o.couleur,
    resume: o.resume,
    modules: o.modules,
  }))

/** Toutes les offres, y compris celles qui ne sont plus vendues. */
export const TOUTES_LES_OFFRES = OFFRES
