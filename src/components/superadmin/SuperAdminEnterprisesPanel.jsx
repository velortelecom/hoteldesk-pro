import { useEffect, useMemo, useState } from 'react'
import { buildDependencyErrorMessage, mapSuperAdminError } from '../../pages/superAdminControlUtils'
import {
  deleteEnterprise,
  fetchEnterpriseList,
  filterEnterpriseRows,
  toggleEnterpriseStatus,
} from '../../services/superadmin/enterpriseService'

const cardStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }
const buttonStyle = { border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }

export default function SuperAdminEnterprisesPanel({
  supabase,
  searchQuery,
  onOpenLegacyCreate,
  onOpenLegacyManager,
  onDataChanged,
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [dataset, setDataset] = useState({ entreprises: [], detailsMap: {}, lastActivityByEntreprise: {} })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const next = await fetchEnterpriseList(supabase)
      setDataset(next)
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Chargement entreprises impossible.') })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(ent) {
    const nextStateLabel = ent.actif === false ? 'reactivation' : 'suspension'
    if (!window.confirm('Confirmer la ' + nextStateLabel + ' de cette entreprise ?')) return

    setSaving(true)
    setMsg(null)
    try {
      await toggleEnterpriseStatus(supabase, ent.id, ent.actif)
      setMsg({ type: 'success', text: 'Statut entreprise mis a jour.' })
      await load()
      if (onDataChanged) await onDataChanged()
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, 'Mise a jour impossible.') })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ent) {
    if (!window.confirm('Confirmer la suppression definitive de ' + ent.nom + ' ?')) return

    setSaving(true)
    setMsg(null)
    try {
      await deleteEnterprise(supabase, ent.id)
      setMsg({ type: 'success', text: 'Entreprise supprimee.' })
      await load()
      if (onDataChanged) await onDataChanged()
    } catch (error) {
      setMsg({ type: 'error', text: mapSuperAdminError(error, buildDependencyErrorMessage(error)) })
    } finally {
      setSaving(false)
    }
  }

  const entreprises = useMemo(
    () => filterEnterpriseRows(dataset.entreprises, searchQuery),
    [dataset.entreprises, searchQuery]
  )

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {msg && (
        <section style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </section>
      )}

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Gestion Entreprises</h3>
            <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>Panel dedie Super Admin avec operations critiques securisees.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onOpenLegacyCreate} style={{ ...buttonStyle, border: 'none', background: '#2563EB', color: '#fff' }}>
              + Nouvelle entreprise (legacy)
            </button>
            <button onClick={onOpenLegacyManager} style={buttonStyle}>
              Ouvrir manager legacy complet
            </button>
            <button onClick={load} style={buttonStyle}>Rafraichir</button>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        {loading ? (
          <div style={{ color: '#64748B' }}>Chargement des entreprises...</div>
        ) : (
          <div style={{ display: 'grid', gap: 9 }}>
            {entreprises.map((ent) => {
              const details = dataset.detailsMap[ent.id] || {}
              const statusColor = ent.actif === false ? '#B91C1C' : '#0F766E'
              const statusLabel = ent.actif === false ? 'Suspendue' : 'Active'
              const activity = dataset.lastActivityByEntreprise[ent.id]

              return (
                <div key={ent.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{ent.nom}</strong>
                        <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{ent.plan || 'plan'}</span>
                        <span style={{ background: '#F1F5F9', color: statusColor, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                        {ent.slug || 'slug absent'} / secteur {ent.secteur || 'n/a'} / max users {ent.max_utilisateurs || 'n/a'}
                      </div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                        Sites {details.nb_sites || 0} / Admins {details.nb_admins || 0} / Personnel {details.nb_personnel || 0}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        Activite recente: {activity ? new Date(activity).toLocaleString('fr-FR') : 'non disponible'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <button onClick={() => handleToggle(ent)} disabled={saving} style={buttonStyle}>
                        {ent.actif === false ? 'Reactiver' : 'Suspendre'}
                      </button>
                      <button onClick={() => handleDelete(ent)} disabled={saving} style={{ ...buttonStyle, borderColor: '#FCA5A5', color: '#B91C1C' }}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {entreprises.length === 0 && <div style={{ color: '#94A3B8' }}>Aucune entreprise trouvee.</div>}
          </div>
        )}
      </section>
    </div>
  )
}
