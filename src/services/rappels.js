import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'

function buildRoleScopedTaskQuery(profile, userRole) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  let query = supabase
    .from('taches')
    .eq('entreprise_id', enterpriseId)
    .eq('statut', 'planifiee')
    .is('tache_parente_id', null)

  if (userRole === 'employe') query = query.eq('assigne_a', profileId)
  if (userRole === 'responsable') query = query.or('assigne_a.eq.' + profileId + ',cree_par.eq.' + profileId)

  return query
}

export async function fetchManualReminders(profile) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const { data, error } = await supabase
    .from('rappels')
    .select('*, assignee:profiles!rappels_assigne_a_fkey(nom,prenom), createur:profiles!rappels_cree_par_fkey(nom,prenom)')
    .eq('entreprise_id', enterpriseId)
    .or('cree_par.eq.' + profileId + ',assigne_a.eq.' + profileId)
    .order('date_rappel', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchReminderTasks(profile, userRole) {
  const query = buildRoleScopedTaskQuery(profile, userRole)
  const { data, error } = await query.select('*, assignee:profiles!taches_assigne_a_fkey(nom,prenom)')
  if (error) throw error
  return data || []
}

export async function fetchReminderNotificationTasks(profile, userRole) {
  const query = buildRoleScopedTaskQuery(profile, userRole)
  const { data, error } = await query.select('*')
  if (error) throw error
  return data || []
}

export async function fetchReminderAssignees(profile) {
  const enterpriseId = requireEnterpriseId(profile)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, prenom, nom')
    .eq('entreprise_id', enterpriseId)
    .eq('actif', true)
    .order('nom')

  if (error) throw error
  return data || []
}

export async function createReminder(profile, form, dateRappel) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const { error } = await supabase.from('rappels').insert({
    ...form,
    date_rappel: dateRappel,
    cree_par: profileId,
    assigne_a: form.assigne_a || null,
    entreprise_id: enterpriseId,
  })

  if (error) throw error
}

export async function deleteReminder(id) {
  const { error } = await supabase.from('rappels').delete().eq('id', id)
  if (error) throw error
}

export async function updateReminderTaskStatus(id, patch) {
  const { error } = await supabase.from('taches').update(patch).eq('id', id)
  if (error) throw error
}
