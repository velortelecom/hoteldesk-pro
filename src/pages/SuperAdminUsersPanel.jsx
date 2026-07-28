import { useEffect, useMemo, useState } from 'react'
import { MODULES_REGISTRY } from '../modules/registry'
import { buildDependencyErrorMessage, filterSuperAdminUsers } from './superAdminControlUtils'

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }
const inputStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 13 }

export default function SuperAdminUsersPanel({ supabase, profile, entreprises = [] }) {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ search: '', role: '', status: '', entrepriseId: '' })
  const [sortBy, setSortBy] = useState('name')
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false); const [resetTarget, setResetTarget] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    setMsg(null)
    try {
      const [profilesRes, depRes, sitesRes, postesRes, moduleRes] = await Promise.all([
        supabase
          .from('profiles_with_email')
          .select('id, prenom, nom, email, role, actif, entreprise_id, site_id, poste_id, is_super_admin, auth_created_at, last_sign_in_at')
          .eq('is_super_admin', false)
          .order('nom'),
        supabase.from('employe_departements').select('profile_id, departement_id'),
        supabase.from('sites').select('id, nom, entreprise_id'),
        supabase.from('postes').select('id, nom, entreprise_id'),
        supabase.from('entreprise_modules').select('entreprise_id, module_id, actif').eq('actif', true),
      ])

      if (profilesRes.error) throw profilesRes.error
      if (depRes.error) throw depRes.error
      if (sitesRes.error) throw sitesRes.error
      if (postesRes.error) throw postesRes.error
      if (moduleRes.error) throw moduleRes.error

      const sitesMap = Object.fromEntries((sitesRes.data || []).map((site) => [site.id, site]))
      const postesMap = Object.fromEntries((postesRes.data || []).map((poste) => [poste.id, poste]))
      const entMap = Object.fromEntries((entreprises || []).map((ent) => [ent.id, ent]))
      const moduleNameMap = Object.fromEntries((MODULES_REGISTRY || []).map((mod) => [mod.id, mod.nom]))

      const moduleNamesByEntreprise = {}
      ;(moduleRes.data || []).forEach((row) => {
        if (!moduleNamesByEntreprise[row.entreprise_id]) moduleNamesByEntreprise[row.entreprise_id] = []
        const moduleName = moduleNameMap[row.module_id] || row.module_id
        moduleNamesByEntreprise[row.entreprise_id].push(moduleName)
      })

      const depIds = Array.from(new Set((depRes.data || []).map((row) => row.departement_id).filter(Boolean)))
      let depMap = {}
      if (depIds.length > 0) {
        const { data: deps, error: depLookupError } = await supabase.from('departements').select('id, nom').in('id', depIds)
        if (depLookupError) throw depLookupError
        depMap = Object.fromEntries((deps || []).map((dep) => [dep.id, dep.nom]))
      }

      const depByProfile = {}
      ;(depRes.data || []).forEach((row) => {
        if (!depByProfile[row.profile_id]) depByProfile[row.profile_id] = []
        if (depMap[row.departement_id]) depByProfile[row.profile_id].push(depMap[row.departement_id])
      })

      const normalized = (profilesRes.data || []).map((user) => ({
        ...user,
        entreprise_nom: entMap[user.entreprise_id]?.nom || 'Entreprise inconnue',
        site_nom: user.site_id ? sitesMap[user.site_id]?.nom || 'Site inconnu' : '—',
        poste_nom: user.poste_id ? postesMap[user.poste_id]?.nom || 'Poste inconnu' : '—',
        departement_nom: (depByProfile[user.id] || []).join(', ') || '—',
        modules_accessibles: (moduleNamesByEntreprise[user.entreprise_id] || []).join(', ') || '—',
      }))

      setUsers(normalized)
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Chargement utilisateurs impossible.' })
    } finally {
      setLoading(false)
    }
  }

  const visibleUsers = useMemo(() => {
    const filtered = filterSuperAdminUsers(users, filters, profile)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'last_sign_in_at') {
        const aValue = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0
        const bValue = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0
        return bValue - aValue
      }
      if (sortBy === 'status') {
        return Number(a.actif === false) - Number(b.actif === false)
      }
      return `${a.prenom || ''} ${a.nom || ''}`.localeCompare(`${b.prenom || ''} ${b.nom || ''}`)
    })
  }, [users, filters, profile, sortBy])

  async function handleInvokeFunction(name, body, successText) {
    setSaving(true)
    setMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke(name, { body })
      if (error) throw error
      if (data && data.success === false) throw new Error(data.error || 'Action refusée')
      setMsg({ type: 'success', text: successText })
      await fetchUsers()
      return data
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Action impossible.' })
      return null
    } finally {
      setSaving(false)
    }
  }

  async function updateUserProfile() {
    if (!editing?.id) return
    if (!window.confirm('Confirmer la modification de cet utilisateur ?')) return
    await handleInvokeFunction(
      'update-user-profile',
      { user_id: editing.id, prenom: editing.prenom, nom: editing.nom },
      'Profil utilisateur mis à jour.'
    )
    setEditing(null)
  }

  async function changeRole(user, newRole) {
    if (newRole === user.role) return
    if (!window.confirm('Confirmer le changement de rôle ?')) return
    await handleInvokeFunction('update-user-role', { user_id: user.id, new_role: newRole }, 'Rôle utilisateur mis à jour.')
  }

  async function toggleActif(user) {
    const targetActif = user.actif === false
    if (!window.confirm(targetActif ? 'Activer cet utilisateur ?' : 'Désactiver cet utilisateur ?')) return
    await handleInvokeFunction('toggle-user-actif', { user_id: user.id, actif: targetActif }, targetActif ? 'Utilisateur activé.' : 'Utilisateur désactivé.')
  }

  function resetPassword(user) {
    setResetTarget(user)
  }

  async function confirmResetPassword(mdpPropre) {
    const data = await handleInvokeFunction('reset-password', { user_id: resetTarget.id, new_password: mdpPropre }, 'Mot de passe mis a jour.')
    if (data) {
      setMsg({ type: 'success', text: 'Mot de passe pour ' + (data.email || resetTarget.email || 'cet utilisateur') + ' : ' + data.temp_password })
    }
    setResetTarget(null)
  }

  async function deleteUser(user) {
    if (user.id === profile?.id) {
      setMsg({ type: 'error', text: 'Suppression de votre propre compte interdite.' })
      return
    }
    if (!window.confirm('Confirmer la suppression définitive de cet utilisateur ?')) return
    setSaving(true)
    setMsg(null)
    try {
      const { error } = await supabase.rpc('supprimer_membre_complet', { p_user_id: user.id })
      if (error) throw error
      setMsg({ type: 'success', text: 'Utilisateur supprimé.' })
      await fetchUsers()
    } catch (error) {
      setMsg({ type: 'error', text: buildDependencyErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {msg && (
        <div style={{ ...cardStyle, background: msg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: msg.type === 'error' ? '#991B1B' : '#065F46' }}>
          {msg.text}
        </div>
      )}

      <section style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          <input
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder='Rechercher nom ou email'
            style={inputStyle}
          />
          <select value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))} style={inputStyle}>
            <option value=''>Tous les rôles</option>
            <option value='admin'>Admin</option>
            <option value='responsable'>Responsable</option>
            <option value='employe'>Employé</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>
            <option value=''>Tous statuts</option>
            <option value='actif'>Actifs</option>
            <option value='inactif'>Inactifs</option>
          </select>
          <select value={filters.entrepriseId} onChange={(e) => setFilters((prev) => ({ ...prev, entrepriseId: e.target.value }))} style={inputStyle}>
            <option value=''>Toutes entreprises</option>
            {(entreprises || []).map((ent) => (
              <option key={ent.id} value={ent.id}>{ent.nom}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle}>
            <option value='name'>Tri: nom</option>
            <option value='last_sign_in_at'>Tri: dernière connexion</option>
            <option value='status'>Tri: statut</option>
          </select>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>Utilisateurs visibles: {visibleUsers.length}</div>
        {loading ? (
          <div>Chargement des utilisateurs...</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {visibleUsers.map((user) => (
              <div key={user.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10, background: '#FAFAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{user.prenom} {user.nom}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{user.email || 'Sans email'} · {user.entreprise_nom}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Poste: {user.poste_nom} · Site: {user.site_nom} · Département: {user.departement_nom}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Dernière connexion: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('fr-FR') : 'Jamais'} · Statut: {user.actif === false ? 'Désactivé' : 'Actif'} · Modules: {user.modules_accessibles}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setEditing({ ...user })} style={btnPlain}>Éditer</button>
                    <select value={user.role} onChange={(e) => changeRole(user, e.target.value)} style={inputStyle}>
                      <option value='admin'>Admin</option>
                      <option value='responsable'>Responsable</option>
                      <option value='employe'>Employé</option>
                    </select>
                    <button onClick={() => toggleActif(user)} disabled={saving} style={btnPlain}>{user.actif === false ? 'Activer' : 'Désactiver'}</button>
                    <button onClick={() => resetPassword(user)} disabled={saving} style={btnPrimary}>Reset MDP</button>
                    <button onClick={() => deleteUser(user)} disabled={saving} style={btnDanger}>Supprimer</button>
                  </div>
                </div>
              </div>
            ))}
            {visibleUsers.length === 0 && <div style={{ color: '#6B7280' }}>Aucun utilisateur trouvé.</div>}
          </div>
        )}
      </section>

      {editing && (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <h3 style={{ marginTop: 0 }}>Modifier utilisateur</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={editing.prenom || ''} onChange={(e) => setEditing((prev) => ({ ...prev, prenom: e.target.value }))} placeholder='Prénom' style={inputStyle} />
              <input value={editing.nom || ''} onChange={(e) => setEditing((prev) => ({ ...prev, nom: e.target.value }))} placeholder='Nom' style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setEditing(null)} style={btnPlain}>Annuler</button>
              <button onClick={updateUserProfile} style={btnPrimary}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <ModalResetPassword user={resetTarget} saving={saving} onClose={() => setResetTarget(null)} onConfirm={confirmResetPassword} />
      )}
    </div>
  )
}

const btnPlain = { border: '1px solid #D1D5DB', background: '#fff', color: '#374151', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }
const btnPrimary = { border: 'none', background: '#3B82F6', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }
const btnDanger = { border: 'none', background: '#EF4444', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }
const modalCard = { width: 420, maxWidth: '92vw', background: '#fff', borderRadius: 12, padding: 16 }

function ModalResetPassword({ user, saving, onClose, onConfirm }) {
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState(null)

  function handleConfirm() {
    const mdpPropre = mdp.trim()
    if (mdpPropre.length > 0 && mdpPropre.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }
    setErreur(null)
    onConfirm(mdpPropre || undefined)
  }

  return (
    <div style={modalBackdrop}>
      <div style={modalCard}>
        <h3 style={{ marginTop: 0 }}>Reinitialiser le mot de passe</h3>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Pour {user.prenom} {user.nom}. Laissez vide pour generer un mot de passe automatiquement.</p>
        {erreur && <div style={{ color: '#991B1B', fontSize: 13, marginBottom: 8 }}>{erreur}</div>}
        <input value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder='Nouveau mot de passe (min. 8 caracteres)' style={inputStyle} autoFocus />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} disabled={saving} style={btnPlain}>Annuler</button>
          <button onClick={handleConfirm} disabled={saving} style={btnPrimary}>Reinitialiser</button>
        </div>
      </div>
    </div>
  )
}
