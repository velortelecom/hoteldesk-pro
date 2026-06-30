import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isToday, isSameMonth, isSameDay,
  parseISO, setHours, setMinutes
} from 'date-fns'
import { fr } from 'date-fns/locale'

const CAT_COLORS = {
  menage: { bg: '#EAF3DE', text: '#27500A', border: '#7fb83a' },
  maintenance: { bg: '#FCEBEB', text: '#791F1F', border: '#e24b4a' },
  accueil: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  admin: { bg: '#E6F1FB', text: '#0C447C', border: '#185FA5' },
  urgence: { bg: '#F5E6FB', text: '#5B0B7C', border: '#9b59b6' }
}

const DEPT_CATS_PLANNING = {
  menage: ['menage'],
  maintenance: ['maintenance'],
  reception: ['accueil'],
  restauration: ['admin'],
  direction: ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
}

const HEURES_24 = Array.from({ length: 24 }, (_, i) => i) // 0..23

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Planning() {
  const { profile } = useAuth()
  const now = useNow()
  const [taches, setTaches] = useState([])
  const [employes, setEmployes] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [quickCreateDate, setQuickCreateDate] = useState(null)
  const [quickForm, setQuickForm] = useState({ titre: '', categorie: 'menage', priorite: 'normale' })
  const [quickSaving, setQuickSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [vue, setVue] = useState('mois') // 'mois' | 'jour'
  const [filtreEmp, setFiltreEmp] = useState('tous')
  const timelineRef = useRef(null)

  const userRole = profile?.role || 'employe'
  const userDept = profile?.departement || ''
  const catsVisibles = userRole === 'admin' ? null : (DEPT_CATS_PLANNING[userDept] || [])

  // Load employes
  useEffect(() => {
    const q = supabase.from('profiles').select('id,nom,prenom,couleur,avatar_initiales,departement').eq('actif', true)
    if (userRole === 'responsable') q.eq('departement', userDept)
    else if (userRole === 'employe') q.eq('id', profile?.id)
    q.then(({ data }) => setEmployes(data || []))
  }, [])

  // Load tasks for current month
  useEffect(() => {
    const from = startOfMonth(currentMonth).toISOString()
    const to = endOfMonth(currentMonth).toISOString()
    supabase.from('taches')
      .select('*, assignee:profiles!taches_assigne_a_fkey(id,nom,prenom,couleur,avatar_initiales)')
      .gte('date_echeance', from)
      .lte('date_echeance', to)
      .neq('statut', 'annulee')
      .then(({ data }) => setTaches(data || []))
  }, [currentMonth])

  // Scroll timeline to current hour on day view
  useEffect(() => {
    if (vue === 'jour' && timelineRef.current) {
      const h = now.getHours()
      const rowH = 56
      timelineRef.current.scrollTop = Math.max(0, h * rowH - 120)
    }
  }, [vue, selectedDay])

  function filterTask(t) {
    if (userRole === 'employe') return t.assigne_a === profile?.id
    if (userRole === 'responsable') {
      return (catsVisibles && catsVisibles.includes(t.categorie)) ||
             t.assigne_a === profile?.id || t.cree_par === profile?.id
    }
    return true // admin sees all
  }

  function getTasksForDay(day) {
    return taches.filter(t => {
      if (!t.date_echeance) return false
      if (!filterTask(t)) return false
      if (filtreEmp !== 'tous' && t.assignee?.id !== filtreEmp) return false
      return isSameDay(parseISO(t.date_echeance), day)
    })
  }

  function getTasksForHour(day, hour) {
    return taches.filter(t => {
      if (!t.date_echeance) return false
      if (!filterTask(t)) return false
      if (filtreEmp !== 'tous' && t.assignee?.id !== filtreEmp) return false
      if (!isSameDay(parseISO(t.date_echeance), day)) return false
      // Use heure_debut if available, else fallback to date_echeance hour
      if (t.heure_debut) {
        const [hh] = t.heure_debut.split(':').map(Number)
        return hh === hour
      }
      return parseISO(t.date_echeance).getHours() === hour
    })
  }

  // Stats for month
  const monthTasks = taches.filter(filterTask)
  const stats = {
    total: monthTasks.length,
    terminees: monthTasks.filter(t => t.statut === 'terminee').length,
    urgentes: monthTasks.filter(t => t.priorite === 'haute' && t.statut !== 'terminee').length,
    enCours: monthTasks.filter(t => t.statut === 'en_cours').length,
  }

  // ---- MONTH CALENDAR ----
  function renderMonthCalendar() {
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 })
    const days = []
    let d = calStart
    while (d <= calEnd) { days.push(d); d = addDays(d, 1) }
    const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

    return (
      <div>
        {/* Month header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8592;</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5', textTransform: 'capitalize' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              Aujourd&apos;hui : {format(now, "EEEE d MMMM yyyy", { locale: fr })} &bull; {format(now, 'HH:mm')}
            </div>
          </div>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8594;</button>
        </div>
        {/* Today button */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
            style={{ padding: '4px 14px', borderRadius: 8, border: '1px solid #185FA5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#185FA5' }}>
            Aujourd&apos;hui
          </button>
        </div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {weekDays.map(wd => (
            <div key={wd} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888', padding: '4px 0' }}>{wd}</div>
          ))}
        </div>
        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((day, i) => {
            const dayTasks = getTasksForDay(day)
            const isSelected = isSameDay(day, selectedDay)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDay = isToday(day)
            return (
              <div key={i}
                onClick={() => { setSelectedDay(day); setVue('jour') }}
                style={{
                  minHeight: 72, border: isSelected ? '2px solid #185FA5' : isTodayDay ? '2px solid #EF9F27' : '1px solid #e0dfd8',
                  borderRadius: 8, padding: '4px 6px', cursor: 'pointer', background: isSelected ? '#EEF5FF' : isTodayDay ? '#FFF8EE' : '#fff',
                  opacity: isCurrentMonth ? 1 : 0.4, transition: 'all 0.1s'
                }}>
                <div style={{ fontSize: 12, fontWeight: isTodayDay ? 700 : 500, color: isTodayDay ? '#EF9F27' : '#333', marginBottom: 2 }}>
                  {format(day, 'd')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {dayTasks.slice(0, 3).map(t => {
                    const col = CAT_COLORS[t.categorie] || CAT_COLORS.admin
                    return (
                      <div key={t.id} style={{
                        background: col.bg, color: col.text, borderLeft: '2px solid ' + col.border,
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {t.heure_debut ? t.heure_debut.slice(0,5) + ' ' : ''}{t.titre}
                      </div>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: 10, color: '#888' }}>+{dayTasks.length - 3} autres</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- 24H DAY TIMELINE ----
  function renderDayTimeline() {
    const currentHour = isToday(selectedDay) ? now.getHours() : -1
    const currentMinute = now.getMinutes()

    return (
      <div>
        {/* Day header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setSelectedDay(d => addDays(d, -1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8592;</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5', textTransform: 'capitalize' }}>
              {format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {isToday(selectedDay) ? `Heure actuelle : ${format(now, 'HH:mm')}` : format(selectedDay, 'MMMM yyyy', { locale: fr })}
            </div>
          </div>
          <button onClick={() => setSelectedDay(d => addDays(d, 1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8594;</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setSelectedDay(new Date()); setCurrentMonth(new Date()) }}
            style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #185FA5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#185FA5' }}>
            Aujourd&apos;hui
          </button>
          <button onClick={() => setVue('mois')}
            style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#333' }}>
            &#128197; Vue mois
          </button>
        </div>
        {/* Timeline 24h */}
        <div ref={timelineRef} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', minHeight: 400, position: 'relative', borderRadius: 10, border: '1px solid #e0dfd8' }}>
          {HEURES_24.map(h => {
            const tasks = getTasksForHour(selectedDay, h)
            const isCurrentHourRow = h === currentHour
            return (
              <div key={h} style={{
                display: 'flex', minHeight: 56, borderBottom: '1px solid #f0efe8',
                background: isCurrentHourRow ? '#FFFBF0' : h % 2 === 0 ? '#fff' : '#fafaf8',
                position: 'relative'
              }}>
                {/* Hour label */}
                <div style={{
                  width: 52, minWidth: 52, padding: '4px 8px 0', fontSize: 12, fontWeight: isCurrentHourRow ? 700 : 400,
                  color: isCurrentHourRow ? '#EF9F27' : '#aaa', borderRight: '1px solid #e0dfd8',
                  background: isCurrentHourRow ? '#FFF8EE' : 'transparent'
                }}>
                  {String(h).padStart(2,'0')}:00
                </div>
                {/* Current time indicator */}
                {isCurrentHourRow && (
                  <div style={{
                    position: 'absolute', left: 52, right: 0,
                    top: `${(currentMinute / 60) * 100}%`,
                    height: 2, background: '#EF9F27', zIndex: 10, pointerEvents: 'none'
                  }}>
                    <div style={{ position: 'absolute', left: -6, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#EF9F27' }} />
                  </div>
                )}
                {/* Tasks */}
                <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}>
                  {tasks.map(t => {
                    const col = CAT_COLORS[t.categorie] || CAT_COLORS.admin
                    const emp = t.assignee
                    return (
                      <div key={t.id} style={{
                        background: col.bg, color: col.text, borderLeft: '3px solid ' + col.border,
                        fontSize: 11, padding: '3px 8px', borderRadius: 5, maxWidth: 220, cursor: 'default',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 1 }}>
                          {t.heure_debut ? t.heure_debut.slice(0,5) : String(h).padStart(2,'0') + ':00'}
                          {t.heure_fin ? ` - ${t.heure_fin.slice(0,5)}` : ''} &mdash; {t.titre}
                        </div>
                        {emp && <div style={{ fontSize: 10, opacity: 0.8 }}>{emp.prenom} {emp.nom}</div>}
                        <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'capitalize' }}>{t.categorie} &bull; {t.statut?.replace('_',' ')}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  async function createQuickTache(e) {
    e.preventDefault()
    if (!quickForm.titre.trim()) return
    setQuickSaving(true)
    const dateStr = format(quickCreateDate, 'yyyy-MM-dd') + 'T09:00:00'
    const { error } = await supabase.from('taches').insert({
      titre: quickForm.titre.trim(),
      categorie: quickForm.categorie,
      priorite: quickForm.priorite,
      statut: 'a_faire',
      date_echeance: dateStr,
      entreprise_id: profile?.entreprise_id,
      assigne_a: profile?.id,
    })
    setQuickSaving(false)
    if (!error) {
      setQuickCreateDate(null)
      setQuickForm({ titre: '', categorie: 'menage', priorite: 'normale' })
      fetchTaches()
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header with clock */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#185FA5' }}>Planning</h2>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {format(now, "EEEE d MMMM yyyy", { locale: fr })} &bull; <span style={{ fontWeight: 600, color: '#EF9F27' }}>{format(now, 'HH:mm')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Vue toggle */}
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {[['mois','&#128197; Mois'],['jour','&#9201; Jour 24h']].map(([v,l]) => (
              <button key={v} onClick={() => setVue(v)}
                dangerouslySetInnerHTML={{ __html: l }}
                style={{
                  padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                  background: vue === v ? '#185FA5' : '#fff', color: vue === v ? '#fff' : '#333'
                }} />
            ))}
          </div>
          {/* Employe filter */}
          {userRole !== 'employe' && (
            <select value={filtreEmp} onChange={e => setFiltreEmp(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, background: '#fff', minWidth: 150 }}>
              <option value="tous">Toute l&apos;equipe</option>
              {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[['Total', stats.total, '#185FA5'], ['Terminees', stats.terminees, '#3B6D11'], ['Urgentes', stats.urgentes, '#A32D2D'], ['En cours', stats.enCours, '#854F0B']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Legende categories */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(CAT_COLORS).map(([cat, col]) => (
          <span key={cat} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: col.bg, color: col.text, border: '1px solid ' + col.border }}>
            {cat}
          </span>
        ))}
      </div>

      {/* Calendar / Timeline */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0dfd8', padding: 16 }}>
        {vue === 'mois' ? renderMonthCalendar() : renderDayTimeline()}
      </div>
    
      {quickCreateDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nouvelle tache</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{format(quickCreateDate, 'EEEE d MMMM yyyy', { locale: fr })}</div>
            <form onSubmit={createQuickTache}>
              <input autoFocus value={quickForm.titre} onChange={e => setQuickForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre de la tache *"
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <select value={quickForm.categorie} onChange={e => setQuickForm(f => ({ ...f, categorie: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                  {['menage','maintenance','accueil','admin','urgence','restauration','securite'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <select value={quickForm.priorite} onChange={e => setQuickForm(f => ({ ...f, priorite: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                  <option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setQuickCreateDate(null)} style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={quickSaving || !quickForm.titre.trim()} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', opacity: (quickSaving || !quickForm.titre.trim()) ? .6 : 1, fontWeight: 600 }}>
                  {quickSaving ? 'Creation...' : 'Creer la tache'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
</div>
  )
}
