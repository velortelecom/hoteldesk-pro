// src/modules/support/index.jsx
// MODULE: Support & Assistance - v1.0.0
// Permet a un client d'ouvrir un ticket de support et d'echanger des messages avec la plateforme.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PRIORITES = {
basse: { label: 'Basse', couleur: '#6B7280' },
moyenne: { label: 'Moyenne', couleur: '#3B82F6' },
haute: { label: 'Haute', couleur: '#EF4444' },
}

const STATUTS = { 
ouvert: { label: 'Ouvert', couleur: '#F59E0B', bg: '#FEF3C7' },
en_cours: { label: 'En cours', couleur: '#3B82F6', bg: '#DBEAFE' },
resolu: { label: 'Resolu', couleur: '#10B981', bg: '#D1FAE5' },
}

const cardStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }
const inputStyle = { border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' }
const btnStyle = { border: 'none', borderRadius: 8, background: '#2563EB', color: '#fff', padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }

export default function SupportModule() {
const [loading, setLoading] = useState(true)
const [msg, setMsg] = useState(null)
const [profile, setProfile] = useState(null)
const [tickets, setTickets] = useState([])
const [selected, setSelected] = useState(null)
const [messages, setMessages] = useState([])
const [reply, setReply] = useState('')
const [sending, setSending] = useState(false)
const [showForm, setShowForm] = useState(false)
const [form, setForm] = useState({ titre: '', description: '', priorite: 'moyenne' })
const [creating, setCreating] = useState(false)

useEffect(() => { init() }, [])

async function init() {
setLoading(true)
try {
const { data: authData } = await supabase.auth.getUser()
const userId = authData?.user?.id
if (!userId) throw new Error('non_authentifie')
const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single()
setProfile(prof)
await loadTickets(prof)
} catch (error) {
setMsg({ type: 'error', text: 'Impossible de charger le support.' })
} finally {
setLoading(false)
}
}

async function loadTickets(prof) {
const entrepriseId = prof?.entreprise_id
if (!entrepriseId) return
const { data, error } = await supabase
.from('maintenance_tickets')
.select('*')
.eq('entreprise_id', entrepriseId)
.order('created_at', { ascending: false })
if (!error) setTickets(data || [])
}

async function creerTicket() {
if (!form.titre.trim()) {
setMsg({ type: 'error', text: 'Le titre est obligatoire.' })
return
}
setCreating(true)
setMsg(null)
try {
const payload = {
titre: form.titre.trim(),
description: form.description.trim() || null,
priorite: form.priorite,
statut: 'ouvert',
categorie: 'autre',
entreprise_id: profile.entreprise_id,
cree_par: profile.id,
}
const { data, error } = await supabase.from('maintenance_tickets').insert(payload).select('*').single()
if (error) throw error
setForm({ titre: '', description: '', priorite: 'moyenne' })
setShowForm(false)
setMsg({ type: 'success', text: 'Ticket cree. Le support va vous repondre ici.' })
await loadTickets(profile)
ouvrirTicket(data)
} catch (error) {
setMsg({ type: 'error', text: 'Erreur lors de la creation du ticket.' })
} finally {
setCreating(false)
}
}

async function ouvrirTicket(ticket) {
setSelected(ticket)
setMessages([])
const { data, error } = await supabase
.from('ticket_messages')
.select('*')
.eq('ticket_id', ticket.id)
.order('created_at', { ascending: true })
if (!error) setMessages(data || [])
}

async function envoyerReponse() {
if (!reply.trim() || !selected) return
setSending(true)
try {
const payload = {
ticket_id: selected.id,
entreprise_id: profile.entreprise_id,
sender_profile_id: profile.id,
sender_role: profile.role || 'client',
message: reply.trim(),
}
const { error } = await supabase.from('ticket_messages').insert(payload)
if (error) throw error
setReply('')
await ouvrirTicket(selected)
} catch (error) {
setMsg({ type: 'error', text: "Erreur lors de l'envoi du message." })
} finally {
setSending(false)
}
}

if (loading) return <div style={{ padding: 20 }}>Chargement...</div>

return (
<div style={{ display: 'grid', gap: 14, padding: 4 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
<div>
<h2 style={{ margin: 0 }}>Support & Assistance</h2>
<div style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Contactez la plateforme et suivez vos demandes.</div>
</div>
<button style={btnStyle} onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Nouveau ticket'}</button>
</div>

{msg && (
<div style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
{msg.text}
</div>
)}

{showForm && (
<div style={cardStyle}>
<div style={{ display: 'grid', gap: 8 }}>
<input style={inputStyle} placeholder="Titre de la demande" value={form.titre} onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))} />
<textarea style={{ ...inputStyle, minHeight: 80 }} placeholder="Decrivez votre demande" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
<select style={inputStyle} value={form.priorite} onChange={(e) => setForm((p) => ({ ...p, priorite: e.target.value }))}>
{Object.entries(PRIORITES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
</select>
<button style={btnStyle} disabled={creating} onClick={creerTicket}>{creating ? 'Creation...' : 'Envoyer la demande'}</button>
</div>
</div>
)}

<div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.3fr' : '1fr', gap: 14 }}>
<div style={cardStyle}>
<h4 style={{ marginTop: 0 }}>Mes tickets</h4>
{tickets.length === 0 && <div style={{ color: '#64748B', fontSize: 13 }}>Aucun ticket pour le moment.</div>}
<div style={{ display: 'grid', gap: 8 }}>
{tickets.map((t) => {
const st = STATUTS[t.statut] || STATUTS.ouvert
return (
<div key={t.id} onClick={() => ouvrirTicket(t)} style={{ border: selected?.id === t.id ? '2px solid #2563EB' : '1px solid #E2E8F0', borderRadius: 8, padding: 10, cursor: 'pointer' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
<strong style={{ fontSize: 13 }}>{t.titre}</strong>
<span style={{ fontSize: 11, fontWeight: 700, color: st.couleur, background: st.bg, borderRadius: 6, padding: '2px 8px' }}>{st.label}</span>
</div>
<div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{new Date(t.created_at).toLocaleString('fr-FR')}</div>
</div>
)
})}
</div>
</div>

{selected && (
<div style={cardStyle}>
<h4 style={{ marginTop: 0 }}>{selected.titre}</h4>
<div style={{ color: '#64748B', fontSize: 13, marginBottom: 10 }}>{selected.description}</div>
<div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
{messages.length === 0 && <div style={{ color: '#94A3B8', fontSize: 12 }}>Aucun message pour l'instant.</div>}
{messages.map((m) => {
const isSupport = m.sender_role === 'super_admin'
return (
<div key={m.id} style={{ alignSelf: isSupport ? 'flex-start' : 'flex-end', maxWidth: '85%', background: isSupport ? '#F1F5F9' : '#DBEAFE', borderRadius: 8, padding: '8px 10px' }}>
<div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>{isSupport ? 'Support Velor One' : 'Vous'}</div>
<div style={{ fontSize: 13 }}>{m.message}</div>
<div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{new Date(m.created_at).toLocaleString('fr-FR')}</div>
</div>
)
})}
</div>
<div style={{ display: 'flex', gap: 8 }}>
<input style={inputStyle} placeholder="Ecrire un message..." value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') envoyerReponse() }} />
<button style={btnStyle} disabled={sending} onClick={envoyerReponse}>{sending ? '...' : 'Envoyer'}</button>
</div>
</div>
)}
</div>
</div>
)
}
