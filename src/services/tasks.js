import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'

export async function fetchTaskMembers(profile) {
  const enterpriseId = requireEnterpriseId(profile)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, prenom, nom, role, departement')
    .eq('entreprise_id', enterpriseId)
    .order('nom')

  if (error) throw error
  return data || []
}

export async function fetchTasks(profile, roleFilters = {}) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  let query = supabase
    .from('taches')
    .select('*')
    .eq('entreprise_id', enterpriseId)
    .order('date_echeance', { ascending: true })

  if (roleFilters.onlyAssignedToCurrentUser) query = query.eq('assigne_a', profileId)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function deleteTask(id, isParent) {
  if (isParent) {
    const { error: childError } = await supabase.from('taches').delete().eq('tache_parente_id', id)
    if (childError) throw childError
  }
  const { error } = await supabase.from('taches').delete().eq('id', id)
  if (error) throw error
}

export async function updateTaskStatus(id, statut) {
  const { error } = await supabase.from('taches').update({ statut }).eq('id', id)
  if (error) throw error
}

export async function saveTask(profile, payload, editTache) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)

  if (editTache?.id) {
    const { error } = await supabase.from('taches').update(payload).eq('id', editTache.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('taches').insert({ ...payload, cree_par: profileId, entreprise_id: enterpriseId })
  if (error) throw error
}
