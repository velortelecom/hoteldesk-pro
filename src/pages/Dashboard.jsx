import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const COULEURS_STATUT = {
  planifiee: { bg: '#FFF6FF', color: '#1E40AF', label: 'Planifiees' },
  en_cours:  { bg: '#FEF3C7', color: '#92400E', label: 'En cours' },
  terminee:  { bg: '#ECFDF5', color: '#065F46', label: 'Terminees' },
  annulee:   { bg: '#FEF2F2', color: '#991B1B', label: 'Annulees' },
}

const COULEURS_DEP = {
  accueil:      '#185FA5',
  menage:       '#7C3AED',
  maintenance:  '#D97706',
  restauration: '#059669',
  direction:    '#DC2626',
}

export default function Dashboard() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'responsable'

  const [stats, setStats]       = useState({ total:0, planifiee:0, en_cours:0, terminee:0, annulee:0 })
  const [urgentes, setUrgentes] = useState(0)
  const [depStats, setDepStats] = useState([])
  const [equipe, setEquipe]     = useState([])
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading]   = useState(true)

  const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  const prenom = profile?.prenom || profile?.nom || 'Utilisateur'

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchEquipe(), fetchRecentes()])
    setLoading(false)
  }

  async function fetchStats() {
    const { data } = await supabase.from('taches').select('statut, priorite, departement')
    if (!data) return
    const s = { total: data.length, planifiee:0, en_cours:0, terminee:0, annulee:0 }
    data.forEach(t => { if (s[t.statut] !== undefined) s[t.statut]++ })
    setStats(s)
    setUrgentes(data.filter(t => t.priorite === 'urgente' && t.statut !== 'terminee').length)
    const deps = {}
    data.forEach(t => {
      if (!deps[t.departement]) deps[t.departement] = { total:0, terminee:0 }
      deps[t.departement].total++
      if (t.statut === 'terminee') deps[t.departement].terminee++
    })
    setDepStats(Object.entries(deps).map(([dep, v]) => ({ dep, ...v, pct: v.total ? Math.round(v.terminee/v.total*100) : 0 })))
  }

  async function fetchEquipe() {
    if (!isAdmin) return
    const { data } = await supabase.from('profiles').select('id, nom, prenom, role, departement').order('nom')
    setEquipe(data || [])
  }

  async function fetchRecentes() {
    const { data } = await supabase
      .from('taches')
      .select('id, titre, statut, priorite, departement, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentes(data || [])
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:300, fontSize:16, color:'#6b7280' }}>
      Chargement du tableau de bord...
    </div>
  )

  const pct = (n) => stats.total ? Math.round(n/stats.total*100) : 0

  return (
    <div style={{ padding:16, maxWidth:800, margin:'0 auto' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1e293b', margin:0 }}>
          Bonjour, {prenom}
        </h2>
        <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0' }}>{today}</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total taches',  value: stats.total,      bg:'#EFF6FF', color:'#1d4ed8' },
          { label:'Urgentes',      value: urgentes,         bg:'#FFF1F2', color:'#be123c' },
          { label:'En cours',      value: stats.en_cours,   bg:'#FFFBEB', color:'#b45309' },
          { label:'Terminees',     value: stats.terminee,   bg:'#F0FDF4', color:'#15803d' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:c.color, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>{c.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:c.color, marginTop:4 }}>{c.value}</div>
          </div>
        ))}
      </div>
      {stats.total > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:16, border:'0.5px solid #e0dfc4' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:10 }}>Avancement global</div>
          <div style={{ display:'flex', gap:4, height:12, borderRadius:6, overflow:'hidden' }}>
            {Object.entries(COULEURS_STATUT).map(([s,c]) => (
              stats[s] > 0 && <div key={s} style={{ flex: stats[s], background: c.color, opacity:0.8 }} />
            ))}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'wrap' }}>
            {Object.entries(COULEURS_STATUT).map(([s,c]) => (
              <span key={s} style={{ fontSize:11, color:c.color, display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:c.color }} />
                {c.label} ({pct(stats[s])}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {depStats.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:16, border:'0.5px solid #e0dfc4' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:10 }}>Par departement</div>
          {depStats.map(d => (
            <div key={d.dep} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#374151', marginBottom:3 }}>
                <span style={{ textTransform:'capitalize', fontWeight:500 }}>{d.dep}</span>
                <span style={{ color: COULEURS_DEP[d.dep] || '#6b7280' }}>{d.terminee}/{d.total} ({d.pct}%)</span>
              </div>
              <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width: d.pct+'%', background: COULEURS_DEP[d.dep] || '#6b7280', borderRadius:4 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {isAdmin && equipe.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:16, border:'0.5px solid #e0dfc4' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:10 }}>Equipe ({equipe.length})</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {equipe.map(m => {
              const initials = ((m.prenom?.[0]||'') + (m.nom?.[0]||'')).toUpperCase() || '?'
              const col = COULEURS_DEP[m.departement] || '#6b7280'
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:6, background:'#f8fafc', borderRadius:8, padding:'6px 10px', border:'0.5px solid #e2e8f0' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:col, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{initials}</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>{m.prenom} {m.nom}</div>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'capitalize' }}>{m.role} · {m.departement}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {recentes.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:16, border:'0.5px solid #e0dfc4' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:10 }}>Taches recentes</div>
          {recentes.map(t => {
            const c = COULEURS_STATUT[t.statut] || COULEURS_STATUT.planifiee
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#1e293b' }}>{t.titre}</div>
                  <div style={{ fontSize:11, color:'#64748b', textTransform:'capitalize' }}>{t.departement}</div>
                </div>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:c.bg, color:c.color, fontWeight:600, whiteSpace:'nowrap' }}>
                  {c.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
