import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'

const PRIO_CFG = {
  urgente: { bg: '#FCEBEB', text: '#A32D2D', icon: '🚨' },
  normale:  { bg: '#FAEEDA', text: '#854F0B', icon: '🔔' },
  basse:    { bg: '#EAF3DE', text: '#3B6D11', icon: '📌' }
}

const empty = { titre: '', description: '', priorite: 'normale', date_rappel: '', assigne_a: '' }

export default function Rappels() {
  const { profile } = useAuth()
  const [rappels, setRappels] = useState([])
  const [employes, setEmployes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchRappels()
    supabase.from('profiles').select('id,nom,prenom').then(({ data }) => setEmployes(data || []))

    // Vérifier les rappels toutes les minutes
    const interval = setInterval(checkNotifications, 60000)
    requestNotifPermission()
    return () => clearInterval(interval)
  }, [])

  async function fetchRappels() {
    const { data } = await supabase.from('rappels')
      .select('*, assignee:profiles!rappels_assigne_a_fkey(nom,prenom), createur:profiles!rappels_cree_par_fkey(nom,prenom)')
      .or(`cree_par.eq.${profile.id},assigne_a.eq.${profile.id}`)
      .order('date_rappel', { ascending: true })
    setRappels(data || [])
  }

  async function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  async function checkNotifications() {
    const now = new Date()
    const { data } = await supabase.from('rappels')
      .select('*')
      .eq('notifie', false)
      .lte('date_rappel', now.toISOString())
      .or(`cree_par.eq.${profile.id},assigne_a.eq.${profile.id}`)
    if (!data?.length) return
    data.forEach(r => {
      if (Notification.permission === 'granted') {
        new Notification('🏨 HôtelDesk — ' + r.titre, { body: r.description || '', icon: '/logo192.png' })
      }
      supabase.from('rappels').update({ notifie: true }).eq('id', r.id)
    })
    fetchRappels()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.titre.trim() || !form.date_rappel) return
    setSaving(true)
    await supabase.from('rappels').insert({ ...form, cree_par: profile.id, assigne_a: form.assigne_a || null })
    await fetchRappels()
    setShowModal(false)
    setForm(empty)
    setSaving(false)
  }

  async function deleteRappel(id) {
    await supabase.from('rappels').delete().eq('id', id)
    fetchRappels()
  }

  function timeLabel(d) {
    const date = new Date(d)
    if (isPast(date)) return { label: 'Expiré', color: '#E24B4A' }
    if (isToday(date)) return { label: `Aujourd'hui ${format(date, 'HH:mm')}`, color: '#854F0B' }
    if (isTomorrow(date)) return { label: `Demain ${format(date, 'HH:mm')}`, color: '#3B6D11' }
    return { label: format(date, 'dd MMM à HH:mm', { locale: fr }), color: '#666' }
  }

  const passes = rappels.filter(r => isPast(new Date(r.date_rappel)))
  const aVenir = rappels.filter(r => !isPast(new Date(r.date_rappel)))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: '#888' }}>{aVenir.length} rappel(s) à venir · {passes.length} expiré(s)</span>
        </div>
        <button onClick={() => { setForm(empty); setShowModal(true) }} style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          + Nouveau rappel
        </button>
      </div>

      {aVenir.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>À venir</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {aVenir.map(r => <RappelCard key={r.id} r={r} timeLabel={timeLabel} onDelete={deleteRappel} />)}
          </div>
        </>
      )}

      {passes.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Expirés</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: .65 }}>
            {passes.map(r => <RappelCard key={r.id} r={r} timeLabel={timeLabel} onDelete={deleteRappel} />)}
          </div>
        </>
      )}

      {rappels.length === 0 && <div style={{ textAlign: 'center', color: '#bbb', padding: 60, fontSize: 14 }}>Aucun rappel. Créez-en un !</div>}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 18 }}>Nouveau rappel</div>
            {[['Titre', 'titre', 'Ex: Vérifier check-out 204'], ['Description', 'description', 'Détails...']].map(([l, k, ph]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Date et heure du rappel</label>
              <input type="datetime-local" value={form.date_rappel} onChange={e => set('date_rappel', e.target.value)} required style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Priorité</label>
              <select value={form.priorite} onChange={e => set('priorite', e.target.value)} style={inp}>
                <option value="urgente">Urgente</option>
                <option value="normale">Normale</option>
                <option value="basse">Basse</option>
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Assigner à (optionnel)</label>
              <select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)} style={inp}>
                <option value="">— Moi-même —</option>
                {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                {saving ? '...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RappelCard({ r, timeLabel, onDelete }) {
  const cfg = PRIO_CFG[r.priorite] || PRIO_CFG.normale
  const tl = timeLabel(r.date_rappel)
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cfg.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#222' }}>{r.titre}</div>
        {r.description && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.description}</div>}
        {r.assignee && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>👤 {r.assignee.prenom} {r.assignee.nom}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: tl.color }}>{tl.label}</div>
        <button onClick={() => onDelete(r.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ddd', fontSize: 14, marginTop: 4 }}>✕</button>
      </div>
    </div>
  )
}

const inp = { width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
