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
const STATUT_LABELS = { planifiee: 'Planifiee', en_cours: 'En cours', terminee: 'Terminee', annulee: 'Ann.' }
const STATUT_COLORS = { planifiee: '#3B82F6', en_cours: '#F59E0B', terminee: '#10B981', annulee: '#6B7280' }
const DEPT_CATS = {
  menage: ['menage'],
  maintenance: ['maintenance'],
  accueil: ['accueil', 'admin'],
  admin: ['admin'],
  direction: ['menage', 'maintenance', 'accueil', 'admin', 'urgence'],
}

function TacheRow({ tache, enfants, profile, membres, expandedParents, setExpandedParents, onEdit, onDelete, onStatutChange }) {
  const isParent = tache.recurrence_type && !tache.tache_parente_id
  const hasEnfants = isParent && enfants && enfants.length > 0
  const isExpanded = expandedParents[tache.id]

  const toggleExpand = (e) => {
    e.stopPropagation()
    setExpandedParents(prev => ({ ...prev, [tache.id]: !prev[tache.id] }))
  }

  const renderRow = (t, isChild) => (
    <div key={t.id} style={{
      background: isChild ? '#f8fafc' : 'white',
      borderLeft: isChild ? '3px solid #3B82F6' : 'none',
      marginLeft: isChild ? 20 : 0,
      border: isChild ? '1px solid #e2e8f0' : '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{t.titre}</span>
        {isParent && !isChild && (
          <span style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
            Recurrence: {t.recurrence_type}
          </span>
        )}
        <span style={{ background: PRIO_COLORS[t.priorite] + '22', color: PRIO_COLORS[t.priorite], borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {t.priorite}
        </span>
        <span style={{ background: STATUT_COLORS[t.statut] + '22', color: STATUT_COLORS[t.statut], borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {STATUT_LABELS[t.statut]}
        </span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{t.categorie}</span>
        {t.date_echeance && (
          <span style={{ fontSize: 12, color: isToday(parseISO(t.date_echeance)) ? '#EF4444' : '#6B7280' }}>
            {format(parseISO(t.date_echeance), 'dd MMM', { locale: fr })}
          </span>
        )}
        {t.heure_debut && <span style={{ fontSize: 11, color: '#8B5CF6' }}>{t.heure_debut.slice(0,5)}</span>}
        {t.heure_fin && <span style={{ fontSize: 11, color: '#8B5CF6' }}>fin: {t.heure_fin.slice(0,5)}</span>}
        {(profile?.role === 'admin' || profile?.role === 'responsable' || t.assigne_a === profile?.id) && (
          <select
            value={t.statut}
            onChange={e => onStatutChange(t.id, e.target.value)}
            style={{ fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', padding: '2px 4px' }}
            onClick={e => e.stopPropagation()}
          >
            {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </select>
        )}
        {(profile?.role === 'admin' || profile?.role === 'responsable') && (
          <>
            <button onClick={() => onEdit(t)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Edit</button>
            <button onClick={() => onDelete(t.id, isParent)} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Sup</button>
          </>
        )}
      </div>
      {t.description && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{t.description}</div>}
      {t.assigne_a && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
          Assigne: {membres.find(m => m.id === t.assigne_a)?.prenom || 'Inconnu'}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ position: 'relative' }}>
        {renderRow(tache, false)}
        {hasEnfants && (
          <button
            onClick={toggleExpand}
            style={{
              position: 'absolute', right: 60, top: 10,
              background: isExpanded ? '#DBEAFE' : '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 10,
              padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#1D4ED8',
            }}
          >
            {isExpanded ? 'Reduire' : enfants.length + ' occurrences'}
          </button>
        )}
      </div>
      {hasEnfants && isExpanded && (
        <div style={{ marginTop: 2 }}>
          {enfants.map(enf => renderRow(enf, true))}
        </div>
      )}
    </div>
  )
}

export default function Taches() {
  const { profile } = useAuth()
  const [taches, setTaches] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTache, setEditTache] = useState(null)
  const [expandedParents, setExpandedParents] = useState({})
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [filtreCat, setFiltreCat] = useState('toutes')
  const [filtrePrio, setFiltrePrio] = useState('toutes')
  const [form, setForm] = useState({
    titre: '', description: '', categorie: 'menage', priorite: 'moyenne',
    statut: 'planifiee', date_echeance: '', heure_debut: '', heure_fin: '',
    assigne_a: '', recurrence_type: '', recurrence_fin: '', chambre: '',
  })

  useEffect(() => { fetchTaches(); fetchMembres() }, [profile])

  async function fetchMembres() {
    const { data } = await supabase.from('profiles').select('id, prenom, nom, role, departement')
    if (data) setMembres(data)
  }

  async function fetchTaches() {
    setLoading(true)
    let query = supabase.from('taches').select('*').order('date_echeance', { ascending: true })
    if (profile?.role === 'employe') {
      const allowedCats = DEPT_CATS[profile.departement] || []
      if (allowedCats.length) query = query.in('categorie', allowedCats)
      else query = query.eq('assigne_a', profile.id)
    }
    const { data } = await query
    if (data) setTaches(data)
    setLoading(false)
  }

  const parents = taches.filter(t => !t.tache_parente_id)
  const enfantsMap = {}
  taches.filter(t => t.tache_parente_id).forEach(t => {
    if (!enfantsMap[t.tache_parente_id]) enfantsMap[t.tache_parente_id] = []
    enfantsMap[t.tache_parente_id].push(t)
  })

  const filtered = parents.filter(t => {
    if (filtreStatut !== 'tous' && t.statut !== filtreStatut) return false
    if (filtreCat !== 'toutes' && t.categorie !== filtreCat) return false
    if (filtrePrio !== 'toutes' && t.priorite !== filtrePrio) return false
    return true
  })

  function openCreate() {
    setEditTache(null)
    setForm({ titre: '', description: '', categorie: 'menage', priorite: 'moyenne', statut: 'planifiee', date_echeance: '', heure_debut: '', heure_fin: '', assigne_a: '', recurrence_type: '', recurrence_fin: '', chambre: '' })
    setShowForm(true)
  }

  function openEdit(t) {
    setEditTache(t)
    setForm({
      titre: t.titre || '', description: t.description || '', categorie: t.categorie || 'menage',
      priorite: t.priorite || 'moyenne', statut: t.statut || 'planifiee',
      date_echeance: t.date_echeance ? t.date_echeance.slice(0, 10) : '',
      heure_debut: t.heure_debut ? t.heure_debut.slice(0, 5) : '',
      heure_fin: t.heure_fin ? t.heure_fin.slice(0, 5) : '',
      assigne_a: t.assigne_a || '', recurrence_type: t.recurrence_type || '',
      recurrence_fin: t.recurrence_fin ? t.recurrence_fin.slice(0, 10) : '',
      chambre: t.chambre || '',
    })
    setShowForm(true)
  }

  async function handleDelete(id, isParent) {
    const msg = isParent
      ? 'Supprimer cette tache recurrente et toutes ses occurrences ?'
      : 'Supprimer cette tache ?'
    if (!window.confirm(msg)) return
    if (isParent) {
      await supabase.from('taches').delete().eq('tache_parente_id', id)
    }
    await supabase.from('taches').delete().eq('id', id)
    fetchTaches()
  }

  async function handleStatutChange(id, statut) {
    await supabase.from('taches').update({ statut }).eq('id', id)
    fetchTaches()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      titre: form.titre,
      description: form.description || null,
      categorie: form.categorie,
      priorite: form.priorite,
      statut: form.statut,
      date_echeance: form.date_echeance || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      assigne_a: form.assigne_a || null,
      recurrence_type: form.recurrence_type || null,
      recurrence_fin: form.recurrence_fin || null,
      chambre: form.chambre || null,
    }
    if (editTache) {
      await supabase.from('taches').update(payload).eq('id', editTache.id)
    } else {
      await supabase.from('taches').insert({ ...payload, cree_par: profile.id })
    }
    setShowForm(false)
    fetchTaches()
  }

  const canManage = profile?.role === 'admin' || profile?.role === 'responsable'

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Chargement...</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1F2937' }}>Taches</h1>
        {canManage && (
          <button onClick={openCreate} style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>
            + Nouvelle tache
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 10px' }}>
          <option value='tous'>Tous statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </select>
        <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)} style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 10px' }}>
          <option value='toutes'>Toutes categories</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtrePrio} onChange={e => setFiltrePrio(e.target.value)} style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 10px' }}>
          <option value='toutes'>Toutes priorites</option>
          {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>Aucune tache trouvee.</div>
      ) : (
        <div>
          {filtered.map(t => (
            <TacheRow
              key={t.id}
              tache={t}
              enfants={enfantsMap[t.id] || []}
              profile={profile}
              membres={membres}
              expandedParents={expandedParents}
              setExpandedParents={setExpandedParents}
              onEdit={openEdit}
              onDelete={handleDelete}
              onStatutChange={handleStatutChange}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 12, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>{editTache ? 'Modifier la tache' : 'Nouvelle tache'}</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre</label>
              <input required value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Categorie</label>
                <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Priorite</label>
                <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Chambre</label>
                <input value={form.chambre} onChange={e => setForm(f => ({ ...f, chambre: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date echeance</label>
                <input type='date' value={form.date_echeance} onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Heure debut</label>
                <input type='time' value={form.heure_debut} onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Heure fin</label>
                <input type='time' value={form.heure_fin} onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Recurrence</label>
                <select value={form.recurrence_type} onChange={e => setForm(f => ({ ...f, recurrence_type: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  <option value=''>Aucune</option>
                  {RECURRENCES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.recurrence_type && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fin recurrence</label>
                  <input type='date' value={form.recurrence_fin} onChange={e => setForm(f => ({ ...f, recurrence_fin: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Assigner a</label>
              <select value={form.assigne_a} onChange={e => setForm(f => ({ ...f, assigne_a: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                <option value=''>Non assigne</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom} ({m.role})</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type='button' onClick={() => setShowForm(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
              <button type='submit' style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>
                {editTache ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
      }
