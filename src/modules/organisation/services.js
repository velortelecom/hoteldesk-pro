// ============================================================
// MODULE ORGANISATION — services.js
// Services Supabase isolés — tout filtré par entreprise_id
// RÈGLE : Toutes les requêtes doivent filtrer par entreprise_id
// ============================================================

import { supabase } from '../../lib/supabase.js';
import { messageErreurEdge } from '../../lib/edgeErreur.js';
import { messageSuppressionMembre } from '../../lib/erreurSuppressionMembre.js';
import { normaliserPayloadProfil } from '../../lib/profilPayload.js';

// ============================================================
// DÉPARTEMENTS
// ============================================================

export async function getDepartements(entrepriseId) {
  const { data, error } = await supabase
    .from('departements')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .eq('actif', true)
    .order('ordre', { ascending: true })
    .order('nom', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createDepartement(entrepriseId, payload) {
  const { data, error } = await supabase
    .from('departements')
    .insert({ ...payload, entreprise_id: entrepriseId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDepartement(id, payload) {
  const { data, error } = await supabase
    .from('departements')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleDepartementActif(id, actif) {
  return updateDepartement(id, { actif });
}

// ============================================================
// POSTES
// ============================================================

export async function getPostes(entrepriseId, departementId = null) {
  let query = supabase
    .from('postes')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .eq('actif', true)
    .order('niveau', { ascending: false })
    .order('nom', { ascending: true });

  if (departementId) {
    query = query.eq('departement_id', departementId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPoste(entrepriseId, payload) {
  const { data, error } = await supabase
    .from('postes')
    .insert({ ...payload, entreprise_id: entrepriseId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePoste(id, payload) {
  const { data, error } = await supabase
    .from('postes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function togglePosteActif(id, actif) {
  return updatePoste(id, { actif });
}

// ============================================================
// EMPLOYÉS (PROFILES)
// ============================================================

export async function getEmployes(entrepriseId, options = {}) {
  const { departementId, includeInactif = false } = options;

  let query = supabase
    .from('profiles')
    .select(`
      *,
      poste:poste_id(id, nom, couleur, icone, niveau),
      poste_secondaire:poste_secondaire_id(id, nom),
      employe_departements(
        id,
        est_principal,
        departement:departement_id(id, nom, couleur, icone)
      )
    `)
    .eq('entreprise_id', entrepriseId)
    .order('nom', { ascending: true });

  if (!includeInactif) {
    query = query.eq('actif', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getEmployeById(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      poste:poste_id(id, nom, couleur, icone, niveau),
      poste_secondaire:poste_secondaire_id(id, nom),
      employe_departements(
        id,
        est_principal,
        date_debut,
        date_fin,
        departement:departement_id(id, nom, couleur, icone)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmploye(id, payload) {
  // Les champs de formulaire vides valent "" : invalide pour une colonne
  // date ou uuid. On normalise ici plutot que dans chaque ecran, pour que
  // tous les appelants en beneficient.
  const { data, error } = await supabase
    .from('profiles')
    .update(normaliserPayloadProfil(payload))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Désactivation logique — jamais suppression physique
export async function desactiverEmploye(id) {
  const { data, error } = await supabase.functions.invoke('toggle-user-actif', { body: { user_id: id, actif: false } });
  if (error) throw new Error(await messageErreurEdge(error, 'Desactivation impossible.'));
  if (data && data.success === false) throw new Error(data.error || 'Desactivation impossible.');
  return data;
}

export async function reactiversEmploye(id) {
  const { data, error } = await supabase.functions.invoke('toggle-user-actif', { body: { user_id: id, actif: true } });
  if (error) throw new Error(await messageErreurEdge(error, 'Reactivation impossible.'));
  if (data && data.success === false) throw new Error(data.error || 'Reactivation impossible.');
  return data;
}

// ============================================================
// ACTIONS SENSIBLES — via Edge Functions (create-user, delete-user, update-user-role, reset-password, toggle-user-actif)
// Aucune de ces actions ne doit jamais manipuler directement service_role ou l'API admin depuis le frontend.
// ============================================================

export async function creerEmploye(entrepriseId, payload) {
  const body = {
    prenom: payload.prenom,
    nom: payload.nom,
    role: payload.role,
    entreprise_id: entrepriseId,
    email: payload.email || undefined,
    telephone: payload.telephone || null,
    poste_id: payload.poste_id || null,
    poste_secondaire_id: payload.poste_secondaire_id || null,
    departement_ids: (payload.departement_ids && payload.departement_ids.length > 0) ? payload.departement_ids : undefined,
    langue: payload.langue || 'fr',
    actif: payload.actif !== false,
  };
  const { data, error } = await supabase.functions.invoke('create-user', { body });
  if (error) throw new Error(await messageErreurEdge(error, 'Creation impossible.'));
  if (data && data.success === false) throw new Error(data.error || 'Creation impossible.');
  return data;
}

// Une seule voie de suppression pour toute l'application.
//
// Cet ecran appelait la fonction serveur delete-user, tandis que le Super
// Admin appelait la fonction en base supprimer_membre_complet. Deux codes,
// deux listes de nettoyage, deux facons d'echouer -- et de fait, elles ont
// echoue separement, a un jour d'intervalle, pour des raisons differentes.
//
// On garde la fonction en base : elle fait tout en UNE transaction (donc
// jamais de suppression a moitie faite), elle n'a pas de surface CORS, et
// elle ne demande pas de deploiement separe.
export async function supprimerEmploye(employeId) {
  const { data, error } = await supabase.rpc('supprimer_membre_complet', { p_user_id: employeId });
  if (error) throw new Error(messageSuppressionMembre(error));
  return data;
}

export async function changerRoleEmploye(employeId, nouveauRole) {
  const { data, error } = await supabase.functions.invoke('update-user-role', { body: { user_id: employeId, new_role: nouveauRole } });
  if (error) throw error;
  if (data && data.success === false) throw new Error(data.error || 'Erreur lors du changement de role');
  return data;
}

export async function reinitialiserMotDePasseEmploye(employeId) {
  const { data, error } = await supabase.functions.invoke('reset-password', { body: { user_id: employeId } });
  if (error) throw error;
  if (data && data.success === false) throw new Error(data.error || 'Erreur lors de la reinitialisation du mot de passe');
  return data;
}

// ============================================================
// MULTI-DÉPARTEMENTS (employe_departements)
// ============================================================

export async function getEmployeDepartements(profileId) {
  const { data, error } = await supabase
    .from('employe_departements')
    .select(`
      *,
      departement:departement_id(id, nom, couleur, icone)
    `)
    .eq('profile_id', profileId);

  if (error) throw error;
  return data || [];
}

export async function setEmployeDepartements(profileId, entrepriseId, departementIds, principalId) {
  // Supprimer les anciennes affiliations
  await supabase
    .from('employe_departements')
    .delete()
    .eq('profile_id', profileId);

  if (!departementIds || departementIds.length === 0) return [];

  // Insérer les nouvelles affiliations
  const rows = departementIds.map(did => ({
    profile_id: profileId,
    departement_id: did,
    entreprise_id: entrepriseId,
    est_principal: did === principalId,
  }));

  const { data, error } = await supabase
    .from('employe_departements')
    .insert(rows)
    .select();

  if (error) throw error;
  return data || [];
}

// ============================================================
// STATISTIQUES (pour widgets dashboard)
// ============================================================

export async function getStatsOrganisation(entrepriseId) {
  const [employes, departements, postes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }).eq('entreprise_id', entrepriseId).eq('actif', true),
    supabase.from('departements').select('id', { count: 'exact' }).eq('entreprise_id', entrepriseId).eq('actif', true),
    supabase.from('postes').select('id', { count: 'exact' }).eq('entreprise_id', entrepriseId).eq('actif', true),
  ]);

  return {
    totalEmployes: employes.count || 0,
    totalDepartements: departements.count || 0,
    totalPostes: postes.count || 0,
  };
}

// Liste blanche des onglets visibles par une personne.
// Passe par une RPC SECURITY DEFINER : elle verifie que l'appelant est
// Super Admin, ou administrateur de la MEME entreprise que la cible, et
// refuse de restreindre un Super Admin.
export async function definirMenusAutorises(profileId, menus) {
  const { error } = await supabase.rpc('definir_menus_autorises', {
    p_profile_id: profileId,
    p_menus: (menus && menus.length > 0) ? menus : null,
  });
  if (error) throw error;
}
