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
import { buildEntrepriseUpdatePayload, diffModulesEntreprise, mapSuperAdminError } from './superAdminControlUtils'
import { MODULES_DEVELOPPES } from '../lib/modulesDeveloppes'
import SelecteurPoste from '../components/SelecteurPoste'
import { departementsApresChoixPoste } from '../lib/postesDepartements'
import {
  applyEnterpriseCreationToState,
  buildEnterpriseCreationPayload,
  buildEnterpriseCreationSuccessMessage,
  mapEnterpriseCreationError,
} from './superAdminEnterpriseCreation'
import SuperAdminSupervision from './SuperAdminSupervision'
import SuperAdminUsersPanel from './SuperAdminUsersPanel'
import SuperAdminAssistance from './SuperAdminAssistance'
import SuperAdminEnterpriseStructure from './SuperAdminEnterpriseStructure'
import SuperAdminPlatformHealth from './SuperAdminPlatformHealth'
import BlocAbonnement from '../components/BlocAbonnement'
import SelecteurMenus from '../components/SelecteurMenus'
import { messageErreurEdge } from '../lib/edgeErreur'
import { definirMenusAutorises } from '../modules/organisation/services'

const PLAN_COLORS = { starter: '#6B7280', business: '#3B82F6', premium: '#8B5CF6', enterprise: '#F59E0B' } 
// Etat d'essai d'une entreprise, a partir de date_fin_abonnement.
// null = client etabli (pas de date de fin) -> aucun badge.
function infoEssai(e) {
  if (!e) return null
  // Recurrence active = client qui paie, ce n'est plus un essai.
  if (e.abonnement_recurrent) return { texte: 'Abonne - renouvellement mensuel', fond: '#ECFDF5', trait: '#A7F3D0', encre: '#065F46' }
  if (!e.date_fin_abonnement) return null
  const fin = new Date(e.date_fin_abonnement)
  if (Number.isNaN(fin.getTime())) return null
  const jours = Math.ceil((fin - new Date()) / 86400000)
  if (jours <= 0) return { texte: 'Essai termine - lecture seule', fond: '#FEF2F2', trait: '#FECACA', encre: '#991B1B' }
  if (jours <= 3) return { texte: 'Essai - J-' + jours + ', a rappeler', fond: '#FFFBEB', trait: '#FDE68A', encre: '#92400E' }
  return { texte: 'Essai - ' + jours + ' j restants', fond: '#EFF6FF', trait: '#BFDBFE', encre: '#1E40AF' }
}
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
  const { profile, contexteEntreprise, setContexteEntreprise } = useAuth()
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
    const [adminForm, setAdminForm] = useState({ prenom: '', nom: '', email: '', telephone: '', poste_id: '', poste_secondaire_id: '', departement_ids: [], site_id: '', actif: true })
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminMsg, setAdminMsg] = useState(null)
  const [showEmployeModal, setShowEmployeModal] = useState(false)
  const [employeModalEnt, setEmployeModalEnt] = useState(null)
    const [employeForm, setEmployeForm] = useState({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], site_id: '', actif: true })
  const [employeMenus, setEmployeMenus] = useState([])
  const [employeSaving, setEmployeSaving] = useState(false)
  const [employeMsg, setEmployeMsg] = useState(null)
  const [employeSuccessInfo, setEmployeSuccessInfo] = useState(null)
  const [entPostes, setEntPostes] = useState({})
  const [entDeps, setEntDeps] = useState({})
    const [entSites, setEntSites] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [entUsers, setEntUsers] = useState({})
  // Un echec de lecture ne doit pas se lire comme "zero utilisateur" :
  // les comptes existent en base, c'est la lecture qui a ete refusee.
  const [entUsersErreur, setEntUsersErreur] = useState({})
  const [expandedUsersEnt, setExpandedUsersEnt] = useState(null)
  const [userDeleteConfirm, setUserDeleteConfirm] = useState(null)
  // Demandes de pack superieur deposees par les clients (aucune activation auto)
  // Apercu avant d'aligner les modules sur le pack : {ent, entData, diff}
  const [apercuModules, setApercuModules] = useState(null)
  const [demandes, setDemandes] = useState([])
  // Un echec de lecture n'est pas une absence de demande. Sans cet etat,
  // l'onglet affichait "Aucune demande pour le moment" dans les deux cas.
  const [demandesErreur, setDemandesErreur] = useState(null)
  const [demandeSaving, setDemandeSaving] = useState(null)
  const [lastActivityByEntreprise, setLastActivityByEntreprise] = useState({})

  useEffect(() => {
    if (!profile?.is_super_admin) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const [{ data: ents }, { data: mods }, { data: details }, healthRes, demandesRes] = await Promise.all([
      supabase.from('entreprises').select('*').order('created_at', { ascending: false }),
      supabase.from('modules_catalogue').select('*').order('ordre'),
      supabase.from('super_admin_entreprises').select('*'),
      supabase.rpc('super_admin_platform_health'),
      supabase.from('demandes_pack').select('*').order('created_at', { ascending: false }),
    ])
    // On degrade plutot que de casser tout le back-office, mais on ne fait
    // plus passer un echec pour une liste vide : le Super Admin doit savoir
    // qu'il ne voit pas les demandes, pas croire qu'il n'en a aucune.
    if (demandesRes?.error) {
      setDemandes([])
      setDemandesErreur(demandesRes.error.message || 'Lecture impossible.')
    } else {
      setDemandes(demandesRes?.data || [])
      setDemandesErreur(null)
    }
    const health = Array.isArray(healthRes?.data) ? (healthRes.data[0] || null) : (healthRes?.data || null)
    let audits = []

    try {
      const { data, error: auditError } = await supabase.from('audit_events').select('entreprise_id, created_at').order('created_at', { ascending: false }).limit(2000)
      if (!auditError) audits = data || []
    } catch {
      audits = []
    }

    if (ents) {
      setEntreprises(ents)
      const par_plan = {}
      ents.forEach(e => { par_plan[e.plan] = (par_plan[e.plan] || 0) + 1 })
      setStats({
        total: health?.total_entreprises ?? ents.length,
        actives: health?.entreprises_actives ?? ents.filter(e => e.actif).length,
        totalUsers: health?.total_users ?? 0,
        totalSites: health?.total_sites ?? 0,
        par_plan,
      })
      // Auto-chargement utilisateurs de chaque entreprise
      // Meme lecture que fetchEntUsers, donc meme traitement des erreurs :
      // deux copies qui divergent, c'est un bug qui n'apparait qu'a un seul
      // endroit sur deux.
      ents.forEach(ent => { fetchEntUsers(ent.id) })
    }
    if (mods) setModules(mods)
    if (details) {
      const detailsMap = {}
      details.forEach(d => { detailsMap[d.entreprise_id] = d })
      setEntDetails(detailsMap)
    }
    if (audits) {
      const map = {}
      audits.forEach((evt) => {
        if (!evt.entreprise_id) return
        if (!map[evt.entreprise_id]) map[evt.entreprise_id] = evt.created_at
      })
      setLastActivityByEntreprise(map)
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
    const { data, error } = await supabase
      .from('profiles_with_email')
      .select('id, prenom, nom, role, email')
      .eq('entreprise_id', entId)
      .eq('is_super_admin', false)
      .order('role')

    // Sans ce test, une lecture refusee donnait data = null, donc une liste
    // vide, donc "Aucun admin" -- alors que les comptes sont bien en base.
    // On ne peut pas corriger ce qu'on ne voit pas.
    if (error) {
      setEntUsersErreur(prev => ({ ...prev, [entId]: error.message || 'lecture refusee' }))
      setEntUsers(prev => ({ ...prev, [entId]: { admins: [], employes: [] } }))
      return
    }

    setEntUsersErreur(prev => {
      if (!prev[entId]) return prev
      const suite = { ...prev }
      delete suite[entId]
      return suite
    })
    const admins = (data || []).filter(u => u.role === 'admin')
    const employes = (data || []).filter(u => u.role !== 'admin')
    setEntUsers(prev => ({ ...prev, [entId]: { admins, employes } }))
  }

  async function fetchPostesEtDeps(entId) {
        const [{ data: postes }, { data: deps }, { data: sites }] = await Promise.all([
      supabase.from('postes').select('id, nom, departement_id, actif').eq('entreprise_id', entId).eq('actif', true).order('nom'),
      supabase.from('departements').select('id, nom, code, actif').eq('entreprise_id', entId).eq('actif', true).order('nom'),
                supabase.from('sites').select('id, nom, actif').eq('entreprise_id', entId).eq('actif', true).order('nom'),
    ])
    setEntPostes(prev => ({ ...prev, [entId]: postes || [] }))
    setEntDeps(prev => ({ ...prev, [entId]: deps || [] }))
        setEntSites(prev => ({ ...prev, [entId]: sites || [] }))
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
      setMsg({ type: 'error', text: mapSuperAdminError(err, buildDependencyErrorMessage(err)) })
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
        ...buildEntrepriseUpdatePayload({
          ...form,
          slug: form.slug || buildCreationSlug(form.nom),
        }),
      }

      if (editEntreprise) {
        const { error } = await supabase.from('entreprises').update(entData).eq('id', editEntreprise.id)
        if (error) throw error

        // Le plan n'est qu'une etiquette : ce que voit le client vient de
        // entreprise_modules. On regarde si les deux se sont desynchronises
        // et, si oui, on montre AVANT d'ecrire quoi que ce soit.
        const actuels = (entModules[editEntreprise.id] || [])
          .filter(r => r.actif).map(r => r.module_id)
        const diff = diffModulesEntreprise({
          souhaites: form.modules_selectionnes || [],
          actuels,
          developpes: MODULES_DEVELOPPES,
        })

        if (!diff.aucunChangement || diff.reportes.length > 0) {
          setShowForm(false)
          setSaving(false)
          await fetchData()
          setApercuModules({ ent: editEntreprise, diff })
          return
        }

        setMsg({
          type: 'success',
          text: buildEnterpriseCreationSuccessMessage({
            isEdit: true,
            departementsCount: 0,
            postesCount: 0,
            adminCredentials: null,
          }),
        })
        setShowForm(false)
        await fetchData()
        return
      }

      const payload = buildEnterpriseCreationPayload(form, entData)
      const { data, error } = await supabase.functions.invoke('create-entreprise', { body: payload })
      // La fonction repond en 400/403/409 quand elle refuse : invoke() ne rend
      // alors qu'un "non-2xx status code", et le code reel (admin_create_failed,
      // admin_email_already_exists...) reste dans le CORPS de la reponse.
      // Sans cette lecture, trier les messages en aval ne sert a rien : on
      // trierait une phrase qui ne contient aucun code.
      if (error) throw new Error(await messageErreurEdge(error, 'enterprise_create_failed'))
      if (!data?.success) throw new Error(data?.error || 'enterprise_create_failed')

      const next = applyEnterpriseCreationToState(
        { entreprises, stats },
        {
          success: true,
          entreprise: data?.entreprise,
          health: data?.health,
        }
      )
      setEntreprises(next.entreprises)
      setStats(next.stats)

      const adminCredentials = data?.admin?.temp_password
        ? { email: data.admin.email, password: data.admin.temp_password }
        : null

      setMsg({
        type: 'success',
        text: buildEnterpriseCreationSuccessMessage({
          isEdit: false,
          departementsCount: form.departements_selectionnes?.length || 0,
          postesCount: form.postes_selectionnes?.filter(p => p.selectionne).length || 0,
          adminCredentials,
        }),
      })
      setShowForm(false)
      await fetchData()
    } catch (e) {
      setMsg({ type: 'error', text: mapEnterpriseCreationError(e) })
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
      setMsg({ type: 'error', text: mapSuperAdminError(err, buildDependencyErrorMessage(err)) })
    }
  }

  // Traitement d'une demande de pack. Ne touche JAMAIS aux modules :
  // l'activation reelle reste manuelle, via l'edition de l'entreprise, et
  // seulement quand le module concerne existe vraiment.
  async function changerStatutDemande(demande, statut) {
    setDemandeSaving(demande.id)
    const { error } = await supabase.from('demandes_pack')
      .update({ statut, traite_par: profile.id, traite_at: new Date().toISOString() })
      .eq('id', demande.id)
    setDemandeSaving(null)
    if (error) { setMsg({ type: 'error', text: 'Erreur : ' + error.message }); return }
    fetchData()
  }

  async function toggleActifEntreprise(ent) {
    const reactivation = !ent.actif

    // Confirmation uniquement pour la suspension : c'est elle qui coupe un
    // client. Reactiver ne casse rien, et un window.confirm qui ne s'affiche
    // pas donne un bouton qui "ne fait rien" -- c'est exactement ce qui nous
    // a coute une soiree sur le bouton d'activation d'abonnement.
    if (!reactivation && !window.confirm('Suspendre ' + ent.nom + ' ?\n\nSon espace passera en lecture seule pour tous ses utilisateurs.')) {
      return
    }

    setMsg(null)
    const { data, error } = await supabase
      .from('entreprises')
      .update({ actif: reactivation })
      .eq('id', ent.id)
      .select('id, nom, actif')

    if (error) {
      setMsg({ type: 'error', text: (reactivation ? 'Reactivation refusee : ' : 'Suspension refusee : ') + error.message })
      return
    }
    // Zero ligne sans erreur : la RLS a filtre la mise a jour en silence.
    if (!data || data.length === 0) {
      setMsg({ type: 'error', text: "Aucune ligne modifiee. La RLS a filtre la mise a jour sans lever d'erreur -- verifie que ton compte est bien Super Admin." })
      return
    }

    setMsg({
      type: 'success',
      text: reactivation
        ? data[0].nom + ' est reactivee.'
        : data[0].nom + ' est suspendue : son espace est en lecture seule.',
    })
    fetchData()
  }

  // Applique l'alignement montre dans l'apercu. Rien ici n'est decide :
  // tout a ete calcule et affiche avant.
  async function appliquerAlignementModules() {
    if (!apercuModules) return
    const { ent, diff } = apercuModules
    setDemandeSaving('modules')

    const lignes = [
      ...diff.aActiver.map(id => ({ entreprise_id: ent.id, module_id: id, actif: true, activated_at: new Date().toISOString() })),
      ...diff.aRetirer.map(id => ({ entreprise_id: ent.id, module_id: id, actif: false, activated_at: new Date().toISOString() })),
    ]

    if (lignes.length > 0) {
      const { error } = await supabase.from('entreprise_modules')
        .upsert(lignes, { onConflict: 'entreprise_id,module_id' })
      if (error) {
        setDemandeSaving(null)
        setMsg({ type: 'error', text: 'Modules non modifies : ' + error.message })
        setApercuModules(null)
        return
      }
    }

    setDemandeSaving(null)
    setApercuModules(null)
    setMsg({
      type: 'success',
      text: 'Modules alignes sur le pack de ' + ent.nom + ' : '
        + diff.aActiver.length + ' active(s), ' + diff.aRetirer.length + ' retire(s).'
        + ' Le client voit le changement a son prochain chargement de page.',
    })
    await fetchEntModules(ent.id)
    await fetchData()
  }

  async function toggleModuleEntreprise(entId, modId, actuel) {
    if (!window.confirm(actuel ? 'Désactiver ce module pour cette entreprise ?' : 'Activer ce module pour cette entreprise ?')) {
      return
    }
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
              {/* Le serveur genere un mot de passe aleatoire de 16 caracteres
                  (generateTempPassword, crypto.getRandomValues) et le renvoie
                  dans adminSuccessInfo. Cet encart annoncait un mot de passe
                  fixe, reste d'une ancienne version : celui qu'on communiquait
                  au client ne fonctionnait pas.
                  Le litteral est interdit par src/security/staticPasswordGuard.test.js,
                  ne le reintroduis pas, meme en commentaire. */}
              {form.admin_email && <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>Un mot de passe temporaire sera genere automatiquement et affiche une seule fois, apres la creation.</div>}
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
            site_id: formData.site_id || null,
      departement_ids: (formData.departement_ids && formData.departement_ids.length > 0) ? formData.departement_ids : undefined,
      actif: formData.actif !== false,
    }
    const { data, error } = await supabase.functions.invoke('create-user', { body: payload })
    if (error) throw new Error(await messageErreurEdge(error, 'Creation impossible.'))
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
      setAdminMsg({ type: 'error', text: mapSuperAdminError(err, 'Impossible de créer l administrateur.') })
    } finally {
      setAdminSaving(false)
    }
}

async function createEmploye(entrepriseId) {
    setEmployeSaving(true)
    setEmployeMsg(null)
    try {
      const result = await creerCompteMembre(entrepriseId, employeForm, employeForm.role || 'employe')

      // La liste blanche se pose apres coup, comme cote client : l'edge
      // function create-user ne la connait pas. Si ce second appel echoue,
      // le compte existe quand meme -- on le signale sans le perdre.
      if (result?.user_id && employeMenus.length > 0) {
        try {
          await definirMenusAutorises(result.user_id, employeMenus)
        } catch (err) {
          setEmployeMsg({ type: 'error', text: "Compte cree, mais les onglets visibles n'ont pas pu etre enregistres : " + (err.message || '') })
        }
      }

      setEmployeSuccessInfo({ email: result.email, password: result.temp_password, url: APP_URL, nom: employeForm.prenom + ' ' + employeForm.nom })
      setEmployeForm({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true })
      setEmployeMenus([])
      await fetchData()
    } catch (err) {
      setEmployeMsg({ type: 'error', text: mapSuperAdminError(err, 'Impossible de créer l utilisateur.') })
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
        {['entreprises','utilisateurs','modules','plans','demandes','supervision','plateforme','assistance'].map(o => {
          const nbNouvelles = o === 'demandes' ? demandes.filter(d => d.statut === 'nouvelle').length : 0
          const enEchec = o === 'demandes' && !!demandesErreur
          return (
            <button key={o} onClick={() => setOnglet(o)} style={{
              padding: '8px 18px', border: 'none', borderRadius: '6px 6px 0 0',
              background: onglet === o ? '#3B82F6' : 'transparent',
              color: onglet === o ? 'white' : '#6B7280', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              {o}
              {nbNouvelles > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{nbNouvelles}</span>
              )}
              {enEchec && (
                <span title="Les demandes n'ont pas pu etre lues" style={{ background: '#F59E0B', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>!</span>
              )}
            </button>
          )
        })}
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
                <div key={e.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ fontSize: 24, flexShrink: 0 }}>{secteurInfo?.icone || '🏢'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{e.nom}</span>
                          <span style={{ background: PLAN_COLORS[e.plan] + '22', color: PLAN_COLORS[e.plan], borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{e.plan}</span>
                          <span style={{ color: e.actif ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: 600 }}>{e.actif ? 'Actif' : 'Inactif'}</span>
                          {e.origine === 'inscription_autonome' && (
                            <span title="Entreprise creee par le client via la page publique /inscription" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                              Inscription autonome
                            </span>
                          )} 
                          {(() => {
                            const ess = infoEssai(e)
                            if (!ess) return null
                            return (
                              <span
                                title={e.date_fin_abonnement ? new Date(e.date_fin_abonnement).toLocaleDateString('fr-FR') : ''}
                                style={{ background: ess.fond, color: ess.encre, border: '1px solid ' + ess.trait, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                                {ess.texte}
                              </span>
                            )
                          })()}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                          {secteurInfo?.label || e.secteur} — {e.max_utilisateurs || '?'} users max
                          {e.email_contact && ' — ' + e.email_contact}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                          Créée le {e.created_at ? new Date(e.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                          {e.date_fin_abonnement && ((e.abonnement_recurrent ? " · Prochaine echeance le " : " · Fin d'ecriture le ") + new Date(e.date_fin_abonnement).toLocaleDateString('fr-FR'))}
                          {' · '}Dernière activité {lastActivityByEntreprise[e.id] ? new Date(lastActivityByEntreprise[e.id]).toLocaleString('fr-FR') : 'non disponible'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => { const wasExpanded = expandedEnt === e.id; setExpandedEnt(wasExpanded ? null : e.id); if (!wasExpanded) fetchEntModules(e.id) }} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', background: '#F9FAFB', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {expandedEnt === e.id ? 'Fermer' : 'Modules'}
                      </button>
                      {/* Assistance client : ouvrir le contexte d'une entreprise
                          fait basculer tous les modules metier sur ses donnees.
                          Un bandeau le rappelle en permanence en haut de l'ecran. */}
                      <button
                        onClick={() => {
                          const dejaActif = contexteEntreprise === e.id
                          setContexteEntreprise(dejaActif ? null : e.id)
                        }}
                        title={contexteEntreprise === e.id ? 'Quitter le contexte de ce client' : 'Travailler dans le contexte de ce client'}
                        style={{ padding: '6px 12px', border: '1px solid ' + (contexteEntreprise === e.id ? '#FDE68A' : '#E5E7EB'), background: contexteEntreprise === e.id ? '#FEF3C7' : '#F9FAFB', color: contexteEntreprise === e.id ? '#92400E' : '#374151', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {contexteEntreprise === e.id ? 'Contexte actif' : 'Ouvrir le contexte'}
                      </button>
                      <button onClick={() => ouvrirEdition(e)} disabled={editLoading} style={{ padding: '6px 12px', border: '1px solid #3B82F6', color: '#3B82F6', background: '#EFF6FF', borderRadius: 6, cursor: editLoading ? 'not-allowed' : 'pointer', fontSize: 12 }}>Modifier</button>
                      <button onClick={() => toggleActifEntreprise(e)} style={{ padding: '6px 12px', border: '1px solid ' + (e.actif ? '#EF4444' : '#10B981'), color: e.actif ? '#EF4444' : '#10B981', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {e.actif ? 'Desactiver' : 'Reactiver'}
                      </button>
                                         <button onClick={() => { const w = expandedUsersEnt === e.id; setExpandedUsersEnt(w ? null : e.id); if (!w) fetchEntUsers(e.id) }} style={{ padding: '6px 12px', border: '1px solid #6366F1', color: '#6366F1', background: '#EEF2FF', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>👥 Utilisateurs</button>
                      <button onClick={() => { setAdminModalEnt(e); setAdminForm({ prenom: '', nom: '', email: '', telephone: '', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setAdminMsg(null); setAdminSuccessInfo(null); fetchPostesEtDeps(e.id); setShowAdminModal(true) }} style={{ padding: '6px 12px', border: '1px solid #8B5CF6', color: '#8B5CF6', background: '#F5F3FF', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>+ Admin</button>
                                         <button onClick={() => { setEmployeModalEnt(e); setEmployeForm({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setEmployeMsg(null); setEmployeSuccessInfo(null); setEmployeMenus([]); fetchPostesEtDeps(e.id); fetchEntModules(e.id); setShowEmployeModal(true) }} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>+ Employe</button>
                      <button onClick={() => setDeleteConfirm(e)} style={{ padding: '6px 12px', border: '1px solid #EF4444', color: '#EF4444', background: '#FEF2F2', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>🗑 Supprimer</button>
                    </div>
                    <BlocAbonnement ent={e} onFait={fetchData} />
                  </div>
                  {expandedEnt === e.id && (
                    <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 16px', background: '#F9FAFB' }}>
                        {entDetails[e.id] && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: '#6B7280' }}>
                              <span>🏢 <strong style={{ color: '#374151' }}>{entDetails[e.id].nb_sites}</strong> site{entDetails[e.id].nb_sites > 1 ? 's' : ''}</span>
                              <span>👤 <strong style={{ color: '#3B82F6' }}>{entDetails[e.id].nb_admins}</strong> admin{entDetails[e.id].nb_admins > 1 ? 's' : ''}</span>
                              <span>👥 <strong style={{ color: '#10B981' }}>{entDetails[e.id].nb_personnel}</strong> personnel</span>
                            </div>
                            {entDetails[e.id].sites && entDetails[e.id].sites.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {entDetails[e.id].sites.map((site, si) => (
                                  <div key={si} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
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
                        <div style={{ borderTop: entDetails[e.id] ? '1px solid #E5E7EB' : 'none', paddingTop: 12, marginTop: entDetails[e.id] ? 12 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Modules (cliquer pour activer/desactiver)</div>
                        </div>
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
                        <button onClick={() => { setEmployeModalEnt(e); setEmployeForm({ prenom: '', nom: '', email: '', telephone: '', role: 'employe', poste_id: '', poste_secondaire_id: '', departement_ids: [], actif: true }); setEmployeMsg(null); setEmployeSuccessInfo(null); setEmployeMenus([]); fetchPostesEtDeps(e.id); fetchEntModules(e.id); setShowEmployeModal(true) }} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>+ Employé</button>
                      </div>
                    </div>
                    {entUsersErreur[e.id] ? (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '9px 12px', fontSize: 12 }}>
                        <strong>Lecture impossible.</strong> Les comptes de cette entreprise n'ont pas pu etre lus &mdash; ils existent peut-etre malgre tout. Motif : {entUsersErreur[e.id]}
                      </div>
                    ) : !entUsers[e.id] ? (
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
                {expandedEnt === e.id && (
                  <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 16px', background: '#FFFFFF' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Sites, départements et postes</div>
                    <SuperAdminEnterpriseStructure supabase={supabase} entrepriseId={e.id} />
                  </div>
                )}
                </div>
              )
            })}
            {entreprises.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Aucune entreprise. Creez la premiere.</div>}
          </div>
        </div>
      )}

      {onglet === 'utilisateurs' && (
        <SuperAdminUsersPanel supabase={supabase} profile={profile} entreprises={entreprises} />
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

      {onglet === 'demandes' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Demandes de pack superieur {demandesErreur ? '(inconnu)' : '(' + demandes.length + ')'}</h2>
          <p style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
            Un client ne peut pas activer un pack lui-meme : il depose une demande ici.
            L&apos;activation se fait a la main depuis la fiche entreprise, et uniquement pour un module reellement developpe.
          </p>

          {demandesErreur && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '16px 18px', color: '#991B1B', fontSize: 13, lineHeight: 1.6 }}>
              <strong>Les demandes n&apos;ont pas pu etre lues.</strong> Cet ecran ne dit donc rien sur leur nombre :
              il peut y en avoir en attente. Detail technique : {demandesErreur}
              <div style={{ marginTop: 10 }}>
                <button onClick={fetchData} style={{ padding: '6px 14px', border: '1px solid #991B1B', color: '#991B1B', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                  Reessayer
                </button>
              </div>
            </div>
          )}

          {!demandesErreur && demandes.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              Aucune demande pour le moment.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {demandes.map(d => {
              const ent = entreprises.find(x => x.id === d.entreprise_id)
              const couleurStatut = { nouvelle: '#3B82F6', en_cours: '#F59E0B', traitee: '#10B981', refusee: '#6B7280' }[d.statut] || '#6B7280'
              return (
                <div key={d.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderLeft: '3px solid ' + couleurStatut, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{ent?.nom || 'Entreprise supprimee'}</span>
                        <span style={{ background: (PLAN_COLORS[d.pack_demande] || '#6B7280') + '22', color: PLAN_COLORS[d.pack_demande] || '#6B7280', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                          {d.pack_demande || 'pack'}
                        </span>
                        <span style={{ background: couleurStatut + '22', color: couleurStatut, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{d.statut}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                        Plan actuel : <strong>{ent?.plan || '-'}</strong> &middot; secteur : {ent?.secteur || '-'} &middot; {new Date(d.created_at).toLocaleString('fr-FR')}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        Contact : {d.contact_email || '-'}{d.contact_telephone ? ' / ' + d.contact_telephone : ''}
                      </div>
                      {Array.isArray(d.modules_demandes) && d.modules_demandes.length > 0 && (
                        <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>Modules vises : {d.modules_demandes.join(', ')}</div>
                      )}
                      {d.message && (
                        <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#374151', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                          {d.message}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {ent && (
                        <button onClick={() => ouvrirEdition(ent)} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                          Ouvrir l&apos;entreprise
                        </button>
                      )}
                      {d.statut !== 'en_cours' && d.statut !== 'traitee' && (
                        <button disabled={demandeSaving === d.id} onClick={() => changerStatutDemande(d, 'en_cours')} style={{ background: '#fff', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                          Prendre en charge
                        </button>
                      )}
                      {d.statut !== 'traitee' && (
                        <button disabled={demandeSaving === d.id} onClick={() => changerStatutDemande(d, 'traitee')} style={{ background: '#fff', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                          Marquer traitee
                        </button>
                      )}
                      {d.statut !== 'refusee' && (
                        <button disabled={demandeSaving === d.id} onClick={() => changerStatutDemande(d, 'refusee')} style={{ background: '#fff', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                          Ne pas retenir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {onglet === 'supervision' && (
        <SuperAdminSupervision supabase={supabase} profile={profile} />
      )}

      {onglet === 'plateforme' && (
        <SuperAdminPlatformHealth supabase={supabase} />
      )}

      {onglet === 'assistance' && (
        <SuperAdminAssistance entreprises={entreprises} />
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
        {apercuModules && (() => {
          const { ent, diff } = apercuModules
          const nomModule = (id) => (MODULES_REGISTRY.find(m => m.id === id) || {}).nom || id
          const bloc = { borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.6, marginTop: 10 }
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 26, maxWidth: 520, width: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: '#111827', margin: 0 }}>
                  Aligner les modules de {ent.nom} ?
                </h3>
                <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                  Le pack a bien ete enregistre. Mais ce que voit le client depend des modules
                  actives, pas du pack. Voici ce qui changerait pour lui.
                </p>

                {diff.aActiver.length > 0 && (
                  <div style={{ ...bloc, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}>
                    <strong>A activer</strong><br />
                    {diff.aActiver.map(nomModule).join(', ')}
                  </div>
                )}

                {diff.aRetirer.length > 0 && (
                  <div style={{ ...bloc, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                    <strong>A retirer</strong><br />
                    {diff.aRetirer.map(nomModule).join(', ')}
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Le client perdra ces menus. Ses donnees ne sont pas supprimees.
                    </div>
                  </div>
                )}

                {diff.reportes.length > 0 && (
                  <div style={{ ...bloc, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                    <strong>Compris dans le pack, mais pas encore developpes</strong><br />
                    {diff.reportes.map(nomModule).join(', ')}
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Non actives : le client verrait un menu vide. A activer a la main quand ils seront prets.
                    </div>
                  </div>
                )}

                {diff.aucunChangement && (
                  <div style={{ ...bloc, background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' }}>
                    Aucun module a changer : les modules actifs correspondent deja au pack.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setApercuModules(null); setMsg({ type: 'success', text: 'Pack enregistre. Modules inchanges.' }) }}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                    Ne pas toucher aux modules
                  </button>
                  {!diff.aucunChangement && (
                    <button
                      onClick={appliquerAlignementModules}
                      disabled={demandeSaving === 'modules'}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: demandeSaving === 'modules' ? '#93A3C4' : '#1E40AF', color: '#fff', cursor: demandeSaving === 'modules' ? 'default' : 'pointer', fontWeight: 600, fontSize: 13 }}>
                      {demandeSaving === 'modules' ? 'Application...' : 'Appliquer'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
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
                            <Field label="Site">
                                            <select value={adminForm.site_id} onChange={ev => setAdminForm(f => ({ ...f, site_id: ev.target.value }))} style={inputStyle}>
                                                              <option value="">Aucun</option>
                                              {(entSites[adminModalEnt.id] || []).map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                                            </select>
                            </Field>
              <Field label="Poste principal">
                <SelecteurPoste
                  valeur={adminForm.poste_id}
                  onChange={v => setAdminForm(f => ({
                    ...f,
                    poste_id: v,
                    departement_ids: departementsApresChoixPoste(f.departement_ids, v, entPostes[adminModalEnt.id] || []),
                  }))}
                  postes={entPostes[adminModalEnt.id] || []}
                  departements={entDeps[adminModalEnt.id] || []}
                  style={inputStyle}
                  vide="Aucun"
                />
              </Field>
              <Field label="Poste secondaire (optionnel)">
                <SelecteurPoste
                  valeur={adminForm.poste_secondaire_id}
                  onChange={v => setAdminForm(f => ({ ...f, poste_secondaire_id: v }))}
                  postes={entPostes[adminModalEnt.id] || []}
                  departements={entDeps[adminModalEnt.id] || []}
                  style={inputStyle}
                  vide="Aucun"
                />
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
                            <Field label="Site">
                                            <select value={employeForm.site_id} onChange={e => setEmployeForm(f => ({ ...f, site_id: e.target.value }))} style={inputStyle}>
                                                              <option value="">Aucun</option>
                                              {(entSites[employeModalEnt.id] || []).map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                                            </select>
                            </Field>
              <Field label="Poste principal">
                <SelecteurPoste
                  valeur={employeForm.poste_id}
                  onChange={v => setEmployeForm(f => ({
                    ...f,
                    poste_id: v,
                    departement_ids: departementsApresChoixPoste(f.departement_ids, v, entPostes[employeModalEnt.id] || []),
                  }))}
                  postes={entPostes[employeModalEnt.id] || []}
                  departements={entDeps[employeModalEnt.id] || []}
                  style={inputStyle}
                  vide="Aucun"
                />
              </Field>
              <Field label="Poste secondaire (optionnel)">
                <SelecteurPoste
                  valeur={employeForm.poste_secondaire_id}
                  onChange={v => setEmployeForm(f => ({ ...f, poste_secondaire_id: v }))}
                  postes={entPostes[employeModalEnt.id] || []}
                  departements={entDeps[employeModalEnt.id] || []}
                  style={inputStyle}
                  vide="Aucun"
                />
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
              <Field label="Onglets visibles">
                <SelecteurMenus
                  valeur={employeMenus}
                  onChange={setEmployeMenus}
                  compact
                  moduleIds={(entModules[employeModalEnt.id] || []).filter(m => m.actif).map(m => m.module_id)}
                />
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
