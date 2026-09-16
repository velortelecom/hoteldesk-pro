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

// =====================================================================
// Echeance : une date d'ecran est une heure LOCALE
//
// Les pages envoyaient la valeur brute du champ date : '2026-09-17'.
// PostgREST travaille en UTC, Postgres a donc stocke minuit UTC, et le
// navigateur l'a reaffiche a 02:00 en heure de Paris. Deux heures de
// decalage sur chaque tache, et davantage selon la saison.
//
// On construit l'instant a partir de l'heure locale : new Date() sans
// suffixe Z interprete la chaine dans le fuseau du navigateur, et
// toISOString() rend l'instant UTC correspondant. La tache saisie a 14h
// se relit a 14h, ici comme ailleurs.
// =====================================================================
export function construireEcheance(date, heure) {
  if (!date) return null
  const h = (heure && /^\d{2}:\d{2}/.test(heure)) ? heure.slice(0, 5) : '00:00'
  const local = new Date(date + 'T' + h + ':00')
  if (Number.isNaN(local.getTime())) return null
  return local.toISOString()
}
