// src/pages/SuperAdmin.jsx
// Back-office Super Admin Velor One V4
// Creation entreprise avec secteurs metiers + departements + postes automatiques
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PLANS } from '../lib/modules'
import { MODULES_REGISTRY } from '../modules/registry'
import { SECTEURS_METIERS, SECTEURS_OPTIONS, getDepartementsBySecteur, getPostesBySecteur, getModulesRecommandes } from '../lib/secteurs'
import { BrandMark, APP_URL } from '../branding/Brand'
import { buildCreationSlug, buildEditionForm } from './superAdminUtils'

const PLAN_COLORS = { starter: '#6B7280', business: '#3B82F6', premium: '#8B5CF6', enterprise: '#F59E0B' }
const PLAN_MODULES = {
  starter: ['organisation','conges'],
  business: ['organisation','conges','documents','rapports'],
  premium: ['organisation','conges','documents','rapports','vehicules','stochhks','qualite','statistiques','planning_avance'],
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
  const [stats, setStats] = useState({ total: 0, actives: 0, totalUsers: 0, totalSites: 0, par_plan: {} })
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState('entreprises')
  const [showForm, setShowForm] = useState(false)
  const [editEntreprise, setEditEntreprise] = useState(null)
  const [form, setForm] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [expandedEnt, setExpandedEnt] = useState(null)
  const [entModules, setEntModules] = useState({})
  const [entDetails, setEntDetails] = useState({})
  const [adminSuccessInfo, setAdminSuccessInfo] = useState(null)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminModalEnt, setAdminModalEnt] = useState(null)
  const [adminForm, setAdminForm] = useState({ prenom: '', nom: '', email: '', telephone: '', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true })
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminMsg, setAdminMsg] = useState(null)
  const [showEmployeModal, setShowEmployeModal] = useState(false)
  const [employeModalEnt, setEmployeModalEnt] = useState(null)
  const [employeForm, setEmployeForm] = useState({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true })
  const [employeSaving, setEmployeSaving] = useState(false)
  const [employeMsg, setEmployeMsg] = useState(null)
  const [employeSuccessInfo, setEmployeSuccessInfo] = useState(null)
  const [entPostes, setEntPostes] = useState({})
  const [entDeps, setEntDeps] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [entUsers, setEntUsers] = useState({})
  const [expandedUsersEnt, setExpandedUsersEnt] = useState(null)
  const [userDeleteConfirm, setUserDeleteConfirm] = useState(null)

  useEffect(() => {
    if (!profile?.is_super_admin) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const [{ data: ents }, { data: mods }, { data: details }, { count: totalUsers }, { count: totalSites }] = await Promise.all([
      supabase.from('entreprises').select('*').order('created_at', { ascending: false }),
      supabase.from('modules_catalogue').select('*').order('ordre'),
      supabase.from('super_admin_entreprises').select('*'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('sites').select('id', { count: 'exact', head: true }),
    ])
    if (ents) {
      setEntreprises(ents)
      const par_plan = {}
      ents.forEach(e => { par_plan[e.plan] = (par_plan[e.plan] || 0) + 1 })
      setStats({ total: ents.length, actives: ents.filter(e => e.actif).length, totalUsers: totalUsers || 0, totalSites: totalSites || 0, par_plan })
      // Auto-chargement utilisateurs de chaque entreprise
      ents.forEach(ent => {
        supabase.from('profiles_with_email').select('id, prenom, nom, role, email').eq('entreprise_id', ent.id).eq('is_super_admin', false).order('role').then(({ data }) => {
          const admins = (data || []).filter(u => u.role === 'admin')
          const employes = (data || []).filter(u => u.role !== 'admin')
          setEntUsers(prev => ({ ...prev, [ent.id]: { admins, employes } }))
        })
      })
    }
    if (mods) setModules(mods)
    if (details) {
      const detailsMap = {}
      details.forEach(d => { detailsMap[d.entreprise_id] = d })
      setEntDetails(detailsMap)
    }
    setLoading(false)
  }

  async function fetchEntModules(entId) {
    const { data } = await supabase.from('entreprise_modules').select('module_id,actif').eq('entreprise_id', entId)
    const rows = data || []
    setEntModules(prev => ({ ...prev, [entId]: rows }))
    return rows
  }

  async function fetchEntUsers(entId) {
    const { data } = await supabase
      .from('profiles_with_email')
      .select('id, prenom, nom, role, email')
      .eq('entreprise_id', entId)
      .eq('is_super_admin', false)
      .order('role')
    const admins = (data || []).filter(u => u.role === 'admin')
    const employes = (data || []).filter(u => u.role !== 'admin')
    setEntUsers(prev => ({ ...prev, [entId]: { admins, employes } }))
  }

  async function fetchPostesEtDeps(entId) {
    const [{ data: postes }, { data: deps }] = await Promise.all([
      supabase.from('postes').select('id, nom, departement_id, actif').eq('entreprise_id', entId).eq('actif', true).order('nom'),
      supabase.from('departements').select('id, nom, code, actif').eq('entreprise_id', entId).eq('actif', true).order('nom'),
    ])
    setEntPostes(prev => ({ ...prev, [entId]: postes || [] }))
    setEntDeps(prev => ({ ...prev, [entId]: deps || [] }))
  }

  async function deleteUser(userId, entId) {
    setUserDeleteConfirm(null)
    try {
      const { error: rpcErr } = await supabase.rpc('supprimer_membre_complet', { p_user_id: userId })
      if (rpcErr) throw rpcErr
      setMsg({ type: 'success', text: 'Utilisateur supprimé.' })
      fetchEntUsers(entId)
      fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: 'Erreur suppression : ' + err.message })
    }
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

  async function ouvrirEdition(ent) {
    setEditEntreprise(ent)
    setEditLoading(true)
    try {
      const modules = await fetchEntModules(ent.id)
      setForm(buildEditionForm(ent, modules))
      setShowForm(true)
    } finally {
      setEditLoading(false)
    }
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
        nom: form.nom, slug: form.slug || buildCreationSlug(form.nom),
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

      // Creation automatique du site principal
      if (!editEntreprise) {
        const siteSlug = entData.nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        await supabase.from('sites').insert({
          entreprise_id: entId,
          nom: entData.nom,
          slug: siteSlug,
          adresse: entData.adresse || '',
          ville: entData.ville || '',
          pays: entData.pays || 'France',
          actif: true,
        })
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

            // Premier admin (creation via create-user, seul point d'entree autorise)
            let adminCredentials = null
            if (!editEntreprise && form.admin_email) {
                      const adminResult = await creerCompteMembre(entId, { prenom: form.admin_prenom || 'Admin', nom: form.admin_nom || entData.nom, email: form.admin_email, telephone: form.admin_telephone || null, poste_id: null, poste_secondaire_id: null, departement_ids: [], actif: true }, 'admin')
                      adminCredentials = { email: adminResult.email, password: adminResult.temp_password }
            }

            const baseMsg = editEntreprise ? 'Entreprise modifiee !' : 'Entreprise creee avec ' + (form.departements_selectionnes?.length || 0) + ' depts et ' + (form.postes_selectionnes?.filter(p => p.selectionne).length || 0) + ' postes !'
            setMsg({ type: 'success', text: adminCredentials ? (baseMsg + ' Admin cree - Identifiant : ' + adminCredentials.email + ' / Mot de passe temporaire : ' + adminCredentials.password + ' (a transmettre une seule fois)') : baseMsg })
            setShowForm(false)
            fetchData()
    } catch (e) {
      setMsg({ type: 'error', text: 'Erreur : ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntreprise(ent) {
    setDeleteConfirm(null)
    try {
      const { error } = await supabase.rpc('supprimer_entreprise_complete', { p_entreprise_id: ent.id })
      if (error) throw error
      setMsg({ type: 'success', text: 'Entreprise "' + ent.nom + '" supprimee.' })
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: 'Erreur: ' + err.message })
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

  const searchLower = searchQuery.trim().toLowerCase()
  const entreprisesAffichees = entreprises.filter(ent => {
    if (!searchLower) return true
    const userBucket = entUsers[ent.id] || { admins: [], employes: [] }
    const haystacks = [
      ent.nom,
      ent.slug,
      ent.secteur,
      ent.email_contact,
      ...(userBucket.admins || []).map(u => `${u.prenom} ${u.nom} ${u.email || ''}`),
      ...(userBucket.employes || []).map(u => `${u.prenom} ${u.nom} ${u.email || ''}`),
    ]
    return haystacks.filter(Boolean).some(value => value.toLowerCase().includes(searchLower))
  })

  const configAlerts = entreprisesAffichees.flatMap(ent => {
    const detail = entDetails[ent.id]
    if (!detail) return []
    const alerts = []
    if ((detail.nb_sites || 0) === 0) alerts.push({ id: ent.id + ':sites', label: 'Aucun site configuré' })
    if ((detail.nb_admins || 0) === 0) alerts.push({ id: ent.id + ':admins', label: 'Aucun admin entreprise' })
    if ((detail.nb_personnel || 0) === 0) alerts.push({ id: ent.id + ':personnel', label: 'Aucun personnel' })
    return alerts.map(alert => ({ entreprise: ent, ...alert }))
  })

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

async function creerCompteMembre(entrepriseId, formData, role) {
    const payload = {
      prenom: formData.prenom,
      nom: formData.nom,
      role,
      entreprise_id: entrepriseId,
      email: formData.email || undefined,
      telephone: formData.telephone || null,
      poste_id: formData.poste_id || null,
      poste_secondaire_id: formData.poste_secondaire_id || null,
      departement_ids: (formData.departement_ids && formData.departement_ids.length > 0) ? formData.departement_ids : undefined,
      actif: formData.actif !== false,
    }
    const { data, error } = await supabase.functions.invoke('create-user', { body: payload })
    if (error) throw error
    if (data && data.success === false) throw new Error(data.error || 'Erreur lors de la creation du compte')
    return data
}

async function createAdmin(entrepriseId) {
    setAdminSaving(true)
    setAdminMsg(null)
    try {
      const result = await creerCompteMembre(entrepriseId, adminForm, 'admin')
      setAdminSuccessInfo({ email: result.email, password: result.temp_password, url: APP_URL, nom: adminForm.prenom + ' ' + adminForm.nom })
      setAdminForm({ prenom: '', nom: '', email: '', telephone: '', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true })
      await fetchData()
    } catch (err) {
      setAdminMsg({ type: 'error', text: err.message || 'Erreur lors de la creation' })
    } finally {
      setAdminSaving(false)
    }
}

async function createEmploye(entrepriseId) {
    setEmployeSaving(true)
    setEmployeMsg(null)
    try {
      const result = await creerCompteMembre(entrepriseId, employeForm, employeForm.role || 'employe')
      setEmployeSuccessInfo({ email: result.email, password: result.temp_password, url: APP_URL, nom: employeForm.prenom + ' ' + employeForm.nom })
      setEmployeForm({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true })
      await fetchData()
    } catch (err) {
      setEmployeMsg({ type: 'error', text: err.message || 'Erreur creation employe' })
    } finally {
      setEmployeSaving(false)
    }
}

// VUE PRINCIPALE
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <BrandMark size={28} radius={6} />
        <div style={{ background: '#1F2937', color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>VELOR SUPER ADMIN</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1F2937', flex: 1 }}>Back-office Velor One</h1>
      </div>
      {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46', fontSize: 13 }}>{msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard titre="Entreprises totales" valeur={stats.total} couleur="#3B82F6" />
        <StatCard titre="Entreprises actives" valeur={stats.actives} couleur="#10B981" />
        <StatCard titre="Utilisateurs totaux" valeur={stats.totalUsers} couleur="#8B5CF6" />
        <StatCard titre="Sites total" valeur={stats.totalSites} couleur="#F59E0B" />
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
          <div style={{ marginBottom: 14 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher une entreprise ou un utilisateur..."
              style={{ width: '100%', maxWidth: 520, border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {configAlerts.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 14, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>Alertes de configuration</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {configAlerts.slice(0, 8).map(alert => (
                    <span key={alert.id} style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                      {alert.entreprise.nom} · {alert.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {entreprisesAffichees.map(e => {
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
                        {entDetails[e.id] && (
                          <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 10, paddingTop: 10 }}>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: '#6B7280' }}>
                              <span>🏢 <strong style={{ color: '#374151' }}>{entDetails[e.id].nb_sites}</strong> site{entDetails[e.id].nb_sites > 1 ? 's' : ''}</span>
                              <span>👤 <strong style={{ color: '#3B82F6' }}>{entDetails[e.id].nb_admins}</strong> admin{entDetails[e.id].nb_admins > 1 ? 's' : ''}</span>
                              <span>👥 <strong style={{ color: '#10B981' }}>{entDetails[e.id].nb_personnel}</strong> personnel</span>
                            </div>
                            {entDetails[e.id].sites && entDetails[e.id].sites.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {entDetails[e.id].sites.map((site, si) => (
                                  <div key={si} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
                                    <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 4 }}>
                                      🏨 {site.site_nom}{site.site_ville ? ' — ' + site.site_ville : ''}
                                      <span style={{ marginLeft: 6, fontSize: 10, color: site.site_actif ? '#10B981' : '#EF4444' }}>✏ {site.site_actif ? 'Actif' : 'Inactif'}</span>
                                    </div>
                                    {site.admins && site.admins.length > 0 && (
                                      <div style={{ marginTop: 4 }}>
                                        <span style={{ color: '#3B82F6', fontWeight: 600, fontSize: 10 }}>ADMINS: </span>
                                        {site.admins.map((a, ai) => (
                                          <span key={ai} style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4, fontSize: 10, marginLeft: 4 }}>
                                            {a.prenom} {a.nom}{a.email ? ' (' + a.email + ')' : ''}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {site.personnel && site.personnel.length > 0 && (
                                      <div style={{ marginTop: 4 }}>
                                        <span style={{ color: '#10B981', fontWeight: 600, fontSize: 10 }}>PERSONNEL: </span>
                                        {site.personnel.map((p, pi) => (
                                          <span key={pi} style={{ background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 4, fontSize: 10, marginLeft: 4 }}>
                                            {p.prenom} {p.nom} ({p.role}{p.departement ? ' — ' + p.departement : ''})
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {(!site.admins || site.admins.length === 0) && (!site.personnel || site.personnel.length === 0) && (
                                      <div style={{ color: '#9CA3AF', fontSize: 11, fontStyle: 'italic' }}>Aucun utilisateur sur ce site</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#9CA3AF', fontSize: 11, fontStyle: 'italic' }}>Aucun site créé pour cette entreprise.</div>
                            )}
                          </div>
                        )}
                        {expandedEnt === e.id ? 'Fermer' : 'Modules'}
                      </button>
                      <button onClick={() => ouvrirEdition(e)} disabled={editLoading} style={{ padding: '6px 12px', border: '1px solid #3B82F6', color: '#3B82F6', background: '#EFF6FF', borderRadius: 6, cursor: editLoading ? 'not-allowed' : 'pointer', fontSize: 12 }}>Modifier</button>
                      <button onClick={() => toggleActifEntreprise(e)} style={{ padding: '6px 12px', border: '1px solid ' + (e.actif ? '#EF4444' : '#10B981'), color: e.actif ? '#EF4444' : '#10B981', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {e.actif ? 'Desactiver' : 'Reactiver'}
                      </button>
                                         <button onClick={() => { const w = expandedUsersEnt === e.id; setExpandedUsersEnt(w ? null : e.id); if (!w) fetchEntUsers(e.id) }} style={{ padding: '6px 12px', border: '1px solid #6366F1', color: '#6366F1', background: '#EEF2FF', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>👥 Utilisateurs</button>
                      <button onClick={() => { setAdminModalEnt(e); setAdminForm({ prenom: '', nom: '', email: '', telephone: '', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setAdminMsg(null); setAdminSuccessInfo(null); fetchPostesEtDeps(e.id); setShowAdminModal(true) }} style={{ padding: '6px 12px', border: '1px solid #8B5CF6', color: '#8B5CF6', background: '#F5F3FF', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>+ Admin</button>
                                         <button onClick={() => { setEmployeModalEnt(e); setEmployeForm({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setEmployeMsg(null); setEmployeSuccessInfo(null); fetchPostesEtDeps(e.id); setShowEmployeModal(true) }} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>+ Employe</button>
                      <button onClick={() => setDeleteConfirm(e)} style={{ padding: '6px 12px', border: '1px solid #EF4444', color: '#EF4444', background: '#FEF2F2', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>🗑 Supprimer</button>
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
                {expandedUsersEnt === e.id && (
                  <div style={{ borderTop: '1px solid #C7D2FE', padding: '14px 16px', background: '#EEF2FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>👥 Utilisateurs ({(entUsers[e.id]?.admins.length||0) + (entUsers[e.id]?.employes.length||0)} au total)</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setAdminModalEnt(e); setAdminForm({ prenom: '', nom: '', email: '', telephone: '', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setAdminMsg(null); setAdminSuccessInfo(null); fetchPostesEtDeps(e.id); setShowAdminModal(true) }} style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>+ Admin</button>
                        <button onClick={() => { setEmployeModalEnt(e); setEmployeForm({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setEmployeMsg(null); setEmployeSuccessInfo(null); fetchPostesEtDeps(e.id); setShowEmployeModal(true) }} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>+ Employé</button>
                      </div>
                    </div>
                    {!entUsers[e.id] ? (
                      <div style={{ color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>Chargement...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 6, letterSpacing: 0.5 }}>👤 ADMINS ({entUsers[e.id].admins.length})</div>
                          {entUsers[e.id].admins.length === 0 ? (
                            <div style={{ color: '#9CA3AF', fontSize: 11, fontStyle: 'italic', paddingLeft: 8 }}>Aucun admin</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {entUsers[e.id].admins.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EDE9FE', borderRadius: 8, padding: '7px 10px' }}>
                                  <div>
                                    <span style={{ fontWeight: 600, fontSize: 12, color: '#4C1D95' }}>{u.prenom} {u.nom}</span>
                                    {u.email && <span style={{ fontSize: 11, color: '#6D28D9', marginLeft: 8 }}>{u.email}</span>}
                                    <span style={{ marginLeft: 8, background: '#7C3AED', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>admin</span>
                                  </div>
                                  <button onClick={() => setUserDeleteConfirm({ user: u, entId: e.id })} style={{ background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>🗑 Supprimer</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', marginBottom: 6, letterSpacing: 0.5 }}>👥 EMPLOYÉS ({entUsers[e.id].employes.length})</div>
                          {entUsers[e.id].employes.length === 0 ? (
                            <div style={{ color: '#9CA3AF', fontSize: 11, fontStyle: 'italic', paddingLeft: 8 }}>Aucun employé</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {entUsers[e.id].employes.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#D1FAE5', borderRadius: 8, padding: '7px 10px' }}>
                                  <div>
                                    <span style={{ fontWeight: 600, fontSize: 12, color: '#064E3B' }}>{u.prenom} {u.nom}</span>
                                    {u.email && <span style={{ fontSize: 11, color: '#065F46', marginLeft: 8 }}>{u.email}</span>}
                                    <span style={{ marginLeft: 8, background: '#10B981', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>{u.role}</span>
                                  </div>
                                  <button onClick={() => setUserDeleteConfirm({ user: u, entId: e.id })} style={{ background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>🗑 Supprimer</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
            {userDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
              <h3 style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 8 }}>Supprimer cet utilisateur ?</h3>
              <p style={{ color: '#374151', fontSize: 14, marginBottom: 4 }}><strong>{userDeleteConfirm.user.prenom} {userDeleteConfirm.user.nom}</strong></p>
              <p style={{ color: '#6B7280', fontSize: 12, marginBottom: 20 }}>{userDeleteConfirm.user.email}<br/>Cette action est <strong>irréversible</strong>.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setUserDeleteConfirm(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer' }}>Annuler</button>
                <button onClick={() => deleteUser(userDeleteConfirm.user.id, userDeleteConfirm.entId)} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Oui, supprimer</button>
              </div>
            </div>
          </div>
        )}
        {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑</div>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Supprimer cette entreprise ?</h3>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>
              Cette action va supprimer <strong>"{deleteConfirm.nom}"</strong> ainsi que tous ses sites, utilisateurs et modules. Cette action est <strong>irreversible</strong>.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 14 }}>Annuler</button>
              <button onClick={() => deleteEntreprise(deleteConfirm)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Oui, supprimer</button>
            </div>
          </div>
        </div>
      )}
      {showAdminModal && adminModalEnt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 460, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ajouter un Admin</h3>
              <button onClick={() => { setShowAdminModal(false); setAdminMsg(null); setAdminSuccessInfo(null) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>X</button>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Entreprise : <strong>{adminModalEnt.nom}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete="off" placeholder="Prenom *" value={adminForm.prenom} onChange={ev => setAdminForm(f => ({ ...f, prenom: ev.target.value }))} style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14 }} />
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete="off" placeholder="Nom *" value={adminForm.nom} onChange={ev => setAdminForm(f => ({ ...f, nom: ev.target.value }))} style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14 }} />
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete="off" placeholder="Email (optionnel)" type="email" value={adminForm.email} onChange={ev => setAdminForm(f => ({ ...f, email: ev.target.value }))} style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14 }} />
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete="off" placeholder="Telephone (optionnel)" value={adminForm.telephone} onChange={ev => setAdminForm(f => ({ ...f, telephone: ev.target.value }))} style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14 }} />
              <Field label="Poste principal">
                <select value={adminForm.poste_id} onChange={ev => setAdminForm(f => ({ ...f, poste_id: ev.target.value }))} style={inputStyle}>
                  <option value="">Aucun</option>
                  {(entPostes[adminModalEnt.id] || []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </Field>
              <Field label="Poste secondaire (optionnel)">
                <select value={adminForm.poste_secondaire_id} onChange={ev => setAdminForm(f => ({ ...f, poste_secondaire_id: ev.target.value }))} style={inputStyle}>
                  <option value="">Aucun</option>
                  {(entPostes[adminModalEnt.id] || []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </Field>
              <Field label="Departements">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(entDeps[adminModalEnt.id] || []).map(d => {
                    const sel = (adminForm.departement_ids || []).includes(d.id)
                    return (
                      <button key={d.id} type="button" onClick={() => setAdminForm(f => ({ ...f, departement_ids: sel ? f.departement_ids.filter(x => x !== d.id) : [...(f.departement_ids || []), d.id] }))} style={{ padding: '5px 12px', borderRadius: 16, border: '1.5px solid ' + (sel ? '#8B5CF6' : '#E5E7EB'), background: sel ? '#8B5CF618' : '#fff', color: sel ? '#8B5CF6' : '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: sel ? 700 : 400 }}>{d.nom}</button>
                    )
                  })}
                  {(entDeps[adminModalEnt.id] || []).length === 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Aucun departement pour cette entreprise</span>}
                </div>
              </Field>
              <Field label="Statut">
                <select value={adminForm.actif ? 'actif' : 'inactif'} onChange={ev => setAdminForm(f => ({ ...f, actif: ev.target.value === 'actif' }))} style={inputStyle}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </Field>
            </div>
            {adminSuccessInfo ? (
              <div style={{ marginTop: 12, padding: 12, background: '#D1FAE5', borderRadius: 8, fontSize: 12, color: '#065F46' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Admin cree ! Transmettez ces infos une seule fois :</div>
                <div>Identifiant/Email : <strong>{adminSuccessInfo.email}</strong></div>
                <div>Mot de passe temporaire : <strong>{adminSuccessInfo.password}</strong></div>
                <div>URL : <strong>{adminSuccessInfo.url}</strong></div>
              </div>
            ) : adminMsg ? (
              <div style={{ marginTop: 12, padding: '10px 14px', background: adminMsg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: adminMsg.type === 'success' ? '#065F46' : '#991B1B', borderRadius: 8, fontSize: 13 }}>
                {adminMsg.text}
              </div>
            ) : null} <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdminModal(false); setAdminMsg(null) }} style={{ padding: '10px 20px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Annuler</button>
              <button onClick={() => createAdmin(adminModalEnt.id)} disabled={adminSaving || !adminForm.prenom || !adminForm.nom} style={{ padding: '10px 20px', background: adminSaving ? '#A78BFA' : '#8B5CF6', color: '#fff', border: 'none', borderRadius: 8, cursor: adminSaving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
                {adminSaving ? 'Creation...' : "Creer l'admin"}
              </button>
            </div>
          </div>
        </div>
      )}
{showEmployeModal && employeModalEnt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 460, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 16, color: '#1F2937' }}>Ajouter un membre - {employeModalEnt.nom}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete='off' placeholder='Prenom' value={employeForm.prenom} onChange={e => setEmployeForm(f => ({ ...f, prenom: e.target.value }))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete='off' placeholder='Nom' value={employeForm.nom} onChange={e => setEmployeForm(f => ({ ...f, nom: e.target.value }))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete='off' placeholder='Email (optionnel)' type='email' value={employeForm.email} onChange={e => setEmployeForm(f => ({ ...f, email: e.target.value }))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
              <input readOnly onFocus={e => e.target.removeAttribute('readonly')} autoComplete='off' placeholder='Telephone (optionnel)' value={employeForm.telephone} onChange={e => setEmployeForm(f => ({ ...f, telephone: e.target.value }))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
              <Field label="Role">
                <select value={employeForm.role} onChange={e => setEmployeForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                  <option value="employe">Employe</option>
                  <option value="responsable">Responsable</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Poste principal">
                <select value={employeForm.poste_id} onChange={e => setEmployeForm(f => ({ ...f, poste_id: e.target.value }))} style={inputStyle}>
                  <option value="">Aucun</option>
                  {(entPostes[employeModalEnt.id] || []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </Field>
              <Field label="Poste secondaire (optionnel)">
                <select value={employeForm.poste_secondaire_id} onChange={e => setEmployeForm(f => ({ ...f, poste_secondaire_id: e.target.value }))} style={inputStyle}>
                  <option value="">Aucun</option>
                  {(entPostes[employeModalEnt.id] || []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </Field>
              <Field label="Departements">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(entDeps[employeModalEnt.id] || []).map(d => {
                    const sel = (employeForm.departement_ids || []).includes(d.id)
                    return (
                      <button key={d.id} type="button" onClick={() => setEmployeForm(f => ({ ...f, departement_ids: sel ? f.departement_ids.filter(x => x !== d.id) : [...(f.departement_ids || []), d.id] }))} style={{ padding: '5px 12px', borderRadius: 16, border: '1.5px solid ' + (sel ? '#10B981' : '#E5E7EB'), background: sel ? '#10B98118' : '#fff', color: sel ? '#10B981' : '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: sel ? 700 : 400 }}>{d.nom}</button>
                    )
                  })}
                  {(entDeps[employeModalEnt.id] || []).length === 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Aucun departement pour cette entreprise</span>}
                </div>
              </Field>
              <Field label="Statut">
                <select value={employeForm.actif ? 'actif' : 'inactif'} onChange={e => setEmployeForm(f => ({ ...f, actif: e.target.value === 'actif' }))} style={inputStyle}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </Field>
              {employeSuccessInfo ? (
                <div style={{ padding: 12, background: '#D1FAE5', borderRadius: 8, fontSize: 12, color: '#065F46' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Membre cree ! Transmettez ces infos une seule fois :</div>
                  <div>Identifiant/Email : <strong>{employeSuccessInfo.email}</strong></div>
                  <div>Mot de passe temporaire : <strong>{employeSuccessInfo.password}</strong></div>
                  <div>URL : <strong>{employeSuccessInfo.url}</strong></div>
                </div>
              ) : employeMsg ? (
                <div style={{ padding: '8px 12px', borderRadius: 6, background: employeMsg.type === 'error' ? '#FEE2E2' : '#D1FAE5', color: employeMsg.type === 'error' ? '#DC2626' : '#065F46', fontSize: 13 }}>{employeMsg.text}</div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => createEmploye(employeModalEnt.id)} disabled={employeSaving || !employeForm.prenom || !employeForm.nom} style={{ flex: 1, background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontWeight: 600 }}>{employeSaving ? 'Creation...' : 'Creer'}</button>
                <button onClick={() => { setShowEmployeModal(false); setEmployeMsg(null); setEmployeSuccessInfo(null) }} style={{ flex: 1, background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, padding: '10px 0', cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
          </div>
  )
}
