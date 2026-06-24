import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function toLocalISO(str) {
  if (!str) return null
  return new Date(str).toISOString()
}

const CATS = ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
const PRIOS = ['haute', 'moyenne', 'basse']
const STATUTS = ['planifiee', 'en_cours', 'terminee', 'annulee']
const RECURRENCES = ['quotidienne', 'hebdomadaire', 'mensuelle', 'annuelle']
const PRIO_COLORS = { haute: '#E24B4A', moyenne: '#EF9F27', basse: '#639922' }
const STATUT_LABELS = { planifiee: 'Planifiee', en_cours: 'En cours', terminee: 'Terminee', annulee: 'Annulee' }
const STATUT_COLORS = { planifiee: { bg: '#E6F1FB', text: '#0C447C' }, en_cours: { bg: '#FAEEDA', text: '#633806' }, terminee: { bg: '#EAF3DE', text: '#27500A' }, annulee: { bg: '#f0efe8', text: '#888' } }

// Mapping departement -> categories visibles
const DEPT_CATS = {
  menage: ['menage'],
  maintenance: ['maintenance'],
  reception: ['accueil'],
  restauration: ['admin'],
  direction: ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
}

const empty = { titre: '', description: '', categorie: 'menage', priorite: 'moyenne', statut: 'planifiee', date_echeance: '', chambre: '', assigne_a: '', recurrence_type: '', recurrence_fin: '' }

function getDayLabel(dateStr) {
  if (!dateStr) return 'Sans date'
  const d = parseISO(dateStr)
  if (isToday(d)) return "Aujourd'hui"
  if (isTomorrow(d)) return 'Demain'
  if (isYesterday(d)) return 'Hier'
  return format(d, 'EEEE dd MMMM yyyy', { locale: fr })
}

function getDayKey(dateStr) {
  if (!dateStr) return 'nodate'
  return dateStr.slice(0, 10)
}

export default function Taches() {
  const { profile } = useAuth()
  const [taches, setTaches] = useState([])
  const [employes, setEmployes] = useState([])
  const [filtre, setFiltre] = useState('Tout')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  // Determine which categories this user can see
  const userRole = profile?.role || 'employe'
  const userDept = profile?.departement || ''
  const catsVisibles = userRole === 'admin' ? CATS : (DEPT_CATS[userDept] || [])

  useEffect(() => {
    fetchTaches()
    // Employes: only show those from same dept for assignment (responsable/admin see all)
    const empQuery = supabase.from('profiles').select('id,nom,prenom,departement,role').eq('actif', true)
    if (userRole === 'employe') {
      empQuery.eq('departement', userDept)
    } else if (userRole === 'responsable') {
      empQuery.eq('departement', userDept)
    }
    empQuery.then(({ data }) => setEmployes(data || []))

    const sub = supabase.channel('taches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, fetchTaches)
      .subscribe()
    return () => sub.unsubscribe()
  }, [])

  async function fetchTaches() {
    let query = supabase.from('taches').select('*, assignee:profiles!taches_assigne_a_fkey(nom,prenom)').order('date_echeance', { ascending: true, nullsFirst: false })
    setTaches((await query).data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.titre.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      cree_par: profile.id,
      assigne_a: form.assigne_a || null,
      date_echeance: toLocalISO(form.date_echeance),
      recurrence_type: form.recurrence_type || null,
      recurrence_fin: form.recurrence_fin || null
    }
    // Remove empty recurrence fields
    if (!payload.recurrence_type) {
      delete payload.recurrence_fin
    }
    if (editId) await supabase.from('taches').update(payload).eq('id', editId)
    else await supabase.from('taches').insert(payload)
    await fetchTaches()
    setShowModal(false)
    setForm(empty)
    setEditId(null)
    setSaving(false)
  }

  async function toggleStatut(t) {
    const next = t.statut === 'terminee' ? 'planifiee' : 'terminee'
    await supabase.from('taches').update({ statut: next, date_terminee: next === 'terminee' ? new Date().toISOString() : null }).eq('id', t.id)
    fetchTaches()
  }

  async function deleteTache(id) {
    if (window.confirm('Supprimer ?')) {
      await supabase.from('taches').delete().eq('id', id)
      fetchTaches()
    }
  }

  function editTache(t) {
    setForm({ titre: t.titre, description: t.description || '', categorie: t.categorie, priorite: t.priorite, statut: t.statut, date_echeance: t.date_echeance ? t.date_echeance.slice(0, 16) : '', chambre: t.chambre || '', assigne_a: t.assigne_a || '', recurrence_type: t.recurrence_type || '', recurrence_fin: t.recurrence_fin || '' })
    setEditId(t.id)
    setShowModal(true)
  }

  function imprimer() {
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const win = window.open('', '_blank')
    const rows = filtrees.map(t => {
      const asn = t.assignee ? (t.assignee.prenom || '') + ' ' + (t.assignee.nom || '') : '-'
      const ech = t.date_echeance ? new Date(t.date_echeance).toLocaleDateString('fr-FR') : '-'
      const statut = STATUT_LABELS[t.statut] || t.statut
      const prio = t.priorite || '-'
      const ch = t.chambre ? ' Ch.' + t.chambre : ''
      const rec = t.recurrence_type ? ' [' + t.recurrence_type + ']' : ''
      return '<tr><td>' + t.titre + ch + rec + '</td><td>' + t.categorie + '</td><td>' + prio + '</td><td>' + statut + '</td><td>' + asn + '</td><td>' + ech + '</td></tr>'
    }).join('')
    win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:20px}h1{color:#185FA5;font-size:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}th{background:#185FA5;color:#fff}tr:nth-child(even){background:#f5f7fa}button{margin-top:16px;padding:8px 16px;background:#185FA5;color:#fff;border:none;border-radius:6px;cursor:pointer}</style></head><body>')
    win.document.write('<h1>Feuille de taches - HotelDesk Pro</h1>')
    win.document.write('<p style="font-size:12px;color:#666">' + dateStr + (filtre !== 'Tout' ? ' • Filtre: ' + filtre : '') + ' • ' + filtrees.length + ' tache(s)</p>')
    win.document.write('<table><thead><tr><th>Tache</th><th>Categorie</th><th>Priorite</th><th>Statut</th><th>Assigne</th><th>Echeance</th></tr></thead><tbody>' + rows + '</tbody></table>')
    win.document.write('<br><button onclick="window.print()">Imprimer / Enregistrer PDF</button>')
    win.document.write('</body></html>')
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  // Filter taches based on user role and department
  let tachesFiltreesParRole = taches
  if (userRole === 'employe') {
    // Employe sees only their own assigned tasks
    tachesFiltreesParRole = taches.filter(t => t.assigne_a === profile?.id)
  } else if (userRole === 'responsable') {
    // Responsable sees all tasks in their department categories
    tachesFiltreesParRole = taches.filter(t =>
      catsVisibles.includes(t.categorie) ||
      t.cree_par === profile?.id ||
      t.assigne_a === profile?.id
    )
  }
  // Admin sees all tasks (no filter)

  const filtrees = filtre === 'Tout' ? tachesFiltreesParRole : tachesFiltreesParRole.filter(t => t.categorie === filtre || t.priorite === filtre || t.statut === filtre)

  const grouped = filtrees.reduce((acc, t) => {
    const key = getDayKey(t.date_echeance)
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'nodate') return 1
    if (b === 'nodate') return -1
    return a.localeCompare(b)
  })

  // Categories visible for filter buttons
  const filtresCats = userRole === 'admin' ? CATS : catsVisibles

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', paddingBottom: 80 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center', background: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setFiltre('Tout')} style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: filtre === 'Tout' ? '#185FA5' : '#d1d5db', background: filtre === 'Tout' ? '#185FA5' : '#fff', color: filtre === 'Tout' ? '#fff' : '#333', fontSize: 13, cursor: 'pointer', fontWeight: filtre === 'Tout' ? 600 : 400 }}>Tout</button>
        {filtresCats.map(c => (
          <button key={c} onClick={() => setFiltre(c)} style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: filtre === c ? '#185FA5' : '#d1d5db', background: filtre === c ? '#185FA5' : '#fff', color: filtre === c ? '#fff' : '#333', fontSize: 13, cursor: 'pointer', fontWeight: filtre === c ? 600 : 400, textTransform: 'capitalize' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={imprimer} style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid #185FA5', background: '#fff', color: '#185FA5', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Imprimer / PDF</button>
          {userRole !== 'employe' && (
            <button onClick={() => { setForm(empty); setEditId(null); setShowModal(true) }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>+ Nouvelle tache</button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div style={{ padding: '16px' }}>
        {sortedKeys.length === 0 && <div style={{ textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 }}>Aucune tache</div>}
        {sortedKeys.map(key => (
          <div key={key}>
            <div style={{ color: '#185FA5', fontWeight: 700, fontSize: 14, marginBottom: 8, marginTop: 16, borderLeft: '3px solid #185FA5', paddingLeft: 8 }}>
              {key === 'nodate' ? 'Sans date' : getDayLabel(grouped[key][0].date_echeance)} ({grouped[key].length})
            </div>
            {grouped[key].map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: '0.5px solid #e0dfc4', opacity: t.statut === 'annulee' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input type="checkbox" checked={t.statut === 'terminee'} onChange={() => toggleStatut(t)} style={{ marginTop: 3, accentColor: '#185FA5', cursor: 'pointer', width: 16, height: 16 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, textDecoration: t.statut === 'terminee' ? 'line-through' : 'none', color: t.statut === 'terminee' ? '#999' : '#1a1a1a' }}>{t.titre}</span>
                      {t.chambre && <span style={{ fontSize: 12, color: '#185FA5', fontWeight: 600 }}>Ch.{t.chambre}</span>}
                      {t.recurrence_type && <span style={{ fontSize: 11, background: '#e8f4fd', color: '#185FA5', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>↺ {t.recurrence_type}</span>}
                      {t.assignee && <span style={{ fontSize: 11, color: '#666' }}>@{t.assignee.prenom} {t.assignee.nom}</span>}
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: STATUT_COLORS[t.statut]?.bg, color: STATUT_COLORS[t.statut]?.text, fontWeight: 600 }}>{STATUT_LABELS[t.statut]}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f5f5f5', color: PRIO_COLORS[t.priorite], fontWeight: 600 }}>{t.priorite}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0f0f0', color: '#555' }}>{t.categorie}</span>
                    </div>
                  </div>
                  {(userRole !== 'employe') && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => editTache(t)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteTache(t.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>X</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Modal form */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '92%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editId ? 'Modifier la tache' : 'Nouvelle tache'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}>x</button>
            </div>
            <input placeholder="Titre *" value={form.titre} onChange={e => set('titre', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
            <textarea placeholder="Description" value={form.description} onChange={e => set('description', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, minHeight: 70, boxSizing: 'border-box', resize: 'vertical' }} />
            <input placeholder="Chambre (ex: 301)" value={form.chambre} onChange={e => set('chambre', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select value={form.categorie} onChange={e => set('categorie', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                {(userRole === 'admin' ? CATS : catsVisibles).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <select value={form.priorite} onChange={e => set('priorite', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                {PRIOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <select value={form.statut} onChange={e => set('statut', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
              </select>
              <select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                <option value="">Non assigne</option>
                {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
              </select>
            </div>
            <input type="datetime-local" value={form.date_echeance} onChange={e => set('date_echeance', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
            {/* Recurrence section */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>Recurrence (optionnel)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select value={form.recurrence_type} onChange={e => set('recurrence_type', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                  <option value="">Pas de recurrence</option>
                  {RECURRENCES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                {form.recurrence_type && (
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Date de fin</div>
                    <input type="date" value={form.recurrence_fin} onChange={e => set('recurrence_fin', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>
              {form.recurrence_type && !form.recurrence_fin && (
                <div style={{ fontSize: 11, color: '#EF9F27', marginTop: 4 }}>Conseil: definissez une date de fin pour planifier sur toute l'annee</div>
              )}
            </div>
            <button onClick={save} disabled={saving} style={{ width: '100%', padding: 12, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Enregistrement...' : editId ? 'Mettre a jour' : 'Creer la tache'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
