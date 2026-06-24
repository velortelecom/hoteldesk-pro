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

const DEPT_CATS = {
  menage: ['menage'],
  maintenance: ['maintenance'],
  reception: ['accueil'],
  restauration: ['admin'],
  direction: ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
}

const empty = { titre: '', description: '', categorie: 'menage', priorite: 'moyenne', statut: 'planifiee', date_echeance: '', chambre: '', assigne_a: '', recurrence_type: '', recurrence_fin: '', heure_debut: '', heure_fin: '' }

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

  const userRole = profile?.role || 'employe'
  const userDept = profile?.departement || ''
  const catsVisibles = userRole === 'admin' ? CATS : (DEPT_CATS[userDept] || [])

  useEffect(() => {
    fetchTaches()
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
      recurrence_fin: form.recurrence_fin || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
    }
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

  // Role-based filter
  const tachesFiltreesParRole = taches.filter(t => {
    if (userRole === 'admin') return true
    if (userRole === 'responsable') {
      return catsVisibles.includes(t.categorie) || t.assigne_a === profile?.id || t.cree_par === profile?.id
    }
    // employe: only own tasks
    return t.assigne_a === profile?.id
  })

  const FILTRES = ['Tout', ...CATS, 'haute', 'moyenne', 'basse', 'planifiee', 'en_cours', 'terminee']
  const filtrees = tachesFiltreesParRole.filter(t => {
    if (filtre === 'Tout') return true
    return t.categorie === filtre || t.priorite === filtre || t.statut === filtre
  })

  // Group by day
  const groupes = filtrees.reduce((acc, t) => {
    const key = getDayKey(t.date_echeance)
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  function openEdit(t) {
    setForm({
      titre: t.titre || '',
      description: t.description || '',
      categorie: t.categorie || 'menage',
      priorite: t.priorite || 'moyenne',
      statut: t.statut || 'planifiee',
      date_echeance: t.date_echeance ? t.date_echeance.slice(0, 16) : '',
      chambre: t.chambre || '',
      assigne_a: t.assigne_a || '',
      recurrence_type: t.recurrence_type || '',
      recurrence_fin: t.recurrence_fin || '',
      heure_debut: t.heure_debut || '',
      heure_fin: t.heure_fin || '',
    })
    setEditId(t.id)
    setShowModal(true)
  }

  const statsGlobales = {
    total: tachesFiltreesParRole.length,
    terminees: tachesFiltreesParRole.filter(t => t.statut === 'terminee').length,
    enCours: tachesFiltreesParRole.filter(t => t.statut === 'en_cours').length,
    urgentes: tachesFiltreesParRole.filter(t => t.priorite === 'haute' && t.statut !== 'terminee').length,
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[['Total', statsGlobales.total, '#185FA5'], ['Terminees', statsGlobales.terminees, '#3B6D11'], ['En cours', statsGlobales.enCours, '#854F0B'], ['Urgentes', statsGlobales.urgentes, '#A32D2D']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTRES.map(f => (
            <button key={f} onClick={() => setFiltre(f)}
              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid', borderColor: filtre === f ? '#185FA5' : '#d1d5db', background: filtre === f ? '#185FA5' : '#fff', color: filtre === f ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>
        {(userRole === 'admin' || userRole === 'responsable') && (
          <button onClick={() => { setForm(empty); setEditId(null); setShowModal(true) }}
            style={{ padding: '7px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Nouvelle tache
          </button>
        )}
      </div>

      {/* Task list */}
      {Object.entries(groupes).sort((a, b) => a[0].localeCompare(b[0])).map(([key, tasks]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'capitalize' }}>
            {getDayLabel(key === 'nodate' ? null : tasks[0]?.date_echeance)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map(t => {
              const col = STATUT_COLORS[t.statut]
              const pCol = PRIO_COLORS[t.priorite]
              return (
                <div key={t.id} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input type="checkbox" checked={t.statut === 'terminee'} onChange={() => toggleStatut(t)}
                    style={{ marginTop: 3, cursor: 'pointer', accentColor: '#185FA5' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: t.statut === 'terminee' ? '#aaa' : '#222', textDecoration: t.statut === 'terminee' ? 'line-through' : 'none' }}>{t.titre}</span>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: col.bg, color: col.text }}>{STATUT_LABELS[t.statut]}</span>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: pCol, display: 'inline-block' }} title={t.priorite} />
                      {t.recurrence_type && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 5, background: '#f0f0f0', color: '#555' }}>&#x1F501; {t.recurrence_type}</span>}
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {t.date_echeance && (
                        <span style={{ fontSize: 11, color: '#888' }}>
                          {format(parseISO(t.date_echeance), 'dd/MM/yyyy', { locale: fr })}
                          {t.heure_debut && <span style={{ color: '#185FA5', marginLeft: 4 }}>{t.heure_debut.slice(0,5)}{t.heure_fin ? ' - ' + t.heure_fin.slice(0,5) : ''}</span>}
                        </span>
                      )}
                      {t.assignee && <span style={{ fontSize: 11, color: '#888' }}>{t.assignee.prenom} {t.assignee.nom}</span>}
                      {t.chambre && <span style={{ fontSize: 11, color: '#888' }}>Ch. {t.chambre}</span>}
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5, background: '#f5f5f3', color: '#777' }}>{t.categorie}</span>
                    </div>
                  </div>
                  {(userRole === 'admin' || userRole === 'responsable') && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(t)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#555' }}>✏️</button>
                      <button onClick={() => deleteTache(t.id)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', color: '#ef4444' }}>🗑</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {filtrees.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '32px 0', fontSize: 14 }}>Aucune tache</div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editId ? 'Modifier' : 'Nouvelle tache'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Titre */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Titre *</label>
                <input value={form.titre} onChange={e => set('titre', e.target.value)} placeholder="Titre de la tache"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Details..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              {/* Categorie + Priorite */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Categorie</label>
                  <select value={form.categorie} onChange={e => set('categorie', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                    {catsVisibles.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Priorite</label>
                  <select value={form.priorite} onChange={e => set('priorite', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                    {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Statut */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Statut</label>
                <select value={form.statut} onChange={e => set('statut', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Date echeance */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Date d&apos;echeance</label>
                <input type="datetime-local" value={form.date_echeance} onChange={e => set('date_echeance', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              {/* Horaires */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Horaires (planning 24h)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Heure debut</label>
                    <input type="time" value={form.heure_debut} onChange={e => set('heure_debut', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Heure fin</label>
                    <input type="time" value={form.heure_fin} onChange={e => set('heure_fin', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* Chambre + Assigne */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Chambre</label>
                  <input value={form.chambre} onChange={e => set('chambre', e.target.value)} placeholder="Ex: 101"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Assigner a</label>
                  <select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                    <option value="">Non assigne</option>
                    {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                  </select>
                </div>
              </div>

              {/* Recurrence */}
              <div style={{ background: '#f9f9f7', borderRadius: 10, padding: '12px 14px', border: '1px solid #e8e7e0' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Recurrence (optionnel)</label>
                <select value={form.recurrence_type} onChange={e => set('recurrence_type', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, marginBottom: 8 }}>
                  <option value="">Pas de recurrence</option>
                  {RECURRENCES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                {form.recurrence_type && (
                  <div>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Date de fin</label>
                    <input type="date" value={form.recurrence_fin} onChange={e => set('recurrence_fin', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                    <div style={{ fontSize: 11, color: '#EF9F27', marginTop: 6 }}>Conseil : definissez une date de fin pour planifier sur toute l&apos;annee</div>
                  </div>
                )}
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Enregistrement...' : editId ? 'Modifier' : 'Creer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
