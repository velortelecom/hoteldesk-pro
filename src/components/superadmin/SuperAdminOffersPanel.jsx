import { useEffect, useMemo, useState } from 'react'
import { PLANS } from '../../lib/modules'
import { mapSuperAdminError } from '../../pages/superAdminControlUtils'
import { fetchOffersLimitsData, filterOfferRows } from '../../services/superadmin/offersService'

const cardStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }
const inputStyle = { border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 10px', fontSize: 12 }
const badgeStyle = { borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }

function Metric({ label, value, color }) {
  return (
    <div style={{ ...cardStyle, borderLeft: '4px solid ' + color }}>
      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

export default function SuperAdminOffersPanel({ supabase, searchQuery }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [dataset, setDataset] = useState({ rows: [], summary: null, subscriptions: [], subscriptionState: 'ok' })
  const [filters, setFilters] = useState({ plan: '', status: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const next = await fetchOffersLimitsData(supabase)
      setDataset(next)
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Chargement offres et limites impossible.') })
    } finally {
      setLoading(false)
    }
  }

  const visibleRows = useMemo(() => filterOfferRows(dataset.rows, searchQuery, filters), [dataset.rows, searchQuery, filters])

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
            <h3 style={{ margin: 0 }}>Offres & limites</h3>
            <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>Pilotage des plans, limites utilisateurs et coherence tarifaire.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={filters.plan} onChange={(event) => setFilters((prev) => ({ ...prev, plan: event.target.value }))} style={inputStyle}>
              <option value=''>Tous les plans</option>
              {Object.values(PLANS).map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.nom}</option>
              ))}
            </select>
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} style={inputStyle}>
              <option value=''>Tous statuts</option>
              <option value='actif'>Actifs</option>
              <option value='inactif'>Inactifs</option>
            </select>
            <button onClick={load} style={{ border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Rafraichir</button>
          </div>
        </div>
      </section>

      {dataset.subscriptionState !== 'ok' && (
        <section style={{ ...cardStyle, background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}>
          <strong>Etat abonnements: {dataset.subscriptionState === 'non_configure' ? 'Non configure' : 'Indisponible'}</strong>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Le panneau fonctionne en mode degrade sur la table entreprises. Le schema offres/abonnements sera branche des qu il est disponible.
          </div>
        </section>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Metric label='Entreprises total' value={dataset.summary?.total || 0} color='#1D4ED8' />
        <Metric label='Actives / suspendues' value={(dataset.summary?.active || 0) + ' / ' + (dataset.summary?.suspended || 0)} color='#0F766E' />
        <Metric label='Limites personnalisees' value={dataset.summary?.customLimits || 0} color='#B45309' />
        <Metric label='Abonnements relies' value={dataset.subscriptions.length} color='#7C3AED' />
      </section>

      <section style={cardStyle}>
        {loading ? (
          <div style={{ color: '#64748B' }}>Chargement offres...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ textAlign: 'left', padding: '9px 12px' }}>Entreprise</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px' }}>Plan</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px' }}>Prix mensuel</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px' }}>Max utilisateurs</th>
                  <th style={{ textAlign: 'left', padding: '9px 12px' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const planColor = PLANS[row.plan]?.couleur || '#64748B'
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{row.nom}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{row.slug}</div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ ...badgeStyle, background: planColor + '22', color: planColor }}>{row.plan || 'n/a'}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{row.prix_mensuel ?? 0} EUR</td>
                      <td style={{ padding: '8px 12px' }}>{row.offerLimits?.usersLabel || (row.max_utilisateurs ?? 0)}</td>
                      <td style={{ padding: '8px 12px', color: row.actif === false ? '#B91C1C' : '#047857', fontWeight: 700 }}>
                        {row.actif === false ? 'Suspendue' : 'Active'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleRows.length === 0 && <div style={{ color: '#94A3B8', paddingTop: 12 }}>Aucune offre selon les filtres.</div>}
          </div>
        )}
      </section>
    </div>
  )
}
