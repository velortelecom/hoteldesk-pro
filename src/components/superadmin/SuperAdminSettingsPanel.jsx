import { useEffect, useMemo, useState } from 'react'
import { mapSuperAdminError } from '../../pages/superAdminControlUtils'
import { fetchGlobalSettingsData, filterSettings } from '../../services/superadmin/settingsService'

const cardStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }

function renderValue(value) {
  try {
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export default function SuperAdminSettingsPanel({ supabase, searchQuery }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [dataset, setDataset] = useState({ backendState: 'ok', sourceTable: null, rows: [] })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const next = await fetchGlobalSettingsData(supabase)
      setDataset(next)
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Chargement parametres globaux impossible.') })
    } finally {
      setLoading(false)
    }
  }

  const visible = useMemo(() => filterSettings(dataset.rows, searchQuery), [dataset.rows, searchQuery])
  const visual = visible.filter((row) => row.category === 'visual')
  const sensitive = visible.filter((row) => row.category === 'sensitive')

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
            <h3 style={{ margin: 0 }}>Parametres globaux</h3>
            <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>Separation visuel/sensible. Modifications sensibles reservees a des fonctions server-side dediees.</div>
          </div>
          <button onClick={load} style={{ border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Rafraichir
          </button>
        </div>
      </section>

      {dataset.backendState !== 'ok' && (
        <section style={{ ...cardStyle, background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}>
          <strong>Etat parametres: {dataset.backendState === 'non_configure' ? 'Non configure' : 'Indisponible'}</strong>
          <div style={{ marginTop: 6, fontSize: 12 }}>Aucune table de configuration globale detectee (global_settings ou super_admin_settings).</div>
        </section>
      )}

      {dataset.backendState === 'ok' && (
        <section style={cardStyle}>
          <div style={{ fontSize: 12, color: '#64748B' }}>Source: {dataset.sourceTable}</div>
        </section>
      )}

      <section style={cardStyle}>
        <h4 style={{ marginTop: 0 }}>Parametres visuels ({visual.length})</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {visual.map((row) => (
            <div key={row.key} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, background: '#F8FAFC' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{row.key}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{renderValue(row.value)}</div>
            </div>
          ))}
          {visual.length === 0 && <div style={{ color: '#94A3B8' }}>Aucun parametre visuel trouve.</div>}
        </div>
      </section>

      <section style={cardStyle}>
        <h4 style={{ marginTop: 0 }}>Parametres sensibles ({sensitive.length})</h4>
        <div style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#991B1B', fontSize: 12, marginBottom: 8 }}>
          Les valeurs sensibles sont affichees en lecture seule. Les mises a jour doivent passer par des fonctions backend securisees et auditees.
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {sensitive.map((row) => (
            <div key={row.key} style={{ border: '1px solid #FECACA', borderRadius: 8, padding: 10, background: '#FFF1F2' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{row.key}</div>
              <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 4 }}>{renderValue(row.value)}</div>
            </div>
          ))}
          {sensitive.length === 0 && <div style={{ color: '#94A3B8' }}>Aucun parametre sensible trouve.</div>}
        </div>
      </section>
    </div>
  )
}
