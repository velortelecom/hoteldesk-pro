import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://vcpnrisxbnvyupsbieie.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || ''

const PALETTE = [
  '#E53935','#D81B60','#8E24AA','#5E35B1','#3949AB','#1E88E5',
  '#039BE5','#00ACC1','#00897B','#43A047','#7CB342','#F9A825',
  '#FB8C00','#F4511E','#6D4C41','#546E7A','#EC407A','#AB47BC',
]

const DEPS = ['reception','menage','maintenance','restauration','direction','cuisine','securite','technique']
const ROLES = ['employe','responsable','admin']

const emptyForm = { prenom: '', nom: '', email: '', password: '', role: 'employe', departement: 'reception', couleur: '#1E88E5', telephone: '' }

export default function Personnel() {
  const { profile: moi } = useAuth()
  const [employes, setEmployes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showCredsModal, setShowCredsModal] = useState(false)
  const [nouvellesCreds, setNouvellesCreds] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterDep, setFilterDep] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const isAdmin = moi?.role === 'admin' || moi?.is_super_admin
  const isResponsable = moi?.role === 'responsable'
  const canEdit = isAdmin || isResponsable

  useEffect(() => { fetchEmployes() }, [moi?.entreprise_id])

  async function fetchEmployes() {
    if (!moi?.entreprise_id) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('entreprise_id', moi.entreprise_id)
      .order('prenom')
    if (!error) setEmployes(data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  function showError(msg) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 6000)
  }

  // Creer un nouveau compte employe via Admin API (sans changer la session courante)
  async function creerCompte() {
    if (!form.prenom.trim() || !form.nom.trim()) {
      showError('Prenom et nom obligatoires')
      return
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      showError('Email valide obligatoire')
      return
    }
    if (!form.password || form.password.length < 6) {
      showError('Mot de passe obligatoire (min 6 caracteres)')
      return
    }
    setSaving(true)

    try {
      // Utiliser la Admin API Supabase pour creer l utilisateur SANS changer la session courante
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          email_confirm: true,
          user_metadata: { prenom: form.prenom.trim(), nom: form.nom.trim() },
        }),
      })

      const authData = await createRes.json()

      if (!createRes.ok || authData.error) {
        showError('Erreur creation compte : ' + (authData.error_description || authData.message || authData.error || 'Erreur inconnue'))
        setSaving(false)
        return
      }

      const userId = authData.id

      // Attendre un court instant que le trigger Supabase cree le profil de base
      await new Promise(resolve => setTimeout(resolve, 800))

      // PATCH (UPDATE) le profil existant cree par le trigger avec les vraies donnees
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          role: form.role,
          departement: form.departement,
          couleur: form.couleur,
          telephone: form.telephone?.trim() || null,
          entreprise_id: moi.entreprise_id,
          actif: true,
          avatar_initiales: (form.prenom.trim()[0] + form.nom.trim()[0]).toUpperCase(),
        }),
      })

      if (!profRes.ok) {
        const profErr = await profRes.text()
        // Si le profil n existe pas encore, on le cree avec PUT
        const putRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            id: userId,
            prenom: form.prenom.trim(),
            nom: form.nom.trim(),
            role: form.role,
            departement: form.departement,
            couleur: form.couleur,
            telephone: form.telephone?.trim() || null,
            entreprise_id: moi.entreprise_id,
            actif: true,
            avatar_initiales: (form.prenom.trim()[0] + form.nom.trim()[0]).toUpperCase(),
          }),
        })
        if (!putRes.ok) {
          showError('Erreur profil : ' + profErr)
          setSaving(false)
          return
        }
      }

      setNouvellesCreds({
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      })
      setShowCredsModal(true)
      setShowModal(false)
      setForm(emptyForm)
      await fetchEmployes()
    } catch (err) {
      showError('Erreur reseau : ' + err.message)
    }
    setSaving(false)
  }

  // Modifier un profil existant (sans changer le mot de passe)
  async function modifierProfil() {
    if (!form.prenom.trim() || !form.nom.trim()) {
      showError('Prenom et nom obligatoires')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      role: form.role,
      departement: form.departement,
      couleur: form.couleur,
      telephone: form.telephone?.trim() || null,
      avatar_initiales: (form.prenom[0] + form.nom[0]).toUpperCase(),
    }).eq('id', editId)

    if (error) {
      showError('Erreur : ' + error.message)
    } else {
      showSuccess('Profil mis a jour')
      await fetchEmployes()
      setShowModal(false)
      setForm(emptyForm)
      setEditId(null)
    }
    setSaving(false)
  }

  async function updateCouleur(id, couleur) {
    await supabase.from('profiles').update({ couleur }).eq('id', id)
    setEmployes(prev => prev.map(e => e.id === id ? { ...e, couleur } : e))
  }

  async function toggleActif(emp) {
    if (!isAdmin) return
    const { error } = await supabase.from('profiles').update({ actif: !emp.actif }).eq('id', emp.id)
    if (!error) {
      fetchEmployes()
      showSuccess(emp.actif ? 'Employe desactive' : 'Employe reactive')
    }
  }

  async function changeRole(emp, newRole) {
    if (!isAdmin) return
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', emp.id)
    if (!error) {
      setEmployes(prev => prev.map(e => e.id === emp.id ? { ...e, role: newRole } : e))
      showSuccess('Role mis a jour : ' + newRole)
    }
  }

  function openEdit(emp) {
    setForm({
      prenom: emp.prenom || '',
      nom: emp.nom || '',
      email: '',
      password: '',
      role: emp.role || 'employe',
      departement: emp.departement || 'reception',
      couleur: emp.couleur || '#1E88E5',
      telephone: emp.telephone || '',
    })
    setEditId(emp.id)
    setShowModal(true)
  }

  const filtres = employes.filter(e => {
    const nameMatch = (e.prenom + ' ' + e.nom).toLowerCase().includes(search.toLowerCase()) ||
      (e.departement || '').toLowerCase().includes(search.toLowerCase())
    const depMatch = !filterDep || e.departement === filterDep
    const roleMatch = !filterRole || e.role === filterRole
    return nameMatch && depMatch && roleMatch
  })

  const actifs = filtres.filter(e => e.actif !== false)
  const inactifs = filtres.filter(e => e.actif === false)

  const stats = {
    total: employes.filter(e => e.actif !== false).length,
    admins: employes.filter(e => e.actif !== false && e.role === 'admin').length,
    responsables: employes.filter(e => e.actif !== false && e.role === 'responsable').length,
    employes: employes.filter(e => e.actif !== false && e.role === 'employe').length,
  }

  const deps = [...new Set(employes.map(e => e.departement).filter(Boolean))]

  return (
    <div style={{ padding: '16px 0' }}>
      {successMsg && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {errorMsg}
        </div>
      )}

      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Total actifs', val: stats.total, color: '#185FA5' },
            { label: 'Admins', val: stats.admins, color: '#7C3AED' },
            { label: 'Responsables', val: stats.responsables, color: '#D97706' },
            { label: 'Employes', val: stats.employes, color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          style={{ flex: 1, minWidth: 140, padding: '8px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}
        />
        <select value={filterDep} onChange={e => setFilterDep(e.target.value)}
          style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', color: '#444' }}>
          <option value="">Tous les depts</option>
          {deps.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', color: '#444' }}>
          <option value="">Tous les roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        {isAdmin && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true) }}
            style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
            + Creer employe
          </button>
        )}
      </div>

      {actifs.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Equipe active ({actifs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {actifs.map(emp => (
              <EmployeCard key={emp.id} emp={emp} canEdit={canEdit} isAdmin={isAdmin} isResponsable={isResponsable}
                onEdit={openEdit} onToggleActif={toggleActif} onCouleur={updateCouleur}
                onChangeRole={changeRole} moi={moi} />
            ))}
          </div>
        </>
      )}

      {inactifs.length > 0 && isAdmin && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Inactifs ({inactifs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: .6 }}>
            {inactifs.map(emp => (
              <EmployeCard key={emp.id} emp={emp} canEdit={canEdit} isAdmin={isAdmin} isResponsable={isResponsable}
                onEdit={openEdit} onToggleActif={toggleActif} onCouleur={updateCouleur}
                onChangeRole={changeRole} moi={moi} />
            ))}
          </div>
        </>
      )}

      {filtres.length === 0 && (
        <div style={{ textAlign: 'center', color: '#bbb', padding: 50, fontSize: 14 }}>Aucun resultat</div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {editId ? 'Modifier le profil' : 'Creer un employe'}
            </div>
            {!editId && (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 18 }}>
                Definissez l email et le mot de passe. Le compte sera immediatement actif.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: form.couleur + '22', border: '3px solid ' + form.couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: form.couleur }}>
                {form.prenom ? (form.prenom[0] + (form.nom[0] || '')).toUpperCase() : '??'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['Prenom *', 'prenom', 'Jean'], ['Nom *', 'nom', 'Dupont']].map(([l, k, ph]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
                </div>
              ))}
            </div>

            {!editId && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Email *</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="employe@example.com" style={inp} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Mot de passe * (min 6 caracteres)</label>
                  <input type="text" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Definir un mot de passe" style={inp} />
                </div>
              </>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Telephone</label>
              <input value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+33 6 00 00 00 00" style={inp} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Departement</label>
              <select value={form.departement} onChange={e => set('departement', e.target.value)} style={inp}>
                {DEPS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>

            {isAdmin && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} style={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Couleur planning</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {PALETTE.map(c => (
                  <div key={c} onClick={() => set('couleur', c)} style={{
                    width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                    outline: form.couleur === c ? '3px solid ' + c : 'none',
                    outlineOffset: 2,
                    transform: form.couleur === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform .15s'
                  }} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setEditId(null) }}
                style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>
                Annuler
              </button>
              <button onClick={editId ? modifierProfil : creerCompte} disabled={saving}
                style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', opacity: saving ? .7 : 1, fontWeight: 600 }}>
                {saving ? 'En cours...' : editId ? 'Enregistrer' : 'Creer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredsModal && nouvellesCreds && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#065F46' }}>Compte cree !</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{nouvellesCreds.prenom} {nouvellesCreds.nom}</div>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Identifiants de connexion
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#185FA5', background: '#EFF6FF', padding: '8px 12px', borderRadius: 8, fontFamily: 'monospace' }}>
                  {nouvellesCreds.email}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Mot de passe</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace', background: '#F9FAFB', padding: '8px 0', borderRadius: 8 }}>
                  {nouvellesCreds.password}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Role</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', background: '#F9FAFB', padding: '6px 12px', borderRadius: 8 }}>
                  {nouvellesCreds.role}
                </div>
              </div>
            </div>

            <div style={{ background: '#FEF3C7', color: '#92400E', fontSize: 12, padding: '10px 14px', borderRadius: 8, marginBottom: 20, lineHeight: 1.6 }}>
              Transmettez ces identifiants a l employe.
            </div>

            <button onClick={() => { setShowCredsModal(false); setNouvellesCreds(null); showSuccess('Employe cree avec succes') }}
              style={{ width: '100%', padding: '12px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Compris, fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeCard({ emp, canEdit, isAdmin, isResponsable, onEdit, onToggleActif, onCouleur, onChangeRole, moi }) {
  const [showPalette, setShowPalette] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const couleur = emp.couleur || '#1E88E5'
  const initiales = emp.avatar_initiales || ((emp.prenom?.[0] || '') + (emp.nom?.[0] || '')).toUpperCase()
  const isSelf = emp.id === moi?.id

  const roleColors = {
    admin: { bg: '#F3E8FF', color: '#7C3AED' },
    responsable: { bg: '#FEF3C7', color: '#D97706' },
    employe: { bg: '#F0FDF4', color: '#059669' },
  }
  const rc = roleColors[emp.role] || roleColors.employe

  return (
    <div style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={() => canEdit && setShowPalette(!showPalette)}
          style={{ width: 44, height: 44, borderRadius: '50%', background: couleur + '22', border: '2.5px solid ' + couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: couleur, flexShrink: 0, cursor: canEdit ? 'pointer' : 'default', position: 'relative' }}>
          {initiales}
          {showPalette && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 50, top: 0, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: 10, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,.12)', display: 'flex', flexWrap: 'wrap', gap: 6, width: 186 }}>
              {PALETTE.map(c => (
                <div key={c} onClick={() => { onCouleur(emp.id, c); setShowPalette(false) }}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', outline: couleur === c ? '2px solid ' + c : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#222', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {emp.prenom} {emp.nom}
            {isSelf && <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 8 }}>moi</span>}
            <span style={{ fontSize: 10, background: rc.bg, color: rc.color, padding: '1px 7px', borderRadius: 8, fontWeight: 700, textTransform: 'uppercase' }}>{emp.role}</span>
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{emp.departement}</span>
            {emp.telephone && <span>{emp.telephone}</span>}
            {emp.email && <span style={{ color: '#aaa' }}>{emp.email}</span>}
          </div>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isAdmin && !isSelf && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowActions(!showActions)}
                  style={{ border: '0.5px solid #e0dfd8', background: '#fafaf8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#555' }}>
                  options
                </button>
                {showActions && (
                  <div style={{ position: 'absolute', right: 0, top: 32, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: 8, zIndex: 60, boxShadow: '0 4px 20px rgba(0,0,0,.1)', minWidth: 170 }}>
                    <div style={{ fontSize: 11, color: '#999', padding: '4px 8px', borderBottom: '0.5px solid #f0efe8', marginBottom: 4 }}>CHANGER LE ROLE</div>
                    {ROLES.filter(r => r !== emp.role).map(r => (
                      <button key={r} onClick={() => { onChangeRole(emp, r); setShowActions(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#333', borderRadius: 4 }}>
                        Passer {r}
                      </button>
                    ))}
                    <div style={{ borderTop: '0.5px solid #f0efe8', marginTop: 4, paddingTop: 4 }}>
                      <button onClick={() => { onEdit(emp); setShowActions(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#333', borderRadius: 4 }}>
                        Modifier le profil
                      </button>
                      <button onClick={() => { onToggleActif(emp); setShowActions(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: emp.actif !== false ? '#FEF2F2' : '#F0FDF4', padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: emp.actif !== false ? '#EF4444' : '#16A34A', borderRadius: 4, marginTop: 2 }}>
                        {emp.actif !== false ? 'Desactiver' : 'Reactiver'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isResponsable && !isSelf && (
              <button onClick={() => onEdit(emp)}
                style={{ border: '0.5px solid #e0dfd8', background: '#fafaf8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#555' }}>
                Modifier
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: couleur + '33' }}>
        <div style={{ height: '100%', width: '100%', background: couleur, borderRadius: 2, opacity: .6 }} />
      </div>

      {(showPalette || showActions) && (
        <div onClick={() => { setShowPalette(false); setShowActions(false) }} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      )}
    </div>
  )
}

const lbl = { fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }
const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
