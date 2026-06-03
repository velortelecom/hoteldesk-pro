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
const STATUT_LABELS = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }
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
        if (window.confirm('Supprimer cette tâche ?')) {
                await supabase.from('taches').delete().eq('id', id)
                fetchTaches()
        }
  }

  function editTache(t) {
        setForm({ titre: t.titre, description: t.description || '', categorie: t.categorie, priorite: t.priorite, statut: t.statut, date_echeance: t.date_echeance ? t.date_echeance.slice(0, 16) : '', chambre: t.chambre || '', assigne_a: t.assigne_a || '' })
        setEditId(t.id)
        setShowModal(true)
  }

  const filtrees = filtre === 'Tout' ? taches : taches.filter(t => t.categorie === filtre || t.priorite === filtre || t.statut === filtre)

  // Grouper les taches par jour
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
                      </button>button>
                    ))}
                      </div>div>
                      <button onClick={() => { setForm(empty); setEditId(null); setShowModal(true) }} style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                + Nouvelle tâche
                      </button>button>
              </div>div>
        
          {filtrees.length === 0 && <div style={{ textAlign: 'center', color: '#aaa', padding: 40, fontSize: 14 }}>Aucune tâche pour ce filtre</div>div>}
        
          {sortedKeys.map(key => {
                  const dayTaches = grouped[key]
                            const label = key === 'nodate' ? 'Sans date' : getDayLabel(dayTaches[0].date_echeance)
                                      const allDone = dayTaches.every(t => t.statut === 'terminee')
                                                return (
                                                            <div key={key} style={{ marginBottom: 20 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                                      <span style={{ fontSize: 13, fontWeight: 600, color: allDone ? '#aaa' : '#185FA5', textTransform: 'capitalize', textDecoration: allDone ? 'line-through' : 'none' }}>{label}</span>span>
                                                                                      <span style={{ fontSize: 11, color: '#aaa', background: '#f0efe8', borderRadius: 10, padding: '1px 7px' }}>{dayTaches.filter(t => t.statut === 'terminee').length}/{dayTaches.length}</span>span>
                                                                                      <div style={{ flex: 1, height: 1, background: '#e0dfd8' }}></div>div>
                                                                        </div>div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                          {dayTaches.map(t => (
                                                                              <div key={t.id} style={{ background: t.statut === 'terminee' ? '#f8f8f6' : '#fff', border: '0.5px solid', borderColor: t.statut === 'terminee' ? '#e8e8e0' : '#e0dfd8', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: t.statut === 'terminee' ? 0.7 : 1 }}>
                                                                                                <div onClick={() => toggleStatut(t)} style={{ width: 22, height: 22, borderRadius: '50%', border: t.statut === 'terminee' ? 'none' : '1.5px solid #d0cfc8', background: t.statut === 'terminee' ? '#1D9E75' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                                                                  {t.statut === 'terminee' && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>span>}
                                                                                                  </div>div>
                                                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                                    <div style={{ fontSize: 14, fontWeight: 500, color: t.statut === 'terminee' ? '#aaa' : '#222', textDecoration: t.statut === 'terminee' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titre}</div>div>
                                                                                                                    <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                                                                                      {t.date_echeance && <span>🕐 {format(new Date(t.date_echeance), 'HH:mm', { locale: fr })}</span>span>}
                                                                                                                      {t.assignee && <span>👤 {t.assignee.prenom}</span>span>}
                                                                                                                      {t.chambre && <span>🏠 Ch. {t.chambre}</span>span>}
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                                                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_COLORS[t.priorite] }}></div>div>
                                                                                                                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: STATUT_COLORS[t.statut]?.bg, color: STATUT_COLORS[t.statut]?.text }}>{STATUT_LABELS[t.statut]}</span>span>
                                                                                                                    <button onClick={() => editTache(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: 14, padding: '2px 4px' }}>✏️</button>button>
                                                                                                                    <button onClick={() => deleteTache(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 14, padding: '2px 4px' }}>🗑</button>button>
                                                                                                  </div>div>
                                                                              </div>div>
                                                                            ))}
                                                                        </div>div>
                                                            </div>div>
                                                          )
          })}
        
          {showModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
                            <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
                                        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 18 }}>{editId ? 'Modifier la tâche' : 'Nouvelle tâche'}</div>div>
                              {[['Titre', 'titre', 'text', 'Ex: Nettoyage chambre 208'],['Description', 'description', 'text', 'Détails...'],['Chambre', 'chambre', 'text', 'Ex: 208']].map(([l, k, type, ph]) => (
                                  <div key={k} style={{ marginBottom: 12 }}>
                                                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>label>
                                                  <input type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
                                  </div>div>
                                ))}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                          {[['Catégorie', 'categorie', CATS], ['Priorité', 'priorite', PRIOS], ['Statut', 'statut', STATUTS]].map(([l, k, opts]) => (
                                    <div key={k}>
                                                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>label>
                                                      <select value={form[k]} onChange={e => set(k, e.target.value)} style={inp}>
                                                        {opts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>option>)}
                                                      </select>select>
                                    </div>div>
                                  ))}
                                                      <div>
                                                                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Date/heure</label>label>
                                                                      <input type="datetime-local" value={form.date_echeance} onChange={e => set('date_echeance', e.target.value)} style={inp} />
                                                      </div>div>
                                        </div>div>
                                        <div style={{ marginBottom: 16 }}>
                                                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Assigner à</label>label>
                                                      <select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)} style={inp}>
                                                                      <option value="">— Non assigné —</option>option>
                                                        {employes.map(e => <option key={e.id} value={e.id}>{e.prenom}</option>option>)}
                                                      </select>select>
                                        </div>div>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                      <button onClick={() => { setShowModal(false); setForm(empty); setEditId(null) }} style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>button>
                                                      <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                                                        {saving ? '...' : editId ? 'Modifier' : 'Créer'}
                                                      </button>button>
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        </div>div>
      )
}

const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }</div>
