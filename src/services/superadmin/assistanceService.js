function normalizeBackendState(error) {
  if (!error) return 'ok'
  const msg = String(error.message || error || '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('schema cache')) return 'non_configure'
  return 'indisponible'
}

async function closeExpiredSessionsIfAvailable(supabase) {
  const rpcRes = await supabase.rpc('super_admin_close_expired_assistance_sessions')
  if (!rpcRes.error) return

  const msg = String(rpcRes.error?.message || '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('schema cache')) {
    return
  }
}

export function buildAssistanceInsertPayload({ actorProfileId, entrepriseId, reason, durationMinutes = 30, readonlyMode = true }) {
  if (!actorProfileId || !entrepriseId || !String(reason || '').trim()) {
    throw new Error('missing_assistance_fields')
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + Number(durationMinutes || 30) * 60 * 1000)

  return {
    super_admin_profile_id: actorProfileId,
    entreprise_id: entrepriseId,
    reason: String(reason).trim(),
    duration_minutes: Number(durationMinutes || 30),
    readonly_mode: readonlyMode !== false,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    closed_at: null,
  }
}

export function normalizeAssistanceRow(row = {}) {
  return {
    id: row.id,
    super_admin_profile_id: row.super_admin_profile_id || row.actor_profile_id || null,
    entreprise_id: row.entreprise_id || null,
    reason: row.reason || row.motif || '',
    duration_minutes: row.duration_minutes || 30,
    readonly_mode: row.readonly_mode !== false,
    created_at: row.created_at || null,
    expires_at: row.expires_at || null,
    closed_at: row.closed_at || null,
    raw: row,
  }
}

export function extractActiveAssistanceSession(rows = [], nowIso = new Date().toISOString()) {
  const now = new Date(nowIso)
  return (rows || []).map(normalizeAssistanceRow).find((row) => {
    if (row.closed_at) return false
    if (!row.expires_at) return true
    return new Date(row.expires_at) > now
  }) || null
}

async function logAssistanceAuditEvent(supabase, payload) {
  try {
    await supabase.from('audit_events').insert(payload)
  } catch {
    // best effort audit logging
  }
}

export async function fetchAssistanceState(supabase, actorProfileId) {
  await closeExpiredSessionsIfAvailable(supabase)

  const res = await supabase
    .from('super_admin_assistance_sessions')
    .select('id, super_admin_profile_id, entreprise_id, reason, duration_minutes, readonly_mode, created_at, expires_at, closed_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const backendState = normalizeBackendState(res.error)
  if (backendState !== 'ok') {
    return { backendState, rows: [], activeSession: null }
  }

  const rows = (res.data || []).map(normalizeAssistanceRow)
  const scopedRows = actorProfileId ? rows.filter((row) => row.super_admin_profile_id === actorProfileId) : rows
  const activeSession = extractActiveAssistanceSession(scopedRows)

  return {
    backendState,
    rows: scopedRows,
    activeSession,
  }
}

export async function openAssistanceSession(supabase, { actorProfileId, entrepriseId, reason, durationMinutes = 30, readonlyMode = true }) {
  await closeExpiredSessionsIfAvailable(supabase)

  const current = await fetchAssistanceState(supabase, actorProfileId)
  if (current.backendState !== 'ok') throw new Error('assistance_backend_unavailable')
  if (current.activeSession) throw new Error('assistance_session_already_active')

  const payload = buildAssistanceInsertPayload({
    actorProfileId,
    entrepriseId,
    reason,
    durationMinutes,
    readonlyMode,
  })

  const insertRes = await supabase
    .from('super_admin_assistance_sessions')
    .insert(payload)
    .select('id, super_admin_profile_id, entreprise_id, reason, duration_minutes, readonly_mode, created_at, expires_at, closed_at')
    .limit(1)

  if (insertRes.error) {
    const raw = String(insertRes.error?.message || '').toLowerCase()
    if (insertRes.error?.code === '23505' || raw.includes('uq_sa_assistance_single_open') || raw.includes('unique')) {
      throw new Error('assistance_session_already_active')
    }
    throw insertRes.error
  }

  const session = normalizeAssistanceRow((insertRes.data || [])[0] || payload)

  await logAssistanceAuditEvent(supabase, {
    acteur_profile_id: actorProfileId,
    entreprise_id: entrepriseId,
    action: 'assistance_opened',
    type_cible: 'assistance_session',
    cible_id: session.id || null,
    description: 'Ouverture session assistance',
    metadonnees: {
      readonly_mode: session.readonly_mode,
      expires_at: session.expires_at,
      reason: session.reason,
    },
  })

  return session
}

export async function closeAssistanceSession(supabase, { sessionId, actorProfileId }) {
  if (!sessionId) throw new Error('missing_assistance_session_id')

  const updateRes = await supabase
    .from('super_admin_assistance_sessions')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (updateRes.error) throw updateRes.error

  await logAssistanceAuditEvent(supabase, {
    acteur_profile_id: actorProfileId || null,
    action: 'assistance_closed',
    type_cible: 'assistance_session',
    cible_id: sessionId,
    description: 'Fermeture session assistance',
    metadonnees: {},
  })
}
