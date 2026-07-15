import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { createQuickPlanningShift, fetchPlanningEmployees, fetchPlanningEntries } from '../services/planning'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isToday, isSameMonth, isSameDay,
  parseISO,
} from 'date-fns'
import { fr } from 'date-fns/locale'

const SHIFT_TYPE_LABELS = {
  travail: 'Service',
  reunion: 'Réunion',
  formation: 'Formation',
  intervention: 'Intervention',
  astreinte: 'Astreinte',
}

const SHIFT_TYPE_COLORS = {
  travail: { bg: '#E6F1FB', text: '#0C447C', border: '#185FA5' },
  reunion: { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
  formation: { bg: '#ECFCCB', text: '#3F6212', border: '#84CC16' },
  intervention: { bg: '#FEF2F2', text: '#991B1B', border: '#EF4444' },
  astreinte: { bg: '#FFF7ED', text: '#9A3412', border: '#F97316' },
}

const ABSENCE_COLORS = { bg: '#FDF2F8', text: '#9D174D', border: '#EC4899' }
const DEPT_CATS_PLANNING = {
  menage: ['menage'],
  maintenance: ['maintenance'],
  reception: ['reception', 'accueil'],
  restauration: ['restauration', 'admin'],
  direction: ['direction', 'menage', 'maintenance', 'accueil', 'admin', 'urgence'],
}
const HEURES_24 = Array.from({ length: 24 }, (_, i) => i)

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function getEntryColor(entry) {
  if (entry.kind === 'conge') return ABSENCE_COLORS
  return SHIFT_TYPE_COLORS[entry.type_shift] || SHIFT_TYPE_COLORS.travail
}

export default function Planning() {
  const { profile } = useAuth()
  const now = useNow()
  const [entries, setEntries] = useState([])
  const [employes, setEmployes] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [quickCreateDate, setQuickCreateDate] = useState(null)
  const [quickForm, setQuickForm] = useState({ notes: '', type_shift: 'travail', heure_debut: '09:00', heure_fin: '17:00', pause_minutes: 0, employe_id: '' })
  const [quickSaving, setQuickSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [vue, setVue] = useState('mois')
  const [filtreEmp, setFiltreEmp] = useState('tous')
  const [error, setError] = useState('')
  const timelineRef = useRef(null)

  const userRole = profile?.role || 'employe'
  const userDept = profile?.departement || ''

  useEffect(() => {
    if (profile?.entreprise_id) loadEmployes()
  }, [profile?.entreprise_id, profile?.id, userRole, userDept])

  useEffect(() => {
    if (profile?.entreprise_id) loadEntries()
  }, [profile?.entreprise_id, currentMonth])

  useEffect(() => {
    if (vue === 'jour' && timelineRef.current) {
      const rowH = 56
      timelineRef.current.scrollTop = Math.max(0, now.getHours() * rowH - 120)
    }
  }, [vue, selectedDay, now])

  async function loadEmployes() {
    try {
      setError('')
      setEmployes(await fetchPlanningEmployees(profile, userRole, userDept))
    } catch (caughtError) {
      setError(caughtError?.message || 'Chargement du planning impossible.')
    }
  }

  async function loadEntries() {
    try {
      setError('')
      setEntries(await fetchPlanningEntries(profile, currentMonth))
    } catch (caughtError) {
      setError(caughtError?.message || 'Chargement du planning impossible.')
    }
  }

  function filterEntry(entry) {
    if (userRole === 'employe') return entry.employe_id === profile?.id
    if (userRole === 'chef_equipe') return entry.employe_id === profile?.id || Boolean(entry.equipe?.id)
    if (userRole === 'responsable') {
      const allowed = DEPT_CATS_PLANNING[userDept] || []
      return allowed.includes(entry.categorie) || entry.employe_id === profile?.id
    }
    return true
  }

  function getEntriesForDay(day) {
    return entries.filter((entry) => {
      if (!entry.date_key) return false
      if (!filterEntry(entry)) return false
      if (filtreEmp !== 'tous' && entry.employe_id !== filtreEmp) return false
      return isSameDay(parseISO(entry.date_key), day)
    })
  }

  function getEntriesForHour(day, hour) {
    return getEntriesForDay(day).filter((entry) => {
      if (entry.kind === 'conge') return hour === 8
      const [hh] = String(entry.heure_debut || '').split(':').map(Number)
      return hh === hour
    })
  }

  const monthEntries = entries.filter(filterEntry)
  const monthShifts = monthEntries.filter((entry) => entry.kind === 'shift')
  const monthConges = monthEntries.filter((entry) => entry.kind === 'conge')
  const stats = {
    total: monthShifts.length,
    publies: monthShifts.filter((entry) => entry.statut === 'publie').length,
    brouillons: monthShifts.filter((entry) => entry.statut === 'brouillon').length,
    absences: monthConges.length,
  }

  function renderMonthCalendar() {
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 })
    const days = []
    let cursor = calStart
    while (cursor <= calEnd) {
      days.push(cursor)
      cursor = addDays(cursor, 1)
    }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setCurrentMonth((value) => subMonths(value, 1))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8592;</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5', textTransform: 'capitalize' }}>{format(currentMonth, 'MMMM yyyy', { locale: fr })}</div>
            <div style={{ fontSize: 12, color: '#888' }}>Aujourd&apos;hui : {format(now, 'EEEE d MMMM yyyy', { locale: fr })} • {format(now, 'HH:mm')}</div>
          </div>
          <button onClick={() => setCurrentMonth((value) => addMonths(value, 1))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8594;</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }} style={{ padding: '4px 14px', borderRadius: 8, border: '1px solid #185FA5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#185FA5' }}>Aujourd&apos;hui</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label) => <div key={label} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888', padding: '4px 0' }}>{label}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((day, index) => {
            const dayEntries = getEntriesForDay(day)
            const isSelected = isSameDay(day, selectedDay)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDay = isToday(day)
            return (
              <div key={index} onClick={() => { setSelectedDay(day); setVue('jour'); setQuickCreateDate(day) }} style={{ minHeight: 72, border: isSelected ? '2px solid #185FA5' : isTodayDay ? '2px solid #EF9F27' : '1px solid #e0dfd8', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', background: isSelected ? '#EEF5FF' : isTodayDay ? '#FFF8EE' : '#fff', opacity: isCurrentMonth ? 1 : 0.4 }}>
                <div style={{ fontSize: 12, fontWeight: isTodayDay ? 700 : 500, color: isTodayDay ? '#EF9F27' : '#333', marginBottom: 2 }}>{format(day, 'd')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {dayEntries.slice(0, 3).map((entry) => {
                    const color = getEntryColor(entry)
                    const label = entry.kind === 'conge'
                      ? `Congé ${entry.title}`
                      : `${String(entry.heure_debut).slice(0, 5)} ${SHIFT_TYPE_LABELS[entry.type_shift] || entry.title}`
                    return <div key={entry.id} style={{ background: color.bg, color: color.text, borderLeft: '2px solid ' + color.border, fontSize: 10, padding: '1px 4px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                  })}
                  {dayEntries.length > 3 && <div style={{ fontSize: 10, color: '#888' }}>+{dayEntries.length - 3} autres</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderDayTimeline() {
    const currentHour = isToday(selectedDay) ? now.getHours() : -1
    const currentMinute = now.getMinutes()

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setSelectedDay((day) => addDays(day, -1))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8592;</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5', textTransform: 'capitalize' }}>{format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{isToday(selectedDay) ? `Heure actuelle : ${format(now, 'HH:mm')}` : format(selectedDay, 'MMMM yyyy', { locale: fr })}</div>
          </div>
          <button onClick={() => setSelectedDay((day) => addDays(day, 1))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8594;</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setSelectedDay(new Date()); setCurrentMonth(new Date()) }} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #185FA5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#185FA5' }}>Aujourd&apos;hui</button>
          <button onClick={() => setVue('mois')} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#333' }}>&#128197; Vue mois</button>
        </div>
        <div ref={timelineRef} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', minHeight: 400, position: 'relative', borderRadius: 10, border: '1px solid #e0dfd8' }}>
          {HEURES_24.map((hour) => {
            const hourEntries = getEntriesForHour(selectedDay, hour)
            const isCurrentHourRow = hour === currentHour
            return (
              <div key={hour} style={{ display: 'flex', minHeight: 56, borderBottom: '1px solid #f0efe8', background: isCurrentHourRow ? '#FFFBF0' : hour % 2 === 0 ? '#fff' : '#fafaf8', position: 'relative' }}>
                <div style={{ width: 52, minWidth: 52, padding: '4px 8px 0', fontSize: 12, fontWeight: isCurrentHourRow ? 700 : 400, color: isCurrentHourRow ? '#EF9F27' : '#aaa', borderRight: '1px solid #e0dfd8', background: isCurrentHourRow ? '#FFF8EE' : 'transparent' }}>{String(hour).padStart(2, '0')}:00</div>
                {isCurrentHourRow && (
                  <div style={{ position: 'absolute', left: 52, right: 0, top: `${(currentMinute / 60) * 100}%`, height: 2, background: '#EF9F27', zIndex: 10, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -6, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#EF9F27' }} />
                  </div>
                )}
                <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}>
                  {hourEntries.map((entry) => {
                    const color = getEntryColor(entry)
                    return (
                      <div key={entry.id} style={{ background: color.bg, color: color.text, borderLeft: '3px solid ' + color.border, fontSize: 11, padding: '3px 8px', borderRadius: 5, maxWidth: 240, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 1 }}>
                          {entry.kind === 'conge'
                            ? `Toute la journée — Congé ${entry.title}`
                            : `${String(entry.heure_debut).slice(0, 5)} - ${String(entry.heure_fin).slice(0, 5)} — ${SHIFT_TYPE_LABELS[entry.type_shift] || entry.title}`}
                        </div>
                        {entry.assignee && <div style={{ fontSize: 10, opacity: 0.8 }}>{entry.assignee.prenom} {entry.assignee.nom}</div>}
                        <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'capitalize' }}>{entry.kind === 'conge' ? 'absence' : entry.type_shift} • {String(entry.statut || '').replace('_', ' ')}</div>
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

  async function createQuickShift(event) {
    event.preventDefault()
    if (!quickForm.heure_debut || !quickForm.heure_fin) return
    setQuickSaving(true)
    try {
      setError('')
      await createQuickPlanningShift(profile, quickForm, format(quickCreateDate, 'yyyy-MM-dd'))
      setQuickCreateDate(null)
      setQuickForm({ notes: '', type_shift: 'travail', heure_debut: '09:00', heure_fin: '17:00', pause_minutes: 0, employe_id: '' })
      await loadEntries()
    } catch (caughtError) {
      setError(caughtError?.message || 'Création rapide impossible.')
    } finally {
      setQuickSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {error && <div style={{ marginBottom: 16, padding: '12px 14px', background: '#FEF2F2', color: '#991B1B', borderRadius: 10, border: '1px solid #FECACA', fontSize: 13 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#185FA5' }}>Planning</h2>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{format(now, 'EEEE d MMMM yyyy', { locale: fr })} • <span style={{ fontWeight: 600, color: '#EF9F27' }}>{format(now, 'HH:mm')}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {[['mois', '&#128197; Mois'], ['jour', '&#9201; Jour 24h']].map(([value, label]) => (
              <button key={value} onClick={() => setVue(value)} dangerouslySetInnerHTML={{ __html: label }} style={{ padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12, background: vue === value ? '#185FA5' : '#fff', color: vue === value ? '#fff' : '#333' }} />
            ))}
          </div>
          {userRole !== 'employe' && (
            <select value={filtreEmp} onChange={(event) => setFiltreEmp(event.target.value)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, background: '#fff', minWidth: 150 }}>
              <option value="tous">Toute l&apos;équipe</option>
              {employes.map((employe) => <option key={employe.id} value={employe.id}>{employe.prenom} {employe.nom}</option>)}
            </select>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[['Shifts', stats.total, '#185FA5'], ['Publiés', stats.publies, '#3B6D11'], ['Brouillons', stats.brouillons, '#A32D2D'], ['Congés', stats.absences, '#854F0B']].map(([label, value, color]) => (
          <div key={label} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color }}>{value}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(SHIFT_TYPE_COLORS).map(([key, color]) => (
          <span key={key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: color.bg, color: color.text, border: '1px solid ' + color.border }}>{SHIFT_TYPE_LABELS[key] || key}</span>
        ))}
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: ABSENCE_COLORS.bg, color: ABSENCE_COLORS.text, border: '1px solid ' + ABSENCE_COLORS.border }}>Congé</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0dfd8', padding: 16 }}>
        {vue === 'mois' ? renderMonthCalendar() : renderDayTimeline()}
      </div>

      {quickCreateDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nouveau créneau</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{format(quickCreateDate, 'EEEE d MMMM yyyy', { locale: fr })}</div>
            <form onSubmit={createQuickShift}>
              <textarea autoFocus value={quickForm.notes} onChange={(event) => setQuickForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes du créneau" rows={2} style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <select value={quickForm.type_shift} onChange={(event) => setQuickForm((prev) => ({ ...prev, type_shift: event.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                  {Object.entries(SHIFT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={quickForm.employe_id} onChange={(event) => setQuickForm((prev) => ({ ...prev, employe_id: event.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                  <option value="">Moi</option>
                  {employes.map((employe) => <option key={employe.id} value={employe.id}>{employe.prenom} {employe.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                <input type="time" value={quickForm.heure_debut} onChange={(event) => setQuickForm((prev) => ({ ...prev, heure_debut: event.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }} />
                <input type="time" value={quickForm.heure_fin} onChange={(event) => setQuickForm((prev) => ({ ...prev, heure_fin: event.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }} />
                <input type="number" min="0" max="720" value={quickForm.pause_minutes} onChange={(event) => setQuickForm((prev) => ({ ...prev, pause_minutes: event.target.value }))} placeholder="Pause (min)" style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setQuickCreateDate(null)} style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={quickSaving || !quickForm.heure_debut || !quickForm.heure_fin} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', opacity: (quickSaving || !quickForm.heure_debut || !quickForm.heure_fin) ? 0.6 : 1, fontWeight: 600 }}>{quickSaving ? 'Création...' : 'Créer le créneau'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
