import { useEffect, useMemo, useState } from 'react'
import { mapSuperAdminError } from '../../pages/superAdminControlUtils'
import { fetchModulesCatalogue, filterModulesCatalogue } from '../../services/superadmin/modulesService'

const PLAN_COLORS = {
  starter: '#6B7280',
  business: '#2563EB',
  premium: '#7C3AED',
  enterprise: '#D97706',
}

const cardStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }
const inputStyle = { border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 10px', fontSize: 12 }
const buttonStyle = { border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }

export default function SuperAdminModulesPanel({ supabase, searchQuery }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ status: '', category: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const next = await fetchModulesCatalogue(supabase)
      setRows(next)
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Chargement catalogue modules impossible.') })
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.categorie).filter(Boolean))).sort(), [rows])
  const visibleRows = useMemo(() => filterModulesCatalogue(rows, searchQuery, filters), [rows, searchQuery, filters])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {msg && (
        <section style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </section>
      )}

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Catalogue modules</h3>
            <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>Vue catalogue v2: filtre global, statut, categorie et niveau de plan.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} style={inputStyle}>
              <option value=''>Tous statuts</option>
              <option value='actif'>Actifs</option>
              <option value='inactif'>Inactifs</option>
            </select>
            <select value={filters.category} onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))} style={inputStyle}>
              <option value=''>Toutes categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button onClick={load} style={buttonStyle}>Rafraichir</button>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        {loading ? (
          <div style={{ color: '#64748B' }}>Chargement catalogue...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Icone</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Module</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Categorie</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Plan minimum</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const planColor = PLAN_COLORS[row.plan_minimum] || '#6B7280'
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 12px', fontSize: 18 }}>{row.icone || '🧩'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{row.nom || row.id}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{row.id}</div>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{row.categorie || 'n/a'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: planColor + '22', color: planColor, borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                          {row.plan_minimum || 'n/a'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: row.actif ? '#047857' : '#B91C1C', fontWeight: 700 }}>
                          {row.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleRows.length === 0 && <div style={{ paddingTop: 12, color: '#94A3B8' }}>Aucun module selon les filtres.</div>}
          </div>
        )}
      </section>
    </div>
  )
}
