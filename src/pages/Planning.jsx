import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

const HEURES = ['07h','08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h']
const CAT_COLORS = { menage: { bg: '#EAF3DE', text: '#27500A' }, maintenance: { bg: '#FCEBEB', text: '#791F1F' }, accueil: { bg: '#FAEEDA', text: '#633806' }, admin: { bg: '#E6F1FB', text: '#0C447C' }, urgence: { bg: '#F5E6FB', text: '#5B0B7C' } }

// Mapping departement -> categories visibles dans le planning
const DEPT_CATS_PLANNING = {
  menage: ['menage'],
  maintenance: ['maintenance'],
  reception: ['accueil'],
  restauration: ['admin'],
  direction: ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
}

export default function Planning() {
  const { profile } = useAuth()
  const [taches, setTaches] = useState([])
  const [employes, setEmployes] = useState([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [modeColor, setModeColor] = useState('personne') // 'personne' | 'categorie'
  const [filtreEmp, setFiltreEmp] = useState('tous')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const userRole = profile?.role || 'employe'
  const userDept = profile?.departement || ''
  const catsVisibles = userRole === 'admin' ? null : (DEPT_CATS_PLANNING[userDept] || [])

  useEffect(() => {
    // For planning: employes visible depend on role
    const empQuery = supabase.from('profiles').select('id,nom,prenom,couleur,avatar_initiales,departement').eq('actif', true)
    if (userRole === 'responsable') {
      empQuery.eq('departement', userDept)
    } else if (userRole === 'employe') {
      empQuery.eq('id', profile?.id)
    }
    empQuery.then(({ data }) => setEmployes(data || []))
  }, [])

  useEffect(() => {
    const from = weekStart.toISOString()
    const to = addDays(weekStart, 7).toISOString()
    supabase.from('taches')
      .select('*, assignee:profiles!taches_assigne_a_fkey(id,nom,prenom,couleur,avatar_initiales)')
      .gte('date_echeance', from)
      .lt('date_echeance', to)
      .neq('statut', 'annulee')
      .then(({ data }) => setTaches(data || []))
  }, [weekStart])

  function getTasksForCell(day, h) {
    const hNum = parseInt(h)
    return taches.filter(t => {
      if (!t.date_echeance) return false
      // Filter by role/department
      if (userRole === 'employe') {
        // Employe sees only their tasks
        if (t.assigne_a !== profile?.id) return false
      } else if (userRole === 'responsable') {
        // Responsable sees tasks of their department categories
        if (catsVisibles && !catsVisibles.includes(t.categorie) && t.assigne_a !== profile?.id && t.cree_par !== profile?.id) return false
      }
      // Admin sees all (no filter)
      if (filtreEmp !== 'tous' && t.assignee?.id !== filtreEmp) return false
      const d = new Date(t.date_echeance)
      return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && d.getHours() === hNum
    })
  }

  const stats = {
    total: taches.length,
    terminees: taches.filter(t => t.statut === 'terminee').length,
    urgentes: taches.filter(t => t.priorite === 'haute' && t.statut !== 'terminee').length,
    enCours: taches.filter(t => t.statut === 'en_cours').length,
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[['Total', stats.total, '#185FA5'], ['Terminees', stats.terminees, '#3B6D11'], ['Urgentes', stats.urgentes, '#A32D2D'], ['En cours', stats.enCours, '#854F0B']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Navigation semaine */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
        <button onClick={() => setWeekStart(d => addDays(d, -7))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&larr;</button>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#185FA5' }}>
          {format(weekStart, 'd MMM', { locale: fr })} &ndash; {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: fr })}
        </span>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&rarr;</button>
      </div>

      {/* Filtres couleur et employe */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0' }}>
        <button onClick={() => setModeColor('personne')} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid', borderColor: modeColor === 'personne' ? '#185FA5' : '#d1d5db', background: modeColor === 'personne' ? '#185FA5' : '#fff', color: modeColor === 'personne' ? '#fff' : '#333', fontSize: 12, cursor: 'pointer' }}>Personne</button>
        <button onClick={() => setModeColor('categorie')} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid', borderColor: modeColor === 'categorie' ? '#185FA5' : '#d1d5db', background: modeColor === 'categorie' ? '#185FA5' : '#fff', color: modeColor === 'categorie' ? '#fff' : '#333', fontSize: 12, cursor: 'pointer' }}>Categorie</button>
        {userRole !== 'employe' && (
          <select value={filtreEmp} onChange={e => setFiltreEmp(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, background: '#fff', minWidth: 160 }}>
            <option value="tous">Toute l'equipe</option>
            {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
        )}
      </div>

      {/* Legende employes */}
      {modeColor === 'personne' && userRole !== 'employe' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {employes.map(e => (
            <span key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '3px 8px', borderRadius: 10, background: e.couleur ? e.couleur + '22' : '#f0f0f0', border: '1px solid ' + (e.couleur || '#ccc') }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.couleur || '#999', display: 'inline-block' }}></span>
              {e.prenom} {e.nom?.charAt(0)}.
            </span>
          ))}
        </div>
      )}

      {/* Calendrier hebdomadaire */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 40, padding: '6px 4px', fontSize: 11, color: '#888', fontWeight: 500 }}></th>
              {days.map(day => (
                <th key={day.toISOString()} style={{ padding: '6px 4px', fontSize: 12, fontWeight: 600, color: isToday(day) ? '#185FA5' : '#333', textAlign: 'center', background: isToday(day) ? '#EBF2FB' : 'transparent', borderRadius: 8 }}>
                  <div>{format(day, 'EEE', { locale: fr }).replace(/^./, c => c.toUpperCase())}</div>
                  <div style={{ fontWeight: isToday(day) ? 800 : 400 }}>{format(day, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEURES.map(h => (
              <tr key={h}>
                <td style={{ fontSize: 10, color: '#aaa', textAlign: 'right', paddingRight: 6, verticalAlign: 'top', paddingTop: 4 }}>{h}</td>
                {days.map(day => {
                  const tasks = getTasksForCell(day, h)
                  return (
                    <td key={day.toISOString()} style={{ height: 36, verticalAlign: 'top', padding: '2px 3px', border: '0.5px solid #f0f0f0', background: isToday(day) ? '#F8FBFF' : 'transparent', position: 'relative' }}>
                      {tasks.map(t => {
                        const colors = modeColor === 'categorie'
                          ? (CAT_COLORS[t.categorie] || { bg: '#f5f5f5', text: '#333' })
                          : { bg: t.assignee?.couleur ? t.assignee.couleur + '33' : '#f5f5f5', text: t.assignee?.couleur || '#333' }
                        return (
                          <div key={t.id} title={t.titre + (t.assignee ? ' - ' + t.assignee.prenom : '')} style={{ background: colors.bg, color: colors.text, fontSize: 10, borderRadius: 4, padding: '1px 4px', marginBottom: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', border: '1px solid ' + (colors.text + '44') }}>
                            {t.chambre ? 'Ch.' + t.chambre + ' ' : ''}{t.titre}
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
