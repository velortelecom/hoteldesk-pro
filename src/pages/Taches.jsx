import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const CATS = ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
const PRIOS = ['haute', 'moyenne', 'basse']
const STATUTS = ['planifiee', 'en_cours', 'terminee', 'annulee']
const PRIO_COLORS = { haute: '#E24B4A', moyenne: '#EF9F27', basse: '#639922' }
const STATUT_LABELS = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }
const STATUT_COLORS = { planifiee: { bg: '#E6F1FB', text: '#0C447C' }, en_cours: { bg: '#FAEEDA', text: '#633806' }, terminee: { bg: '#EAF3DE', text: '#27500A' }, annulee: { bg: '#f0efe8', text: '#888' } }

const empty = { titre: '', description: '', categorie: 'menage', priorite: 'moyenne', statut: 'planifiee', date_echeance: '', chambre: '', assigne_a: '' }

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
    const { data } = await supabase.from('taches').select('*, assignee:profiles!taches_assigne_a_fkey(nom,prenom)').order('created_at', { ascending: false })
    setTaches(data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.titre.trim()) return
    setSaving(true)
    const payload = { ...form, cree_par: profile.id, assigne_a: form.assigne_a || null, date_echeance: form.date_echeance || null }
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
        <button onClick={() => { setForm(empty); setEditId(null); setShowModal(true) }} style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Nouvelle tâche
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtrees.length === 0 && <div style={{ textAlign: 'center', color: '#aaa', padding: 40, fontSize: 14 }}>Aucune tâche pour ce filtre</div>}
        {filtrees.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div onClick={() => toggleStatut(t)} style={{ width: 22, height: 22, borderRadius: '50%', border: t.statut === 'terminee' ? 'none' : '1.5px solid #d0cfc8', background: t.statut === 'terminee' ? '#1D9E75' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              {t.statut === 'terminee' && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.statut === 'terminee' ? '#aaa' : '#222', textDecoration: t.statut === 'terminee' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titre}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {t.date_echeance && <span>📅 {format(new Date(t.date_echeance), 'dd MMM à HH:mm', { locale: fr })}</span>}
                {t.assignee && <span>👤 {t.assignee.prenom} {t.assignee.nom}</span>}
                {t.chambre && <span>🏠 Ch. {t.chambre}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_COLORS[t.priorite] }}></div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: STATUT_COLORS[t.statut]?.bg, color: STATUT_COLORS[t.statut]?.text }}>{STATUT_LABELS[t.statut]}</span>
              <button onClick={() => editTache(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: 14, padding: '2px 4px' }}>✏️</button>
              <button onClick={() => deleteTache(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 14, padding: '2px 4px' }}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 18 }}>{editId ? 'Modifier la tâche' : 'Nouvelle tâche'}</div>
            {[['Titre', 'titre', 'text', 'Ex: Nettoyage chambre 208'],['Description', 'description', 'text', 'Détails...'],['Chambre', 'chambre', 'text', 'Ex: 208']].map(([l, k, type, ph]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>
                <input type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['Catégorie', 'categorie', CATS], ['Priorité', 'priorite', PRIOS], ['Statut', 'statut', STATUTS]].map(([l, k, opts]) => (
                <div key={k}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>
                  <select value={form[k]} onChange={e => set(k, e.target.value)} style={inp}>
                    {opts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Date/heure</label>
                <input type="datetime-local" value={form.date_echeance} onChange={e => set('date_echeance', e.target.value)} style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Assigner à</label>
              <select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)} style={inp}>
                <option value="">— Non assigné —</option>
                {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.departement})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setForm(empty); setEditId(null) }} style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                {saving ? '...' : editId ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
