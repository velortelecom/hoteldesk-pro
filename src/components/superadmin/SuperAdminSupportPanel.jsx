import { useEffect, useMemo, useState } from 'react'
import { mapSuperAdminError } from '../../pages/superAdminControlUtils'
import { createSupportTicket, fetchSupportTicketsData, filterSupportTickets, fetchTicketMessages, createTicketMessage } from '../../services/superadmin/supportService'
const cardStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }
const inputStyle = { border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 10px', fontSize: 12 }

export default function SuperAdminSupportPanel({ supabase, searchQuery, entreprises = [] }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [dataset, setDataset] = useState({ backendState: 'ok', rows: [] })
  const [filters, setFilters] = useState({ status: '', priority: '' })
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', entreprise_id: '' })
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketMessages, setTicketMessages] = useState([])
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const next = await fetchSupportTicketsData(supabase)
      setDataset(next)
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Chargement tickets impossible.') })
    } finally {
      setLoading(false)
    }
  }

  async function abrirTicket(row) {
    setSelectedTicket(row)
    setTicketMessages([])
    try {
      const msgs = await fetchTicketMessages(supabase, row.id)
      setTicketMessages(msgs)
    } catch (error) {
      setMsg({ type: 'error', text: 'Chargement des messages impossible.' })
    }
  }

  async function envoyerReponse() {
    if (!replyText.trim() || !selectedTicket) return
    setSendingReply(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const adminId = authData?.user?.id
      await createTicketMessage(supabase, {
        ticketId: selectedTicket.id,
        entrepriseId: selectedTicket.entreprise_id || null,
        senderProfileId: adminId,
        senderRole: 'super_admin',
        message: replyText.trim(),

  async function submitTicket() {
    if (!form.title.trim() || !form.description.trim()) {
      setMsg({ type: 'error', text: 'Titre et description obligatoires.' })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      await createSupportTicket(supabase, {
        title: form.title,
        description: form.description,
        priority: form.priority,
        entreprise_id: form.entreprise_id || null,
      })
      setForm({ title: '', description: '', priority: 'normal', entreprise_id: '' })
      setMsg({ type: 'success', text: 'Ticket support cree.' })
      await load()
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Creation ticket impossible sur ce schema.') })
    } finally {
      setSaving(false)
    }
  }

  const visibleRows = useMemo(() => filterSupportTickets(dataset.rows, searchQuery, filters), [dataset.rows, searchQuery, filters])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {msg && (
        <section style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </section>
      )}

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Support tickets</h3>
            <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>Suivi des incidents et demandes support plateforme.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} style={inputStyle}>
              <option value=''>Tous statuts</option>
              <option value='open'>Open</option>
              <option value='ouvert'>Ouvert</option>
              <option value='closed'>Closed</option>
              <option value='ferme'>Ferme</option>
            </select>
            <select value={filters.priority} onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))} style={inputStyle}>
              <option value=''>Toutes priorites</option>
              <option value='low'>Low</option>
              <option value='normal'>Normal</option>
              <option value='high'>High</option>
              <option value='haute'>Haute</option>
            </select>
            <button onClick={load} style={{ border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Rafraichir
            </button>
          </div>
        </div>
      </section>

      {dataset.backendState !== 'ok' && (
        <section style={{ ...cardStyle, background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}>
          <strong>Etat support: {dataset.backendState === 'non_configure' ? 'Non configure' : 'Indisponible'}</strong>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            La table maintenance_tickets n est pas exploitable actuellement. Le panneau reste operationnel en lecture degradee.
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <h4 style={{ marginTop: 0 }}>Nouveau ticket</h4>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder='Titre incident' style={inputStyle} />
          <select value={form.entreprise_id} onChange={(event) => setForm((prev) => ({ ...prev, entreprise_id: event.target.value }))} style={inputStyle}>
            <option value=''>Plateforme globale</option>
            {entreprises.map((ent) => <option key={ent.id} value={ent.id}>{ent.nom}</option>)}
          </select>
          <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} style={inputStyle}>
            <option value='low'>Low</option>
            <option value='normal'>Normal</option>
            <option value='high'>High</option>
          </select>
          <button disabled={saving || dataset.backendState !== 'ok'} onClick={submitTicket} style={{ border: 'none', borderRadius: 8, background: saving ? '#93C5FD' : '#2563EB', color: '#fff', padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {saving ? 'Creation...' : 'Creer ticket'}
          </button>
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder='Description incident' style={{ ...inputStyle, minHeight: 90, gridColumn: '1 / span 2' }} />
        </div>
      </section>

      <section style={cardStyle}>
        {loading ? (
          <div style={{ color: '#64748B' }}>Chargement tickets...</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {visibleRows.map((row) => (
              <div key={row.id} onClick={() => abrirTicket(row)} style={{ border: selectedTicket?.id === row.id ? '2px solid #2563EB' : '1px solid #E2E8F0', borderRadius: 10, padding: 10, background: '#F8FAFC', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{row.title}</strong>
                  <span style={{ fontSize: 11, color: '#64748B' }}>{row.created_at ? new Date(row.created_at).toLocaleString('fr-FR') : 'date n/a'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{row.description || 'Sans description'}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#64748B' }}>Statut: {row.status} / Priorite: {row.priority}</div>
              </div>
            ))}
            {visibleRows.length === 0 && <div style={{ color: '#94A3B8' }}>Aucun ticket selon les filtres.</div>}
          </div>
        )}
        {selectedTicket && (
      <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>{selectedTicket.titre || selectedTicket.title}</h4>
        <div style={{ color: '#64748B', fontSize: 12, marginBottom: 10 }}>{selectedTicket.description}</div>
        <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto', margin: '10px 0' }}>
          {ticketMessages.length === 0 && <div style={{ color: '#94A3B8', fontSize: 12 }}>Aucun message pour ce ticket.</div>}
          {ticketMessages.map((m) => {
        const isAdmin = m.sender_role === 'super_admin'
          return (
            <div key={m.id} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '85%', background: isAdmin ? '#DBEAFE' : '#F1F5F9', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>{isAdmin ? 'Support (vous)' : 'Client'}</div>
              <div style={{ fontSize: 13 }}>{m.message}</div>
            </div>
            )
      })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inputStyle} placeholder="Repondre au client..." value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') envoyerReponse() }} />
          <button disabled={sendingReply} onClick={envoyerReponse} style={{ border: 'none', borderRadius: 8, background: sendingReply ? '#93C5FD' : '#2563EB', color: '#fff', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{sendingReply ? '...' : 'Envoyer'}</button>button>
        </div>
      </div>
      )}
      </section>
    </div>
  )
}
