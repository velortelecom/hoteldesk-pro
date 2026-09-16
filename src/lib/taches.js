// src/lib/taches.js
// =====================================================================
// Les valeurs que la table public.taches accepte reellement.
//
// Ces trois listes ne sont pas un choix d'interface : ce sont les
// contraintes CHECK de la base. Toute valeur hors liste est rejetee par
// Postgres, et si le code ne regarde pas l'erreur, l'ecran se contente de
// ne rien faire.
//
// C'est exactement ce qui s'est produit sur le planning : sa creation
// rapide envoyait statut 'a_faire' et priorite 'normale', deux valeurs qui
// n'existent pas, et proposait des categories 'restauration' et 'securite'
// absentes elles aussi. Avec les valeurs par defaut, aucune tache creee
// depuis le planning n'a jamais pu aboutir.
//
// src/lib/taches.test.js relit les contraintes dans supabase_schema.sql et
// fait echouer la suite si ce fichier s'en ecarte.
// =====================================================================

export const CATEGORIES_TACHE = ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
export const PRIORITES_TACHE = ['haute', 'moyenne', 'basse']
export const STATUTS_TACHE = ['planifiee', 'en_cours', 'terminee', 'annulee']

export const CATEGORIE_TACHE_DEFAUT = 'menage'
export const PRIORITE_TACHE_DEFAUT = 'moyenne'
export const STATUT_TACHE_DEFAUT = 'planifiee'

export const LIBELLES_PRIORITE = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }

export function libelleCategorie(id) {
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : ''
}
