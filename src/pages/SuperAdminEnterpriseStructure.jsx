import { useEffect, useState } from 'react'
import { buildDependencyErrorMessage } from './superAdminControlUtils'

const sectionStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }
const inputStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '6px 10px', fontSize: 12 }

export default function SuperAdminEnterpriseStructure({ supabase, entrepriseId }) {
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [sites, setSites] = useState([])
  const [departements, setDepartements] = useState([])
  const [postes, setPostes] = useState([])
  const [forms, setForms] = useState({
    site: { nom: '' },
    dep: { nom: '', code: '' },
    poste: { nom: '', slug: '', departement_id: '' },
  })

  useEffect(() => {
    fetchAll()
  }, [entrepriseId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [siteRes, depRes, posteRes] = await Promise.all([
        supabase.from('sites').select('id, nom, actif').eq('entreprise_id', entrepriseId).order('nom'),
        supabase.from('departements').select('id, nom, code, actif').eq('entreprise_id', entrepriseId).order('nom'),
        supabase.from('postes').select('id, nom, slug, departement_id, actif').eq('entreprise_id', entrepriseId).order('nom'),
      ])
      if (siteRes.error) throw siteRes.error
      if (depRes.error) throw depRes.error
      if (posteRes.error) throw posteRes.error
      setSites(siteRes.data || [])
      setDepartements(depRes.data || [])
      setPostes(posteRes.data || [])
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Chargement structure impossible.' })
    } finally {
      setLoading(false)
    }
  }

  async function createSite() {
    if (!forms.site.nom.trim()) return
    try {
      const { error } = await supabase.from('sites').insert({
        entreprise_id: entrepriseId,
        nom: forms.site.nom.trim(),
        slug: forms.site.nom.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        actif: true,
      })
      if (error) throw error
      setForms((prev) => ({ ...prev, site: { nom: '' } }))
      setMsg({ type: 'success', text: 'Site créé.' })
      await fetchAll()
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Création site impossible.' })
    }
  }

  async function createDepartement() {
    if (!forms.dep.nom.trim() || !forms.dep.code.trim()) return
    try {
      const { error } = await supabase.from('departements').insert({
        entreprise_id: entrepriseId,
        nom: forms.dep.nom.trim(),
        code: forms.dep.code.trim().toLowerCase(),
        actif: true,
      })
      if (error) throw error
      setForms((prev) => ({ ...prev, dep: { nom: '', code: '' } }))
      setMsg({ type: 'success', text: 'Département créé.' })
      await fetchAll()
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Création département impossible.' })
    }
  }

  async function createPoste() {
    if (!forms.poste.nom.trim()) return
    try {
      const { error } = await supabase.from('postes').insert({
        entreprise_id: entrepriseId,
        nom: forms.poste.nom.trim(),
        slug: (forms.poste.slug || forms.poste.nom).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        departement_id: forms.poste.departement_id || null,
        actif: true,
      })
      if (error) throw error
      setForms((prev) => ({ ...prev, poste: { nom: '', slug: '', departement_id: '' } }))
      setMsg({ type: 'success', text: 'Poste créé.' })
      await fetchAll()
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Création poste impossible.' })
    }
  }

  async function toggleActif(table, id, actif) {
    try {
      const { error } = await supabase.from(table).update({ actif: !actif }).eq('id', id)
      if (error) throw error
      setMsg({ type: 'success', text: 'Statut mis à jour.' })
      await fetchAll()
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Mise à jour impossible.' })
    }
  }

  async function removeRow(table, id) {
    if (!window.confirm('Confirmer la suppression ?')) return
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      setMsg({ type: 'success', text: 'Suppression effectuée.' })
      await fetchAll()
    } catch (error) {
      setMsg({ type: 'error', text: buildDependencyErrorMessage(error) })
    }
  }

  if (loading) return <div style={{ fontSize: 12, color: '#6B7280' }}>Chargement structure...</div>

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {msg && (
        <div style={{ ...sectionStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </div>
      )}

      <div style={sectionStyle}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Sites</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input value={forms.site.nom} onChange={(e) => setForms((prev) => ({ ...prev, site: { nom: e.target.value } }))} placeholder='Nouveau site' style={inputStyle} />
          <button onClick={createSite} style={btnPrimary}>Créer</button>
        </div>
        <Rows rows={sites} onToggle={(row) => toggleActif('sites', row.id, row.actif)} onDelete={(row) => removeRow('sites', row.id)} />
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Départements</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input value={forms.dep.nom} onChange={(e) => setForms((prev) => ({ ...prev, dep: { ...prev.dep, nom: e.target.value } }))} placeholder='Nom' style={inputStyle} />
          <input value={forms.dep.code} onChange={(e) => setForms((prev) => ({ ...prev, dep: { ...prev.dep, code: e.target.value } }))} placeholder='Code' style={inputStyle} />
          <button onClick={createDepartement} style={btnPrimary}>Créer</button>
        </div>
        <Rows rows={departements} onToggle={(row) => toggleActif('departements', row.id, row.actif)} onDelete={(row) => removeRow('departements', row.id)} />
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Postes</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <input value={forms.poste.nom} onChange={(e) => setForms((prev) => ({ ...prev, poste: { ...prev.poste, nom: e.target.value } }))} placeholder='Nom' style={inputStyle} />
          <input value={forms.poste.slug} onChange={(e) => setForms((prev) => ({ ...prev, poste: { ...prev.poste, slug: e.target.value } }))} placeholder='Slug' style={inputStyle} />
          <select value={forms.poste.departement_id} onChange={(e) => setForms((prev) => ({ ...prev, poste: { ...prev.poste, departement_id: e.target.value } }))} style={inputStyle}>
            <option value=''>Sans département</option>
            {departements.map((dep) => <option key={dep.id} value={dep.id}>{dep.nom}</option>)}
          </select>
          <button onClick={createPoste} style={btnPrimary}>Créer</button>
        </div>
        <Rows rows={postes.map((row) => ({ ...row, nom: row.nom + (row.departement_id ? ' · ' + (departements.find((d) => d.id === row.departement_id)?.nom || 'Dept') : '') }))} onToggle={(row) => toggleActif('postes', row.id, row.actif)} onDelete={(row) => removeRow('postes', row.id)} />
      </div>
    </div>
  )
}

function Rows({ rows, onToggle, onDelete }) {
  if (!rows || rows.length === 0) return <div style={{ color: '#9CA3AF', fontSize: 12 }}>Aucun élément.</div>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map((row) => (
        <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 12 }}>{row.nom}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onToggle(row)} style={btnPlain}>{row.actif === false ? 'Activer' : 'Désactiver'}</button>
            <button onClick={() => onDelete(row)} style={btnDanger}>Supprimer</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const btnPlain = { border: '1px solid #D1D5DB', background: '#fff', color: '#374151', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 11 }
const btnPrimary = { border: 'none', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11 }
const btnDanger = { border: 'none', background: '#DC2626', color: '#fff', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 11 }
