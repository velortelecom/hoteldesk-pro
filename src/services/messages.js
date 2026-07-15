import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'
import { createBusinessEvent, createNotification } from './notifications'

export async function fetchMessageContacts(profile) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', profileId)
    .eq('entreprise_id', enterpriseId)
    .order('nom')

  if (error) throw error
  return data || []
}

export async function fetchConversationMessages(profile, selectedId) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('entreprise_id', enterpriseId)
    .or(`and(expediteur_id.eq.${profileId},destinataire_id.eq.${selectedId}),and(expediteur_id.eq.${selectedId},destinataire_id.eq.${profileId})`)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function markConversationRead(profile, selectedId) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const { error } = await supabase
    .from('messages')
    .update({ lu: true })
    .eq('entreprise_id', enterpriseId)
    .eq('expediteur_id', selectedId)
    .eq('destinataire_id', profileId)
    .eq('lu', false)

  if (error) throw error
}

export async function sendConversationMessage(profile, selectedId, texte) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const { data, error } = await supabase.from('messages').insert({
    expediteur_id: profileId,
    destinataire_id: selectedId,
    contenu: texte.trim(),
    entreprise_id: enterpriseId,
  }).select('id').single()

  if (error) throw error

  await Promise.all([
    createBusinessEvent(profile, {
      eventType: 'message_sent',
      title: 'Message envoyé',
      description: texte.trim(),
      resourceType: 'message',
      resourceId: data?.id || null,
      payload: { recipient_id: selectedId },
    }),
    createNotification(profile, {
      recipientId: selectedId,
      type: 'message_received',
      title: 'Nouveau message',
      content: texte.trim(),
      link: '/messages',
      resourceType: 'message',
      resourceId: data?.id || null,
      payload: { expediteur_id: profileId },
    }),
  ])
}
