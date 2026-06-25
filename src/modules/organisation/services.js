// ============================================================
// MODULE ORGANISATION — services.js
// Services Supabase isolés — tout filtré par entreprise_id
// RÈGLE : Toutes les requêtes doivent filtrer par entreprise_id
// ============================================================

import { supabase } from '../../lib/supabase.js';

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
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Désactivation logique — jamais suppression physique
export async function desactiverEmploye(id) {
  return updateEmploye(id, { actif: false });
}

export async function reactiversEmploye(id) {
  return updateEmploye(id, { actif: true });
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
