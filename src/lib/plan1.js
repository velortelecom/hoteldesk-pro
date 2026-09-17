// src/lib/plan1.js
// =====================================================================
// PLAN 1 - definition d'AFFICHAGE cote frontend.
//
// ATTENTION : ce fichier ne fait PAS autorite sur ce qui est vendu.
//   - La grille commerciale (prix, plafonds, contenu des packs) vient de
//     src/lib/offres.js, source unique.
//   - Ce qui est reellement ECRIT a l'inscription vient de l'Edge Function
//     (supabase/functions/_shared/plan1.ts) et de la RPC SQL, appliquees en
//     service_role. Aucune valeur de ce fichier ne les influence.
//
// Ici on ne fait que decrire, pour l'afficher.
//
// Contenu arrete le 15/09/2026, revu le 17/09/2026 : le pointage est sorti
// du Starter (il justifie le passage a Business) et un plan Gratuit a ete
// ajoute en dessous.
// =====================================================================
import { OFFRES, OFFRE_INSCRIPTION, getOffre, modulesInclus, rangOffre } from './offres'

const OFFRE_1 = getOffre(OFFRE_INSCRIPTION)

export const PLAN_1_ID = OFFRE_INSCRIPTION
export const PLAN_1_LABEL = 'Pack Starter'
export const PLAN_1_PRIX_MENSUEL = OFFRE_1.prix
export const PLAN_1_MAX_UTILISATEURS = OFFRE_1.maxUtilisateurs

// Modules actives automatiquement a l'inscription : ceux du Starter et de
// tout ce qui est en dessous. Derive, jamais recopie.
export const PLAN_1_MODULES = modulesInclus(OFFRE_INSCRIPTION)

// Le socle est inalterable : present pour toute entreprise, quel que soit
// le plan, sans aucun module a activer.
export const PLAN_1_SOCLE = [
  { id: 'dashboard', label: 'Accueil', icone: '🏠', detail: 'Vue d’ensemble de l’activite' },
  { id: 'planning', label: 'Planning', icone: '📅', detail: 'Planning mensuel des equipes' },
  { id: 'taches', label: 'Taches', icone: '✅', detail: 'Attribution et suivi des taches' },
  { id: 'messagerie', label: 'Messages', icone: '💬', detail: 'Messagerie interne' },
  { id: 'rappels', label: 'Rappels', icone: '🔔', detail: 'Rappels et echeances' },
]

const DETAILS_MODULES = {
  organisation: { label: 'Organisation & RH', icone: '🏢', detail: 'Employes, departements, postes, organigramme' },
  conges: { label: 'Conges & Absences', icone: '🏖', detail: 'Demandes, validation, soldes CP et RTT' },
}

export const PLAN_1_MODULES_DETAIL = PLAN_1_MODULES.map(id => ({
  id,
  ...(DETAILS_MODULES[id] || { label: id, icone: '📦', detail: '' }),
}))

export function estModulePlan1(moduleId) {
  return PLAN_1_MODULES.includes(moduleId)
}

// ---------------------------------------------------------------------
// PACKS SUPERIEURS
// Non developpes pour la plupart, donc jamais activables par le client. Ils
// sont presentes comme des offres a venir : le client depose une demande,
// le Super Admin Velor One active manuellement.
//
// La liste des modules de chaque pack est celle d'offres.js : uniquement ce
// que le pack AJOUTE. Un pack ne reprend jamais le contenu de celui d'en
// dessous, sinon on recree la duplication qu'on vient de supprimer.
// ---------------------------------------------------------------------
export const STATUT_SUR_DEMANDE = 'Disponible sur demande'

export const PACKS_SUPERIEURS = OFFRES
  .filter(o => rangOffre(o.id) > rangOffre(OFFRE_INSCRIPTION))
  .map(o => ({
    id: o.id,
    nom: 'Pack ' + o.nom,
    couleur: o.couleur,
    resume: o.resume,
    modules: o.modules,
  }))
