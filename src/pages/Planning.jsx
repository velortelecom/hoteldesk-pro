import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

const HEURES = ['07h','08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h']
const CAT_COLORS = { menage: { bg: '#EAF3DE', text: '#27500A' }, maintenance: { bg: '#FCEBEB', text: '#791F1F' }, accueil: { bg: '#FAEEDA', text: '#633806' }, admin: { bg: '#E6F1FB', text: '#0C447C' }, urgence: { bg: '#FEE2E2', text: '#991B1B' } }

export default function Planning() {
  const [taches, setTaches] = useState([])
  const [employes, setEmployes] = useState([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [modeColor, setModeColor] = useState('personne') // 'personne' | 'categorie'
  const [filtreEmp, setFiltreEmp] = useState('tous')
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    supabase.from('profiles').select('id,nom,prenom,couleur,avatar_initiales').eq('actif', true).then(({ data }) => setEmployes(data || []))
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

  function getChipStyle(t) {
    if (modeColor === 'personne' && t.assignee?.couleur) {
      const c = t.assignee.couleur
      return { background: c + '28', color: c, borderLeft: `3px solid ${c}` }
    }
    const cc = CAT_COLORS[t.categorie] || { bg: '#f0f0f0', text: '#444' }
    return { background: cc.bg, color: cc.text }
  }

  function tachesPour(day, heure) {
    const h = parseInt(heure)
    return taches.filter(t => {
      if (!t.date_echeance) return false
      if (filtreEmp !== 'tous' && t.assignee?.id !== filtreEmp) return false
      const d = new Date(t.date_echeance)
      return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && d.getHours() === h
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
        {[['Total', stats.total, '#185FA5'], ['Terminées', stats.terminees, '#3B6D11'], ['Urgentes', stats.urgentes, '#A32D2D'], ['En cours', stats.enCours, '#854F0B']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setWeekStart(w => addDays(w, -7))} style={navBtn}>←</button>
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textAlign: 'center' }}>
          {format(weekStart, 'd MMM', { locale: fr })} – {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: fr })}
        </span>
        <button onClick={() => setWeekStart(w => addDays(w, 7))} style={navBtn}>→</button>
      </div>

      {/* Filtres couleur + personne */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Mode couleur */}
        <div style={{ display: 'flex', background: '#f0efe8', borderRadius: 8, padding: 3, gap: 2 }}>
          {[['personne','👤 Personne'],['categorie','🏷 Catégorie']].map(([m, l]) => (
            <button key={m} onClick={() => setModeColor(m)} style={{
              padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: modeColor === m ? '#fff' : 'transparent',
              fontWeight: modeColor === m ? 500 : 400,
              color: modeColor === m ? '#185FA5' : '#888',
              boxShadow: modeColor === m ? '0 0 0 0.5px #d0cfc8' : 'none'
            }}>{l}</button>
          ))}
        </div>

        {/* Filtre par employé */}
        <select value={filtreEmp} onChange={e => setFiltreEmp(e.target.value)}
          style={{ padding: '6px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', outline: 'none', flex: 1, minWidth: 120 }}>
          <option value="tous">Toute l'équipe</option>
          {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
      </div>

      {/* Légende employés (mode personne) */}
      {modeColor === 'personne' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {employes.filter(e => e.couleur).map(e => (
            <span key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555', background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 20, padding: '3px 8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.couleur, flexShrink: 0 }}></span>
              {e.prenom} {e.nom[0]}.
            </span>
          ))}
        </div>
      )}

      {/* Légende catégories (mode catégorie) */}
      {modeColor === 'categorie' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(CAT_COLORS).map(([cat, c]) => (
            <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: c.text, background: c.bg, borderRadius: 20, padding: '3px 8px' }}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* Grille planning */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '0.5px solid #e0dfd8' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', minWidth: 500 }}>
          <thead>
            <tr>
              <th style={th}></th>
              {days.map(d => (
                <th key={d.toISOString()} style={{ ...th, background: isToday(d) ? '#E6F1FB' : '#fafaf8', color: isToday(d) ? '#185FA5' : '#555' }}>
                  <div style={{ fontSize: 10 }}>{format(d, 'EEE', { locale: fr })}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{format(d, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEURES.map(h => (
              <tr key={h}>
                <td style={{ ...td, fontSize: 11, color: '#bbb', width: 36, textAlign: 'right', paddingRight: 6, whiteSpace: 'nowrap' }}>{h}</td>
                {days.map(d => {
                  const items = tachesPour(d, h)
                  return (
                    <td key={d.toISOString()} style={{ ...td, background: isToday(d) ? '#f8fbff' : 'transparent', verticalAlign: 'top', padding: 3, minWidth: 70 }}>
                      {items.map(t => {
                        const style = getChipStyle(t)
                        return (
                          <div key={t.id} style={{ ...style, borderRadius: 4, padding: '2px 5px', fontSize: 10, fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {modeColor === 'personne' && t.assignee && (
                              <span style={{ fontSize: 9, opacity: .8 }}>
                                {t.assignee.avatar_initiales || (t.assignee.prenom[0] + t.assignee.nom[0]).toUpperCase()}
                              </span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.titre}</span>
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

const th = { padding: '8px 4px', fontSize: 11, fontWeight: 500, borderBottom: '0.5px solid #e0dfd8', textAlign: 'center' }
const td = { borderBottom: '0.5px solid #f5f4f0', borderRight: '0.5px solid #f5f4f0' }
const navBtn = { padding: '6px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }
