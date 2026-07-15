import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'

export async function createBusinessEvent(profile, payload) {
  const entrepriseId = requireEnterpriseId(profile)
  const actorId = requireProfileId(profile)

  const { error } = await supabase.from('business_events').insert({
    entreprise_id: entrepriseId,
    actor_id: actorId,
    event_type: payload.eventType,
    title: payload.title,
    description: payload.description || null,
    resource_type: payload.resourceType || null,
    resource_id: payload.resourceId || null,
    payload: payload.payload || {},
  })

  if (error) throw error
}

export async function createNotification(profile, payload) {
  const entrepriseId = requireEnterpriseId(profile)
  const actorId = requireProfileId(profile)

  const { error } = await supabase.from('notifications').insert({
    entreprise_id: entrepriseId,
    recipient_id: payload.recipientId,
    actor_id: actorId,
    type: payload.type,
    title: payload.title,
    content: payload.content || null,
    link: payload.link || null,
    resource_type: payload.resourceType || null,
    resource_id: payload.resourceId || null,
    payload: payload.payload || {},
  })

  if (error) throw error
}

export async function fetchRecentNotifications(profile, limit = 10) {
  const profileId = requireProfileId(profile)
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function fetchUnreadNotificationCount(profile) {
  const profileId = requireProfileId(profile)
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', profileId)
    .is('read_at', null)

  if (error) throw error
  return count || 0
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}