import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'
import { createBusinessEvent, createNotification } from './notifications'

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
  const role = profile?.role || 'employe'
  let query = supabase
    .from('taches')
    .select('*')
    .eq('entreprise_id', enterpriseId)
    .order('date_echeance', { ascending: true })

  if (roleFilters.onlyAssignedToCurrentUser) query = query.eq('assigne_a', profileId)
  if (role === 'chef_equipe') query = query.or('assigne_a.eq.' + profileId + ',cree_par.eq.' + profileId)

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
  const { data, error } = await supabase.from('taches').update({ statut }).eq('id', id).select('id, titre, assigne_a').single()
  if (error) throw error

  return data
}

export async function saveTask(profile, payload, editTache) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)

  if (editTache?.id) {
    const { data, error } = await supabase.from('taches').update(payload).eq('id', editTache.id).select('id, titre, assigne_a').single()
    if (error) throw error
    await createBusinessEvent(profile, {
      eventType: 'task_updated',
      title: 'Tâche modifiée',
      description: payload.titre,
      resourceType: 'tache',
      resourceId: data?.id || editTache.id,
      payload: { assigne_a: data?.assigne_a || null },
    })
    return
  }

  const { data, error } = await supabase.from('taches').insert({ ...payload, cree_par: profileId, entreprise_id: enterpriseId }).select('id, titre, assigne_a').single()
  if (error) throw error

  await createBusinessEvent(profile, {
    eventType: 'task_created',
    title: 'Tâche créée',
    description: payload.titre,
    resourceType: 'tache',
    resourceId: data?.id || null,
    payload: { assigne_a: data?.assigne_a || null },
  })

  if (data?.assigne_a && data.assigne_a !== profileId) {
    await createNotification(profile, {
      recipientId: data.assigne_a,
      type: 'task_assigned',
      title: 'Nouvelle tâche',
      content: payload.titre,
      link: '/taches',
      resourceType: 'tache',
      resourceId: data.id,
    })
  }
}
