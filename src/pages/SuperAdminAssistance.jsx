import { useMemo, useState } from 'react'
import { buildAssistanceSessionDraft } from './superAdminControlUtils'

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }
const inputStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

export default function SuperAdminAssistance({ entreprises = [] }) {
  const [draft, setDraft] = useState({ entrepriseId: '', reason: '' })
  const [session, setSession] = useState(null)
  const [msg, setMsg] = useState(null)

  const entrepriseNom = useMemo(() => (entreprises.find((ent) => ent.id === session?.entrepriseId)?.nom || 'Entreprise inconnue'), [entreprises, session])

  function openAssistance() {
    try {
      const next = buildAssistanceSessionDraft({
        entrepriseId: draft.entrepriseId,
        reason: draft.reason,
        durationMinutes: 30,
      })
      setSession(next)
      setMsg({ type: 'success', text: 'Session assistance préparée (mode simulation). Activation production bloquée.' })
    } catch (error) {
      setMsg({ type: 'error', text: 'Entreprise cible et motif obligatoire.' })
    }
  }

  function closeAssistance() {
    setSession(null)
    setMsg({ type: 'success', text: 'Session assistance clôturée.' })
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {session && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', borderRadius: 10, padding: 12, fontWeight: 700 }}>
          Mode assistance actif (simulation) · {entrepriseNom} · motif: {session.reason} · fin prévue: {new Date(session.expiresAt).toLocaleString('fr-FR')}
        </div>
      )}

      {msg && (
        <div style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </div>
      )}

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Mode assistance (préparation uniquement)</h3>
        <p style={{ color: '#6B7280', fontSize: 13 }}>
          Cette fonctionnalité prépare l architecture d assistance sans impersonation active. Aucune élévation de session n est exécutée en production.
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
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={openAssistance} style={btnPrimary}>Ouvrir en mode assistance</button>
          <button onClick={closeAssistance} style={btnPlain}>Quitter</button>
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
