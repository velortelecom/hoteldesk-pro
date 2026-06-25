// src/pages/SuperAdmin.jsx
// Back-office Super Admin Velor One V4
// Creation entreprise avec secteurs metiers + departements + postes automatiques
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PLANS } from '../lib/modules'
import { MODULES_REGISTRY } from '../modules/registry'
import { SECTEURS_METIERS, SECTEURS_OPTIONS, getDepartementsBySecteur, getPostesBySecteur, getModulesRecommandes } from '../lib/secteurs'

const PLAN_COLORS = { starter: '#6B7280', business: '#3B82F6', premium: '#8B5CF6', enterprise: '#F59E0B' }
const PLAN_MODULES = {
  starter: ['organisation','conges'],
  business: ['organisation','conges','documents','rapports'],
  premium: ['organisation','conges','documents','rapports','vehicules','stocks','qualite','statistiques','planning_avance'],
  enterprise: null,
}

function StatCard({ titre, valeur, couleur }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '0.5px solid #E5E7EB', borderLeft: '3px solid ' + couleur }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{titre}</div>
    </div>
  )
}

function Section({ titre, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #F3F4F6' }}>{titre}</h3>
      {children}
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' }

export default function SuperAdmin() {
  const { profile } = useAuth()
  const [entreprises, setEntreprises] = useState([])
  const [modules, setModules] = useState([])
  const [stats, setStats] = useState({ total: 0, actives: 0, par_plan: {} })
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState('entreprises')
  const [showForm, setShowForm] = useState(false)
  const [editEntreprise, setEditEntreprise] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [expandedEnt, setExpandedEnt] = useState(null)
  const [entModules, setEntModules] = useState({})

  useEffect(() => {
    if (!profile?.is_super_admin) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const [{ data: ents }, { data: mods }] = await Promise.all([
      supabase.from('entreprises').select('*').order('created_at', { ascending: false }),
      supabase.from('modules_catalogue').select('*').order('ordre'),
    ])
    if (ents) {
      setEntreprises(ents)
      const par_plan = {}
      ents.forEach(e => { par_plan[e.plan] = (par_plan[e.plan] || 0) + 1 })
      setStats({ total: ents.length, actives: ents.filter(e => e.actif).length, par_plan })
    }
    if (mods) setModules(mods)
    setLoading(false)
  }

  async function fetchEntModules(entId) {
    const { data } = await supabase.from('entreprise_modules').select('module_id,actif').eq('entreprise_id', entId)
    setEntModules(prev => ({ ...prev, [entId]: data || [] }))
  }

  // Quand on change de secteur, charger automatiquement deps + postes + modules
  function changerSecteur(secteurKey) {
    const template = SECTEURS_METIERS[secteurKey]
    if (!template) return
    const depts = template.departements.map(d => d.code)
    const postesDefaut = template.postes.map(p => ({ ...p, selectionne: true }))
    const modsReco = getModulesRecommandes(secteurKey)
    setForm(f => ({
      ...f,
      secteur: secteurKey,
      departements_selectionnes: depts,
      postes_selectionnes: postesDefaut,
      modules_selectionnes: modsReco,
    }))
  }

  function ouvrirCreation() {
    const secteurDefaut = 'hotel'
    const template = SECTEURS_METIERS[secteurDefaut]
    setForm({
      nom: '', slug: '', secteur: secteurDefaut, plan: 'starter',
      prix_mensuel: 29, max_utilisateurs: 10, actif: true,
      modules_selectionnes: getModulesRecommandes(secteurDefaut),
      departements_selectionnes: template.departements.map(d => d.code),
      postes_selectionnes: template.postes.map(p => ({ ...p, selectionne: true })),
      email_contact: '', telephone: '', adresse: '',
      admin_prenom: '', admin_nom: '', admin_email: '', admin_telephone: '',
    })
    setEditEntreprise(null)
    setShowForm(true)
  }

  function ouvrirEdition(ent) {
    setEditEntreprise(ent)
    fetchEntModules(ent.id).then(() => {
      const mods = (entModules[ent.id] || []).filter(m => m.actif).map(m => m.module_id)
      setForm({
        nom: ent.nom || '', slug: ent.slug || '', secteur: ent.secteur || 'hotel',
        plan: ent.plan || 'starter', prix_mensuel: ent.prix_mensuel || 29,
        max_utilisateurs: ent.max_utilisateurs || 10, actif: ent.actif !== false,
        modules_selectionnes: mods, departements_selectionnes: [], postes_selectionnes: [],
        email_contact: ent.email_contact || '', telephone: ent.telephone || '',
        adresse: ent.adresse || '', admin_prenom: '', admin_nom: '', admin_email: '', admin_telephone: '',
      })
      setShowForm(true)
    })
  }

  function changerPlan(plan) {
    const planData = PLANS[plan]
    const modsDefaut = PLAN_MODULES[plan] || MODULES_REGISTRY.filter(m => m.actif).map(m => m.id)
    setForm(f => ({
      ...f, plan,
      prix_mensuel: planData?.prix || 0,
      max_utilisateurs: planData?.max_utilisateurs || 999,
      modules_selectionnes: modsDefaut,
    }))
  }

  function toggleModule(modId) {
    setForm(f => {
      const sel = f.modules_selectionnes || []
      return { ...f, modules_selectionnes: sel.includes(modId) ? sel.filter(m => m !== modId) : [...sel, modId] }
    })
  }

  function toggleDept(code) {
    setForm(f => {
      const sel = f.departements_selectionnes || []
      return { ...f, departements_selectionnes: sel.includes(code) ? sel.filter(d => d !== code) : [...sel, code] }
    })
  }

  function togglePoste(slug) {
    setForm(f => {
      const postes = f.postes_selectionnes || []
      return { ...f, postes_selectionnes: postes.map(p => p.slug === slug ? { ...p, selectionne: !p.selectionne } : p) }
    })
  }

  async function sauvegarder() {
    if (!form.nom.trim()) { setMsg({ type: 'error', text: 'Le nom est obligatoire' }); return }
    setSaving(true); setMsg(null)
    try {
      const entData = {
        nom: form.nom, slug: form.slug || form.nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        secteur: form.secteur, plan: form.plan, prix_mensuel: form.prix_mensuel,
        max_utilisateurs: form.max_utilisateurs, actif: form.actif,
        email_contact: form.email_contact, telephone: form.telephone, adresse: form.adresse,
      }
      let entId
      if (editEntreprise) {
        const { error } = await supabase.from('entreprises').update(entData).eq('id', editEntreprise.id)
        if (error) throw error
        entId = editEntreprise.id
      } else {
        const { data, error } = await supabase.from('entreprises').insert(entData).select().single()
        if (error) throw error
        entId = data.id
      }

      // Modules
      await supabase.from('entreprise_modules').update({ actif: false }).eq('entreprise_id', entId)
      if (form.modules_selectionnes?.length > 0) {
        await supabase.from('entreprise_modules').upsert(
          form.modules_selectionnes.map(modId => ({ entreprise_id: entId, module_id: modId, actif: true, activated_at: new Date().toISOString() })),
          { onConflict: 'entreprise_id,module_id' }
        )
      }

      // Departements (creation seulement)
      if (!editEntreprise && form.departements_selectionnes?.length > 0) {
        const template = SECTEURS_METIERS[form.secteur]
        const deptInserts = form.departements_selectionnes.map(code => {
          const deptTemplate = template?.departements.find(d => d.code === code)
          return {
            entreprise_id: entId,
            nom: deptTemplate?.nom || code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            code,
            couleur: deptTemplate?.couleur || '#6B7280',
            actif: true,
          }
        })
        const { data: deptsCreated } = await supabase.from('departements').insert(deptInserts).select()

        // Postes (creation seulement, apres avoir les departements)
        if (form.postes_selectionnes?.length > 0 && deptsCreated) {
          const deptMap = {}
          deptsCreated.forEach(d => { deptMap[d.code] = d.id })
          const postesACreer = form.postes_selectionnes.filter(p => p.selectionne)
          if (postesACreer.length > 0) {
            const posteInserts = postesACreer.map(p => ({
              entreprise_id: entId,
              nom: p.nom,
              slug: p.slug,
              departement_id: deptMap[p.dept] || null,
              niveau: p.niveau || 3,
              role_systeme: 'employe',
              actif: true,
            }))
            await supabase.from('postes').insert(posteInserts)
          }
        }
      }

      // Premier admin (creation seulement)
      if (!editEntreprise && form.admin_email) {
        const { data: adminResult } = await supabase.rpc('creer_premier_admin', {
          p_entreprise_id: entId, p_email: form.admin_email, p_password: 'Velor2024!',
          p_prenom: form.admin_prenom || 'Admin', p_nom: form.admin_nom || entData.nom,
          p_telephone: form.admin_telephone || null,
        })
        if (adminResult?.success === false) console.warn('Admin issue:', adminResult.error)
      }

      setMsg({ type: 'success', text: editEntreprise ? 'Entreprise modifiee !' : 'Entreprise creee avec ' + (form.departements_selectionnes?.length || 0) + ' depts et ' + (form.postes_selectionnes?.filter(p => p.selectionne).length || 0) + ' postes !' })
      setShowForm(false)
      fetchData()
    } catch (e) {
      setMsg({ type: 'error', text: 'Erreur : ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActifEntreprise(ent) {
    await supabase.from('entreprises').update({ actif: !ent.actif }).eq('id', ent.id)
    fetchData()
  }

  async function toggleModuleEntreprise(entId, modId, actuel) {
    await supabase.from('entreprise_modules').upsert(
      { entreprise_id: entId, module_id: modId, actif: !actuel, activated_at: new Date().toISOString() },
      { onConflict: 'entreprise_id,module_id' }
    )
    fetchEntModules(entId)
  }

  if (!profile?.is_super_admin) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}><h2>Acces refuse</h2></div>
  )
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>

  // FORMULAIRE CREATION/EDITION
  if (showForm && form) {
    const allMods = MODULES_REGISTRY.filter(m => m.actif)
    const templateSecteur = SECTEURS_METIERS[form.secteur]
    const deptsTemplate = templateSecteur?.departements || []
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setShowForm(false)} style={{ border: '1px solid #E5E7EB', background: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Retour</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1F2937' }}>
            {editEntreprise ? 'Modifier : ' + editEntreprise.nom : 'Nouvelle entreprise'}
          </h1>
        </div>
        {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46', fontSize: 13 }}>{msg.text}</div>}
        <div style={{ display: 'grid', gap: 20 }}>

          <Section titre="Informations entreprise">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nom *"><input style={inputStyle} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Hotel Bellevue" /></Field>
              <Field label="Slug"><input style={inputStyle} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="hotel-bellevue" /></Field>
              <Field label="Secteur d activite *">
                <select style={inputStyle} value={form.secteur} onChange={e => changerSecteur(e.target.value)}>
                  {SECTEURS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Statut">
                <select style={inputStyle} value={form.actif ? 'actif' : 'inactif'} onChange={e => setForm(f => ({ ...f, actif: e.target.value === 'actif' }))}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </Field>
              <Field label="Email contact"><input style={inputStyle} value={form.email_contact} onChange={e => setForm(f => ({ ...f, email_contact: e.target.value }))} placeholder="contact@entreprise.fr" /></Field>
              <Field label="Telephone"><input style={inputStyle} value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+33 1 23 45 67" /></Field>
            </div>
            {templateSecteur && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                {templateSecteur.icone} {templateSecteur.description} — {deptsTemplate.length} depts et {templateSecteur.postes.length} postes charges automatiquement
              </div>
            )}
          </Section>

          <Section titre="Abonnement">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {Object.values(PLANS).map(p => (
                <div key={p.id} onClick={() => changerPlan(p.id)} style={{
                  border: '2px solid ' + (form.plan === p.id ? p.couleur : '#E5E7EB'),
                  borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                  background: form.plan === p.id ? p.couleur + '11' : '#fff',
                }}>
                  <div style={{ fontWeight: 700, color: form.plan === p.id ? p.couleur : '#374151', fontSize: 14 }}>{p.nom}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.prix ? p.prix + 'EUR/mois' : 'Sur mesure'}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Prix mensuel (EUR)"><input style={inputStyle} type="number" value={form.prix_mensuel} onChange={e => setForm(f => ({ ...f, prix_mensuel: +e.target.value }))} /></Field>
              <Field label="Max utilisateurs"><input style={inputStyle} type="number" value={form.max_utilisateurs} onChange={e => setForm(f => ({ ...f, max_utilisateurs: +e.target.value }))} /></Field>
            </div>
          </Section>

          <Section titre="Modules actives">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allMods.map(m => {
                const sel = (form.modules_selectionnes || []).includes(m.id)
                return (
                  <button key={m.id} onClick={() => toggleModule(m.id)} style={{
                    padding: '6px 12px', borderRadius: 20, border: '1.5px solid ' + (sel ? (m.couleur || '#3B82F6') : '#E5E7EB'),
                    background: sel ? (m.couleur || '#3B82F6') + '18' : '#fff', color: sel ? (m.couleur || '#3B82F6') : '#6B7280',
                    cursor: 'pointer', fontSize: 12, fontWeight: sel ? 700 : 400,
                  }}>
                    {m.icone} {m.nom}
                  </button>
                )
              })}
            </div>
          </Section>

          {!editEntreprise && (
            <Section titre={"Departements - " + (form.secteur ? (SECTEURS_METIERS[form.secteur]?.label || form.secteur) : '') + " (" + (form.departements_selectionnes?.length || 0) + " selectionnes)"}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {deptsTemplate.map(d => {
                  const sel = (form.departements_selectionnes || []).includes(d.code)
                  return (
                    <button key={d.code} onClick={() => toggleDept(d.code)} style={{
                      padding: '5px 12px', borderRadius: 16,
                      border: '1.5px solid ' + (sel ? (d.couleur || '#3B82F6') : '#E5E7EB'),
                      background: sel ? (d.couleur || '#3B82F6') + '18' : '#fff',
                      color: sel ? (d.couleur || '#3B82F6') : '#6B7280',
                      cursor: 'pointer', fontSize: 12, fontWeight: sel ? 700 : 400,
                    }}>
                      {d.nom}
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          {!editEntreprise && form.postes_selectionnes?.length > 0 && (
            <Section titre={"Postes - " + (form.postes_selectionnes.filter(p => p.selectionne).length) + "/" + form.postes_selectionnes.length + " selectionnes"}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Cliquer pour activer/desactiver. Les postes seront lies aux departements automatiquement.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {form.postes_selectionnes.map(p => {
                  const deptTemplate = deptsTemplate.find(d => d.code === p.dept)
                  return (
                    <button key={p.slug} onClick={() => togglePoste(p.slug)} style={{
                      padding: '5px 10px', borderRadius: 14,
                      border: '1.5px solid ' + (p.selectionne ? (deptTemplate?.couleur || '#6B7280') : '#E5E7EB'),
                      background: p.selectionne ? (deptTemplate?.couleur || '#6B7280') + '15' : '#fff',
                      color: p.selectionne ? (deptTemplate?.couleur || '#374151') : '#9CA3AF',
                      cursor: 'pointer', fontSize: 11,
                      textDecoration: p.selectionne ? 'none' : 'line-through',
                    }}>
                      {p.nom}
                      <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>{p.dept}</span>
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          {!editEntreprise && (
            <Section titre="Premier administrateur (optionnel)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Prenom"><input style={inputStyle} value={form.admin_prenom} onChange={e => setForm(f => ({ ...f, admin_prenom: e.target.value }))} placeholder="Jean" /></Field>
                <Field label="Nom"><input style={inputStyle} value={form.admin_nom} onChange={e => setForm(f => ({ ...f, admin_nom: e.target.value }))} placeholder="Dupont" /></Field>
                <Field label="Email admin"><input style={inputStyle} value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="jean@entreprise.fr" /></Field>
                <Field label="Telephone"><input style={inputStyle} value={form.admin_telephone} onChange={e => setForm(f => ({ ...f, admin_telephone: e.target.value }))} placeholder="+33 6 12 34 56 78" /></Field>
              </div>
              {form.admin_email && <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>Mot de passe temporaire : Velor2024!</div>}
            </Section>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={sauvegarder} disabled={saving} style={{ padding: '10px 24px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Sauvegarde...' : editEntreprise ? 'Modifier' : 'Creer'}
          </button>
        </div>
      </div>
    )
  }

  // VUE PRINCIPALE
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#1F2937', color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>VELOR SUPER ADMIN</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1F2937', flex: 1 }}>Back-office Velor One</h1>
      </div>
      {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46', fontSize: 13 }}>{msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard titre="Entreprises totales" valeur={stats.total} couleur="#3B82F6" />
        <StatCard titre="Entreprises actives" valeur={stats.actives} couleur="#10B981" />
        <StatCard titre="Plans Business+" valeur={(stats.par_plan.business||0)+(stats.par_plan.premium||0)+(stats.par_plan.enterprise||0)} couleur="#8B5CF6" />
        <StatCard titre="Modules catalogue" valeur={modules.length} couleur="#F59E0B" />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E5E7EB' }}>
        {['entreprises','modules','plans'].map(o => (
          <button key={o} onClick={() => setOnglet(o)} style={{
            padding: '8px 18px', border: 'none', borderRadius: '6px 6px 0 0',
            background: onglet === o ? '#3B82F6' : 'transparent',
            color: onglet === o ? 'white' : '#6B7280', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
          }}>{o}</button>
        ))}
      </div>

      {onglet === 'entreprises' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Toutes les entreprises ({entreprises.length})</h2>
            <button onClick={ouvrirCreation} style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              + Nouvelle entreprise
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entreprises.map(e => {
              const secteurInfo = SECTEURS_METIERS[e.secteur]
              return (
                <div key={e.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{secteurInfo?.icone || '🏢'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{e.nom}</span>
                        <span style={{ background: PLAN_COLORS[e.plan] + '22', color: PLAN_COLORS[e.plan], borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{e.plan}</span>
                        <span style={{ color: e.actif ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: 600 }}>{e.actif ? 'Actif' : 'Inactif'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                        {secteurInfo?.label || e.secteur} — {e.max_utilisateurs || '?'} users max
                        {e.email_contact && ' — ' + e.email_contact}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { const wasExpanded = expandedEnt === e.id; setExpandedEnt(wasExpanded ? null : e.id); if (!wasExpanded) fetchEntModules(e.id) }} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', background: '#F9FAFB', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {expandedEnt === e.id ? 'Fermer' : 'Modules'}
                      </button>
                      <button onClick={() => ouvrirEdition(e)} style={{ padding: '6px 12px', border: '1px solid #3B82F6', color: '#3B82F6', background: '#EFF6FF', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Modifier</button>
                      <button onClick={() => toggleActifEntreprise(e)} style={{ padding: '6px 12px', border: '1px solid ' + (e.actif ? '#EF4444' : '#10B981'), color: e.actif ? '#EF4444' : '#10B981', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {e.actif ? 'Desactiver' : 'Reactiver'}
                      </button>
                    </div>
                  </div>
                  {expandedEnt === e.id && (
                    <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 16px', background: '#F9FAFB' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Modules (cliquer pour activer/desactiver)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {modules.map(m => {
                          const entMod = (entModules[e.id] || []).find(em => em.module_id === m.id)
                          const actif = entMod?.actif === true
                          return (
                            <button key={m.id} onClick={() => toggleModuleEntreprise(e.id, m.id, actif)} style={{
                              padding: '4px 10px', borderRadius: 16,
                              border: '1px solid ' + (actif ? '#10B981' : '#E5E7EB'),
                              background: actif ? '#ECFDF5' : '#fff', color: actif ? '#065F46' : '#9CA3AF',
                              cursor: 'pointer', fontSize: 11,
                            }}>
                              {m.icone} {m.nom}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {entreprises.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Aucune entreprise. Creez la premiere.</div>}
          </div>
        </div>
      )}

      {onglet === 'modules' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Catalogue modules ({modules.length})</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                {['Icone','Nom','Categorie','Plan min','Actif'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {modules.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '8px 14px', fontSize: 20 }}>{m.icone}</td>
                    <td style={{ padding: '8px 14px', fontWeight: 600 }}>{m.nom}</td>
                    <td style={{ padding: '8px 14px', color: '#6B7280' }}>{m.categorie}</td>
                    <td style={{ padding: '8px 14px' }}><span style={{ background: (PLAN_COLORS[m.plan_minimum]||'#6B7280') + '22', color: PLAN_COLORS[m.plan_minimum]||'#6B7280', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{m.plan_minimum}</span></td>
                    <td style={{ padding: '8px 14px' }}><span style={{ color: m.actif ? '#10B981' : '#EF4444', fontWeight: 700 }}>{m.actif ? 'Oui' : 'Non'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onglet === 'plans' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Plans tarifaires</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {Object.values(PLANS).map(p => (
              <div key={p.id} style={{ background: '#fff', border: '2px solid ' + p.couleur + '44', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: p.couleur }}>{p.nom}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{p.prix ? p.prix + ' EUR/mois' : 'Sur mesure'}</div>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>{p.description}</div>
                <div style={{ fontSize: 13 }}>Max utilisateurs : <strong>{p.max_utilisateurs ?? 'Illimite'}</strong></div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Sur ce plan : <strong>{stats.par_plan[p.id] || 0}</strong> entreprise(s)</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
