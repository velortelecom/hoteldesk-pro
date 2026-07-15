import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'
import { createBusinessEvent, createNotification } from './notifications'

export async function ensureDirectConversation(profile, otherProfileId) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)

  const { data: participantRows, error: participantError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, profile_id')
    .eq('entreprise_id', enterpriseId)
    .in('profile_id', [profileId, otherProfileId])

  if (participantError) throw participantError

  const grouped = (participantRows || []).reduce((acc, row) => {
    if (!acc[row.conversation_id]) acc[row.conversation_id] = []
    acc[row.conversation_id].push(row.profile_id)
    return acc
  }, {})

  const existingConversationId = Object.entries(grouped).find(([, ids]) => ids.includes(profileId) && ids.includes(otherProfileId) && ids.length === 2)?.[0]
  if (existingConversationId) return existingConversationId

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      entreprise_id: enterpriseId,
      type: 'direct',
      created_by: profileId,
    })
    .select('id')
    .single()

  if (conversationError) throw conversationError

  const { error: participantsError } = await supabase.from('conversation_participants').insert([
    { conversation_id: conversation.id, entreprise_id: enterpriseId, profile_id: profileId, role: 'owner' },
    { conversation_id: conversation.id, entreprise_id: enterpriseId, profile_id: otherProfileId, role: 'member' },
  ])

  if (participantsError) throw participantsError
  return conversation.id
}

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
  const conversationId = await ensureDirectConversation(profile, selectedId)
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('entreprise_id', enterpriseId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return { conversationId, messages: data || [] }
}

export async function markConversationRead(profile, selectedId) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const conversationId = await ensureDirectConversation(profile, selectedId)
  const { error } = await supabase
    .from('messages')
    .update({ lu: true })
    .eq('entreprise_id', enterpriseId)
    .eq('conversation_id', conversationId)
    .eq('expediteur_id', selectedId)
    .eq('destinataire_id', profileId)
    .eq('lu', false)

  if (error) throw error
}

export async function sendConversationMessage(profile, selectedId, texte) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const conversationId = await ensureDirectConversation(profile, selectedId)
  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
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
      payload: { expediteur_id: profileId, conversation_id: conversationId },
    }),
  ])
}
