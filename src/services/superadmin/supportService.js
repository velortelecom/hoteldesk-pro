function normalizeBackendState(error) {
  if (!error) return 'ok'
  const msg = String(error.message || error || '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('schema cache')) return 'non_configure'
  return 'indisponible'
}

export function normalizeTicketRow(row = {}) {
  return {
    id: row.id || row.ticket_id || row.uuid || Math.random().toString(36).slice(2),
    title: row.title || row.titre || row.subject || 'Ticket sans titre',
    description: row.description || row.message || row.contenu || '',
    status: row.status || row.statut || 'open',
    priority: row.priority || row.priorite || 'normal',
    entreprise_id: row.entreprise_id || row.company_id || null,
    created_at: row.created_at || row.date_creation || null,
    updated_at: row.updated_at || row.date_maj || null,
    raw: row,
  }
}

export function filterSupportTickets(rows = [], searchQuery = '', filters = {}) {
  const needle = (searchQuery || '').trim().toLowerCase()
  const status = filters.status || ''
  const priority = filters.priority || ''

  return rows.filter((row) => {
    if (status && String(row.status || '').toLowerCase() !== status.toLowerCase()) return false
    if (priority && String(row.priority || '').toLowerCase() !== priority.toLowerCase()) return false
    if (!needle) return true

    return [row.title, row.description, row.status, row.priority]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
}

export async function fetchSupportTicketsData(supabase) {
  const ticketsRes = await supabase.from('maintenance_tickets').select('*').order('created_at', { ascending: false }).limit(300)

  const state = normalizeBackendState(ticketsRes.error)
  if (state !== 'ok') {
    return {
      backendState: state,
      rows: [],
    }
  }

  return {
    backendState: 'ok',
    rows: (ticketsRes.data || []).map((row) => normalizeTicketRow(row)),
  }
}

export async function createSupportTicket(supabase, payload) {
  const firstAttempt = {
    titre: payload.title,
    description: payload.description,
    statut: payload.status || 'ouvert',
    priorite: payload.priority || 'normal',
    entreprise_id: payload.entreprise_id || null,
  }

  const firstRes = await supabase.from('maintenance_tickets').insert(firstAttempt).select('*').limit(1)
  if (!firstRes.error) return normalizeTicketRow((firstRes.data || [])[0] || firstAttempt)

  const secondAttempt = {
    title: payload.title,
    description: payload.description,
    status: payload.status || 'open',
    priority: payload.priority || 'normal',
    entreprise_id: payload.entreprise_id || null,
  }

  const secondRes = await supabase.from('maintenance_tickets').insert(secondAttempt).select('*').limit(1)
  if (secondRes.error) throw secondRes.error

  return normalizeTicketRow((secondRes.data || [])[0] || secondAttempt)
}
