import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const PALETTE = [
  '#E53935','#D81B60','#8E24AA','#5E35B1','#3949AB','#1E88E5',
  '#039BE5','#00ACC1','#00897B','#43A047','#7CB342','#F9A825',
  '#FB8C00','#F4511E','#6D4C41','#546E7A','#EC407A','#AB47BC',
]

const DEPS = ['reception','menage','maintenance','restauration','direction','cuisine','securite','technique']
const ROLES = ['employe','responsable','admin']

const emptyForm = { prenom: '', nom: '', email: '', role: 'employe', departement: 'reception', couleur: '#1E88E5', telephone: '' }

export default function Personnel() {
  const { profile: moi } = useAuth()
  const [employes, setEmployes] = useState([])
  const [showModal, setShowModal] = useState(false)
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
    // Filtre par entreprise_id — double sécurité côté client (RLS gère le reste)
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
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  function showError(msg) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 5000)
  }

  async function save() {
    if (!form.prenom.trim() || !form.nom.trim()) {
      showError('Prénom et nom obligatoires')
      return
    }
    if (!isAdmin) {
      showError('Seul un admin peut modifier les profils')
      return
    }
    setSaving(true)
    const payload = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      role: form.role,
      departement: form.departement,
      couleur: form.couleur,
      telephone: form.telephone?.trim() || null,
      avatar_initiales: (form.prenom[0] + form.nom[0]).toUpperCase(),
      entreprise_id: moi.entreprise_id,
    }
    try {
      if (editId) {
        const { error } = await supabase.from('profiles').update(payload).eq('id', editId)
        if (error) throw error
        showSuccess('✅ Profil mis à jour avec succès')
      } else {
        // Créer un profil placeholder — l'employé le liera à son compte auth à la connexion
        const newId = crypto.randomUUID()
        const { error } = await supabase.from('profiles').insert({
          ...payload,
          id: newId,
          actif: true,
          created_at: new Date().toISOString(),
        })
        if (error) throw error
        showSuccess('✅ Employé ajouté. Il peut maintenant créer son compte avec son email.')
      }
      await fetchEmployes()
      setShowModal(false)
      setForm(emptyForm)
      setEditId(null)
    } catch (err) {
      showError('Erreur : ' + (err.message || JSON.stringify(err)))
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
      showSuccess(emp.actif ? '⚠️ Employé désactivé' : '✅ Employé réactivé')
    }
  }

  async function changeRole(emp, newRole) {
    if (!isAdmin) return
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', emp.id)
    if (!error) {
      setEmployes(prev => prev.map(e => e.id === emp.id ? { ...e, role: newRole } : e))
      showSuccess('✅ Rôle mis à jour : ' + newRole)
    }
  }

  function openEdit(emp) {
    setForm({
      prenom: emp.prenom || '',
      nom: emp.nom || '',
      email: '',
      role: emp.role || 'employe',
      departement: emp.departement || 'reception',
      couleur: emp.couleur || '#1E88E5',
      telephone: emp.telephone || '',
    })
    setEditId(emp.id)
    setShowModal(true)
  }

  // Filtres dynamiques
  const filtres = employes.filter(e => {
    const nameMatch = (e.prenom + ' ' + e.nom).toLowerCase().includes(search.toLowerCase()) ||
      (e.departement || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.email || '').toLowerCase().includes(search.toLowerCase())
    const depMatch = !filterDep || e.departement === filterDep
    const roleMatch = !filterRole || e.role === filterRole
    return nameMatch && depMatch && roleMatch
  })

  const actifs = filtres.filter(e => e.actif !== false)
  const inactifs = filtres.filter(e => e.actif === false)

  // Statistiques équipe
  const stats = {
    total: employes.filter(e => e.actif !== false).length,
    admins: employes.filter(e => e.actif !== false && e.role === 'admin').length,
    responsables: employes.filter(e => e.actif !== false && e.role === 'responsable').length,
    employes: employes.filter(e => e.actif !== false && e.role === 'employe').length,
  }

  const deps = [...new Set(employes.map(e => e.departement).filter(Boolean))]

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Notifications */}
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

      {/* Stats rapides (admin seulement) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Total actifs', val: stats.total, color: '#185FA5' },
            { label: 'Admins', val: stats.admins, color: '#7C3AED' },
            { label: 'Responsables', val: stats.responsables, color: '#D97706' },
            { label: 'Employés', val: stats.employes, color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Barre de recherche + filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          style={{ flex: 1, minWidth: 140, padding: '8px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}
        />
        <select value={filterDep} onChange={e => setFilterDep(e.target.value)}
          style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', color: '#444' }}>
          <option value="">Tous les dépts</option>
          {deps.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', color: '#444' }}>
          <option value="">Tous les rôles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        {canEdit && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true) }}
            style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Ajouter
          </button>
        )}
      </div>

      {/* Liste actifs */}
      {actifs.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Équipe active ({actifs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {actifs.map(emp => (
              <EmployeCard key={emp.id} emp={emp} canEdit={canEdit} isAdmin={isAdmin}
                onEdit={openEdit} onToggleActif={toggleActif} onCouleur={updateCouleur}
                onChangeRole={changeRole} moi={moi} />
            ))}
          </div>
        </>
      )}

      {/* Liste inactifs */}
      {inactifs.length > 0 && isAdmin && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Inactifs ({inactifs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: .6 }}>
            {inactifs.map(emp => (
              <EmployeCard key={emp.id} emp={emp} canEdit={canEdit} isAdmin={isAdmin}
                onEdit={openEdit} onToggleActif={toggleActif} onCouleur={updateCouleur}
                onChangeRole={changeRole} moi={moi} />
            ))}
          </div>
        </>
      )}

      {filtres.length === 0 && (
        <div style={{ textAlign: 'center', color: '#bbb', padding: 50, fontSize: 14 }}>Aucun résultat</div>
      )}

      {/* Modal ajout/édition */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 18 }}>
              {editId ? 'Modifier l\'employé' : 'Ajouter un employé'}
            </div>

            {/* Aperçu avatar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: form.couleur + '22', border: '3px solid ' + form.couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 500, color: form.couleur }}>
                {form.prenom ? (form.prenom[0] + (form.nom[0] || '')).toUpperCase() : '??'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['Prénom *', 'prenom', 'Jean'], ['Nom *', 'nom', 'Dupont']].map(([l, k, ph]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Téléphone</label>
              <input value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+33 6 00 00 00 00" style={inp} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Département</label>
              <select value={form.departement} onChange={e => set('departement', e.target.value)} style={inp}>
                {DEPS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>

            {isAdmin && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Rôle</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} style={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  Admin = accès total à l\'entreprise | Responsable = accès lecture équipe | Employé = accès personnel
                </div>
              </div>
            )}

            {/* Sélecteur couleur */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Couleur planning</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {PALETTE.map(c => (
                  <div key={c} onClick={() => set('couleur', c)} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    outline: form.couleur === c ? '3px solid ' + c : 'none',
                    outlineOffset: 2,
                    transform: form.couleur === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform .15s'
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Personnalisé :</span>
                <input type="color" value={form.couleur} onChange={e => set('couleur', e.target.value)}
                  style={{ width: 32, height: 28, border: '0.5px solid #d0cfc8', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <span style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{form.couleur}</span>
              </div>
            </div>

            {!editId && (
              <div style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 16, lineHeight: 1.6 }}>
                💡 <strong>Info :</strong> L\'employé devra créer son compte depuis la page de connexion. Son profil sera automatiquement lié à son compte.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setEditId(null) }}
                style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving}
                style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                {saving ? 'Enregistrement...' : editId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeCard({ emp, canEdit, isAdmin, onEdit, onToggleActif, onCouleur, onChangeRole, moi }) {
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
        {/* Avatar */}
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

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#222', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {emp.prenom} {emp.nom}
            {isSelf && <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 8 }}>moi</span>}
            <span style={{ fontSize: 10, background: rc.bg, color: rc.color, padding: '1px 7px', borderRadius: 8, fontWeight: 700, textTransform: 'uppercase' }}>{emp.role}</span>
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', gap: 10 }}>
            <span>📍 {emp.departement}</span>
            {emp.telephone && <span>📞 {emp.telephone}</span>}
          </div>
        </div>

        {/* Actions admin */}
        {canEdit && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isAdmin && !isSelf && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowActions(!showActions)}
                  style={{ border: '0.5px solid #e0dfd8', background: '#fafaf8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#555' }}>
                  ⚙️
                </button>
                {showActions && (
                  <div style={{ position: 'absolute', right: 0, top: 32, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: 8, zIndex: 60, boxShadow: '0 4px 20px rgba(0,0,0,.1)', minWidth: 170 }}>
                    {/* Changer le rôle */}
                    <div style={{ fontSize: 11, color: '#999', padding: '4px 8px', borderBottom: '0.5px solid #f0efe8', marginBottom: 4 }}>CHANGER LE RÔLE</div>
                    {ROLES.filter(r => r !== emp.role).map(r => (
                      <button key={r} onClick={() => { onChangeRole(emp, r); setShowActions(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#333', borderRadius: 4 }}>
                        → Passer {r}
                      </button>
                    ))}
                    <div style={{ borderTop: '0.5px solid #f0efe8', marginTop: 4, paddingTop: 4 }}>
                      <button onClick={() => { onEdit(emp); setShowActions(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#333', borderRadius: 4 }}>
                        ✏️ Modifier le profil
                      </button>
                      <button onClick={() => { onToggleActif(emp); setShowActions(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: emp.actif !== false ? '#FEF2F2' : '#F0FDF4', padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: emp.actif !== false ? '#EF4444' : '#16A34A', borderRadius: 4, marginTop: 2 }}>
                        {emp.actif !== false ? '⛔ Désactiver' : '✅ Réactiver'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Responsable : juste modifier (pas rôle) */}
            {isResponsable && !isSelf && (
              <button onClick={() => onEdit(emp)}
                style={{ border: '0.5px solid #e0dfd8', background: '#fafaf8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#555' }}>
                ✏️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barre couleur bas */}
      <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: couleur + '33' }}>
        <div style={{ height: '100%', width: '100%', background: couleur, borderRadius: 2, opacity: .6 }} />
      </div>

      {/* Fermer les menus en cliquant ailleurs */}
      {(showPalette || showActions) && (
        <div onClick={() => { setShowPalette(false); setShowActions(false) }} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      )}
    </div>
  )
}

const lbl = { fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }
const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
