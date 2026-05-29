import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const PALETTE = [
  '#E53935','#D81B60','#8E24AA','#5E35B1','#3949AB','#1E88E5',
  '#039BE5','#00ACC1','#00897B','#43A047','#7CB342','#F9A825',
  '#FB8C00','#F4511E','#6D4C41','#546E7A','#EC407A','#AB47BC',
]

const DEPS = ['reception','menage','maintenance','restauration','direction']
const ROLES = ['employe','responsable','admin']

const emptyForm = { prenom: '', nom: '', email: '', role: 'employe', departement: 'reception', couleur: '#1E88E5' }

export default function Personnel() {
  const { profile: moi } = useAuth()
  const [employes, setEmployes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchEmployes() }, [])

  async function fetchEmployes() {
    const { data } = await supabase.from('profiles').select('*').order('prenom')
    setEmployes(data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.prenom.trim() || !form.nom.trim()) return
    setSaving(true)
    const payload = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      role: form.role,
      departement: form.departement,
      couleur: form.couleur,
      avatar_initiales: (form.prenom[0] + form.nom[0]).toUpperCase()
    }
    if (editId) {
      await supabase.from('profiles').update(payload).eq('id', editId)
    } else {
      // Création via auth admin — ici on crée juste le profil manuellement
      // (l'employé devra créer son compte avec cet email)
      const { data: existing } = await supabase.from('profiles').select('id').eq('avatar_initiales', payload.avatar_initiales).maybeSingle()
      if (!existing) {
        // Insérer un profil "placeholder" — sera lié quand l'employé crée son compte
        await supabase.from('profiles').upsert({ ...payload, id: crypto.randomUUID(), actif: true })
      }
    }
    await fetchEmployes()
    setShowModal(false)
    setForm(emptyForm)
    setEditId(null)
    setSaving(false)
  }

  async function updateCouleur(id, couleur) {
    await supabase.from('profiles').update({ couleur }).eq('id', id)
    setEmployes(prev => prev.map(e => e.id === id ? { ...e, couleur } : e))
  }

  async function toggleActif(emp) {
    await supabase.from('profiles').update({ actif: !emp.actif }).eq('id', emp.id)
    fetchEmployes()
  }

  function openEdit(emp) {
    setForm({ prenom: emp.prenom, nom: emp.nom, email: '', role: emp.role, departement: emp.departement, couleur: emp.couleur || '#1E88E5' })
    setEditId(emp.id)
    setShowModal(true)
  }

  const filtres = employes.filter(e =>
    (e.prenom + ' ' + e.nom).toLowerCase().includes(search.toLowerCase()) ||
    (e.departement || '').toLowerCase().includes(search.toLowerCase())
  )

  const actifs = filtres.filter(e => e.actif !== false)
  const inactifs = filtres.filter(e => e.actif === false)

  const isAdmin = moi?.role === 'admin' || moi?.role === 'responsable'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un employé..."
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}
        />
        {isAdmin && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true) }}
            style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Ajouter
          </button>
        )}
      </div>

      {/* Légende départements */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {DEPS.map(d => (
          <span key={d} style={{ fontSize: 11, padding: '3px 10px', background: '#f0efe8', borderRadius: 10, color: '#666' }}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </span>
        ))}
      </div>

      {/* Liste actifs */}
      {actifs.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Équipe active ({actifs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {actifs.map(emp => (
              <EmployeCard key={emp.id} emp={emp} isAdmin={isAdmin} onEdit={openEdit} onToggleActif={toggleActif} onCouleur={updateCouleur} moi={moi} />
            ))}
          </div>
        </>
      )}

      {/* Liste inactifs */}
      {inactifs.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Inactifs ({inactifs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: .6 }}>
            {inactifs.map(emp => (
              <EmployeCard key={emp.id} emp={emp} isAdmin={isAdmin} onEdit={openEdit} onToggleActif={toggleActif} onCouleur={updateCouleur} moi={moi} />
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
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 18 }}>
              {editId ? 'Modifier l\'employé' : 'Ajouter un employé'}
            </div>

            {/* Aperçu avatar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: form.couleur + '22', border: `3px solid ${form.couleur}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 500, color: form.couleur }}>
                {form.prenom ? (form.prenom[0] + (form.nom[0] || '')).toUpperCase() : '??'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['Prénom', 'prenom', 'Jean'], ['Nom', 'nom', 'Dupont']].map(([l, k, ph]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Département</label>
              <select value={form.departement} onChange={e => set('departement', e.target.value)} style={inp}>
                {DEPS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Rôle</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} style={inp}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>

            {/* Sélecteur de couleur */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Couleur sur le planning</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {PALETTE.map(c => (
                  <div key={c} onClick={() => set('couleur', c)} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    outline: form.couleur === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    transform: form.couleur === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform .15s'
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Ou personnalisé :</span>
                <input type="color" value={form.couleur} onChange={e => set('couleur', e.target.value)}
                  style={{ width: 32, height: 28, border: '0.5px solid #d0cfc8', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <span style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{form.couleur}</span>
              </div>
            </div>

            {!editId && (
              <div style={{ background: '#FAEEDA', color: '#633806', fontSize: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 16, lineHeight: 1.5 }}>
                💡 L'employé devra créer son compte avec son email depuis la page de connexion. Son profil sera lié automatiquement.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setEditId(null) }}
                style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>
                Annuler
              </button>
              <button onClick={save} disabled={saving}
                style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                {saving ? '...' : editId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeCard({ emp, isAdmin, onEdit, onToggleActif, onCouleur, moi }) {
  const [showPalette, setShowPalette] = useState(false)
  const couleur = emp.couleur || '#1E88E5'
  const initiales = emp.avatar_initiales || ((emp.prenom?.[0] || '') + (emp.nom?.[0] || '')).toUpperCase()
  const isSelf = emp.id === moi?.id

  return (
    <div style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar couleur */}
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: couleur + '22', border: `2.5px solid ${couleur}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: couleur, flexShrink: 0 }}>
          {initiales}
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#222', display: 'flex', alignItems: 'center', gap: 6 }}>
            {emp.prenom} {emp.nom}
            {isSelf && <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 8 }}>moi</span>}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {emp.departement} · {emp.role}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Bouton couleur rapide */}
          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowPalette(!showPalette)} title="Changer la couleur"
              style={{ width: 22, height: 22, borderRadius: '50%', background: couleur, cursor: 'pointer', border: '2px solid #fff', outline: '1px solid #ddd' }} />
            {showPalette && (
              <div style={{ position: 'absolute', right: 0, top: 28, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: 10, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,.1)', display: 'flex', flexWrap: 'wrap', gap: 6, width: 180 }}>
                {PALETTE.map(c => (
                  <div key={c} onClick={() => { onCouleur(emp.id, c); setShowPalette(false) }}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', outline: couleur === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <>
              <button onClick={() => onEdit(emp)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: 15, padding: '2px 4px' }}>✏️</button>
              <button onClick={() => onToggleActif(emp)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, padding: '2px 4px', color: emp.actif !== false ? '#3B6D11' : '#E24B4A' }}>
                {emp.actif !== false ? '✓' : '✕'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barre couleur en bas */}
      <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: couleur + '44', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '100%', background: couleur, borderRadius: 2, opacity: .7 }} />
      </div>
    </div>
  )
}

const lbl = { fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }
const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
