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
const PRIO_COLORS = { haute: '#E24B4A', moyenne: '#EF9F27', basse: '#639922' }
const STATUT_LABELS = { planifiee: 'Planifiee', en_cours: 'En cours', terminee: 'Terminee', annulee: 'Annulee' }
const STATUT_COLORS = { planifiee: { bg: '#E6F1FB', text: '#0C447C' }, en_cours: { bg: '#FAEEDA', text: '#633806' }, terminee: { bg: '#EAF3DE', text: '#27500A' }, annulee: { bg: '#f0efe8', text: '#888' } }

const empty = { titre: '', description: '', categorie: 'menage', priorite: 'moyenne', statut: 'planifiee', date_echeance: '', chambre: '', assigne_a: '' }

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

  useEffect(() => {
    fetchTaches()
    supabase.from('profiles').select('id,nom,prenom,departement').then(({ data }) => setEmployes(data || []))
    const sub = supabase.channel('taches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, fetchTaches)
      .subscribe()
    return () => sub.unsubscribe()
  }, [])

  async function fetchTaches() {
    const { data } = await supabase.from('taches').select('*, assignee:profiles!taches_assigne_a_fkey(nom,prenom)').order('date_echeance', { ascending: true, nullsFirst: false })
    setTaches(data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.titre.trim()) return
    setSaving(true)
    const payload = { ...form, cree_par: profile.id, assigne_a: form.assigne_a || null, date_echeance: toLocalISO(form.date_echeance) }
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
    setForm({ titre: t.titre, description: t.description || '', categorie: t.categorie, priorite: t.priorite, statut: t.statut, date_echeance: t.date_echeance ? t.date_echeance.slice(0, 16) : '', chambre: t.chambre || '', assigne_a: t.assigne_a || '' })
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
      return '<tr><td>' + t.titre + ch + '</td><td>' + t.categorie + '</td><td>' + prio + '</td><td>' + statut + '</td><td>' + asn + '</td><td>' + ech + '</td></tr>'
    }).join('')
    win.document.write('<html><head><title>Taches - ' + dateStr + '</title><style>body{font-family:Arial,sans-serif;margin:20px;font-size:12px}h1{font-size:16px;margin-bottom:4px}p{color:#666;margin:0 0 12px}table{width:100%;border-collapse:collapse}th{background:#185FA5;color:#fff;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #eee}tr:nth-child(even){background:#f9f9f9}@media print{button{display:none}}</style></head><body>')
    win.document.write('<h1>Feuille de taches - HotelDesk Pro</h1>')
    win.document.write('<p>' + dateStr + (filtre !== 'Tout' ? ' — Filtre: ' + filtre : '') + ' — ' + filtrees.length + ' tache(s)</p>')
    win.document.write('<table><thead><tr><th>Tache</th><th>Categorie</th><th>Priorite</th><th>Statut</th><th>Assigne</th><th>Echeance</th></tr></thead><tbody>' + rows + '</tbody></table>')
    win.document.write('<br><button onclick="window.print()">Imprimer / Enregistrer PDF</button>')
    win.document.write('</body></html>')
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  const filtrees = filtre === 'Tout' ? taches : taches.filter(t => t.categorie === filtre || t.priorite === filtre || t.statut === filtre)

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {['Tout', ...CATS].map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{ padding: '5px 12px', border: '0.5px solid', borderColor: filtre === f ? '#185FA5' : '#d0cfc8', borderRadius: 20, fontSize: 12, cursor: 'pointer', background: filtre === f ? '#185FA5' : 'transparent', color: filtre === f ? '#fff' : '#666' }}>
              {f === 'Tout' ? 'Tout' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={imprimer} style={{ padding: '8px 14px', background: '#fff', color: '#185FA5', border: '1px solid #185FA5', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Imprimer / PDF
        </button>
        <button onClick={() => { setForm(empty); setEditId(null); setShowModal(true) }} style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Nouvelle tache</button>
      </div>

      {sortedKeys.map(key => (
        <div key={key} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', textTransform: 'capitalize', marginBottom: 6, paddingLeft: 4, borderLeft: '3px solid #185FA5', paddingLeft: 8 }}>
            {getDayLabel(key === 'nodate' ? null : grouped[key][0].date_echeance)}
            <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>({grouped[key].length})</span>
          </div>
          {grouped[key].map(t => {
            const sc = STATUT_COLORS[t.statut] || STATUT_COLORS.planifiee
            const asn = t.assignee ? (t.assignee.prenom || t.assignee.nom || '') : null
            return (
              <div key={t.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: '0.5px solid #e0dfc4', opacity: t.statut === 'annulee' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input type="checkbox" checked={t.statut === 'terminee'} onChange={() => toggleStatut(t)} style={{ marginTop: 3, accentColor: '#185FA5', cursor: 'pointer', width: 16, height: 16 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', textDecoration: t.statut === 'terminee' ? 'line-through' : 'none', color: t.statut === 'terminee' ? '#888' : '#1e293b' }}>
                      {t.titre}
                      {t.chambre && <span style={{ fontSize: 11, color: '#185FA5', marginLeft: 6, background: '#EFF6FF', borderRadius: 4, padding: '1px 5px' }}>Ch.{t.chambre}</span>}
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: sc.bg, color: sc.text, fontWeight: 600 }}>{STATUT_LABELS[t.statut]}</span>
                      <span style={{ fontSize: 11, color: PRIO_COLORS[t.priorite], fontWeight: 600 }}>{t.priorite}</span>
                      <span style={{ fontSize: 11, color: '#888', background: '#f1f5f9', padding: '2px 6px', borderRadius: 8 }}>{t.categorie}</span>
                      {asn && <span style={{ fontSize: 11, color: '#185FA5' }}>@{asn}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => editTache(t)} style={{ background: 'none', border: '0.5px solid #d0cfc8', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#555' }}>Edit</button>
                    <button onClick={() => deleteTache(t.id)} style={{ background: 'none', border: '0.5px solid #fca5a5', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#dc2626' }}>X</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {filtrees.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, paddingTop: 40 }}>Aucune tache</div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{editId ? 'Modifier' : 'Nouvelle tache'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>x</button>
            </div>
            <input placeholder="Titre *" value={form.titre} onChange={e => set('titre', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
            <textarea placeholder="Description" value={form.description} onChange={e => set('description', e.target.value)} rows={2} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box', resize: 'none' }} />
            <input placeholder="Chambre (ex: 301)" value={form.chambre} onChange={e => set('chambre', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select value={form.categorie} onChange={e => set('categorie', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                {CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <select value={form.priorite} onChange={e => set('priorite', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                {PRIOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <select value={form.statut} onChange={e => set('statut', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
              </select>
              <select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)} style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                <option value="">Non assigne</option>
                {employes.map(e => <option key={e.id} value={e.id}>{(e.prenom || '') + ' ' + (e.nom || '')}</option>)}
              </select>
            </div>
            <input type="datetime-local" value={form.date_echeance} onChange={e => set('date_echeance', e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <button onClick={save} disabled={saving} style={{ width: '100%', padding: 12, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Enregistrement...' : editId ? 'Mettre a jour' : 'Creer la tache'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
                                          }
