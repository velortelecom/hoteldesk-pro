import { useEffect, useMemo, useState } from 'react'
import { mapSuperAdminError } from './superAdminControlUtils'
import {
  closeAssistanceSession,
  fetchAssistanceState,
  openAssistanceSession,
} from '../services/superadmin/assistanceService'
import { supabase } from '../lib/supabase'

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }
const inputStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

export default function SuperAdminAssistance({ entreprises = [], profile = null, onSessionChange }) {
  const [draft, setDraft] = useState({ entrepriseId: '', reason: '', durationMinutes: 30, readonlyMode: true })
  const [session, setSession] = useState(null)
  const [backendState, setBackendState] = useState('ok')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const entrepriseNom = useMemo(() => (entreprises.find((ent) => ent.id === session?.entreprise_id)?.nom || 'Entreprise inconnue'), [entreprises, session])

  useEffect(() => {
    loadState()
  }, [profile?.id])

  async function loadState() {
    setLoading(true)
    setMsg(null)
    try {
      const state = await fetchAssistanceState(supabase, profile?.id)
      setBackendState(state.backendState)
      setSession(state.activeSession)
      if (onSessionChange) onSessionChange(state)
    } catch (error) {
      setBackendState('indisponible')
      setSession(null)
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Chargement assistance impossible.') })
      if (onSessionChange) onSessionChange({ backendState: 'indisponible', activeSession: null, rows: [] })
    } finally {
      setLoading(false)
    }
  }

  async function openAssistance() {
    if (!profile?.id) {
      setMsg({ type: 'error', text: 'Profil super admin introuvable.' })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      const next = await openAssistanceSession(supabase, {
        actorProfileId: profile.id,
        entrepriseId: draft.entrepriseId,
        reason: draft.reason,
        durationMinutes: draft.durationMinutes,
        readonlyMode: draft.readonlyMode,
      })
      setSession(next)
      setMsg({ type: 'success', text: 'Session assistance ouverte avec succes.' })
      if (onSessionChange) {
        onSessionChange({ backendState, activeSession: next, rows: [next] })
      }
    } catch (error) {
      const raw = String(error?.message || error || '')
      if (raw.includes('assistance_session_already_active')) {
        setMsg({ type: 'error', text: 'Une session assistance est deja active. Fermez-la avant d en ouvrir une nouvelle.' })
      } else {
        setMsg({ type: 'error', text: mapSuperAdminError(error, 'Entreprise cible et motif obligatoire.') })
      }
    } finally {
      setSaving(false)
    }
  }

  async function closeAssistance() {
    if (!session?.id) {
      setSession(null)
      if (onSessionChange) onSessionChange({ backendState, activeSession: null, rows: [] })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      await closeAssistanceSession(supabase, { sessionId: session.id, actorProfileId: profile?.id })
      setSession(null)
      setMsg({ type: 'success', text: 'Session assistance cloturee.' })
      if (onSessionChange) onSessionChange({ backendState, activeSession: null, rows: [] })
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Fermeture assistance impossible.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {backendState !== 'ok' && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 10, padding: 12, fontWeight: 600 }}>
          Assistance {backendState === 'non_configure' ? 'non configuree' : 'indisponible'}: la table super_admin_assistance_sessions est absente ou inaccessible.
        </div>
      )}

      {session && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', borderRadius: 10, padding: 12, fontWeight: 700 }}>
          Mode assistance actif · {entrepriseNom} · motif: {session.reason} · fin prevue: {session.expires_at ? new Date(session.expires_at).toLocaleString('fr-FR') : 'n/a'}
        </div>
      )}

      {msg && (
        <div style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </div>
      )}

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Mode assistance</h3>
        <p style={{ color: '#6B7280', fontSize: 13 }}>
          Ouvrir une session d assistance encadree: raison obligatoire, lecture seule par defaut, duree limitee et audit systematique.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Entreprise cible</label>
          <select value={draft.entrepriseId} onChange={(e) => setDraft((prev) => ({ ...prev, entrepriseId: e.target.value }))} style={inputStyle}>
            <option value=''>Choisir une entreprise</option>
            {entreprises.map((ent) => (
              <option key={ent.id} value={ent.id}>{ent.nom}</option>
            ))}
          </select>
          <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Motif obligatoire</label>
          <textarea value={draft.reason} onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))} style={{ ...inputStyle, minHeight: 88 }} placeholder='Ex: support incident de configuration' />
          <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Duree (minutes)</label>
          <input type='number' min='5' max='120' value={draft.durationMinutes} onChange={(e) => setDraft((prev) => ({ ...prev, durationMinutes: Number(e.target.value || 30) }))} style={inputStyle} />
          <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
            <input type='checkbox' checked={draft.readonlyMode} onChange={(e) => setDraft((prev) => ({ ...prev, readonlyMode: e.target.checked }))} style={{ marginRight: 8 }} />
            Lecture seule (recommande)
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={openAssistance} disabled={saving || loading || backendState !== 'ok'} style={btnPrimary}>Ouvrir session assistance</button>
          <button onClick={closeAssistance} disabled={saving || loading} style={btnPlain}>Quitter</button>
        </div>
      </section>

      <section style={cardStyle}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Architecture proposée</h4>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13, display: 'grid', gap: 6 }}>
          <li>Session limitée (TTL 30 min) avec entreprise cible explicite</li>
          <li>Motif obligatoire stocké dans audit_events</li>
          <li>Bandeau permanent visible sur toutes les pages</li>
          <li>Actions sensibles toujours confirmées et journalisées</li>
          <li>Bouton quitter qui invalide immédiatement la session assistance</li>
        </ul>
      </section>
    </div>
  )
}

const btnPlain = { border: '1px solid #D1D5DB', background: '#fff', color: '#374151', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }
const btnPrimary = { border: 'none', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }
