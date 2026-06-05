import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Planning from './pages/Planning'
import Taches from './pages/Taches'
import Messagerie from './pages/Messagerie'
import Rappels from './pages/Rappels'
import Personnel from './pages/Personnel'
import Dashboard from './pages/Dashboard'

const NAV = [
  { id: 'dashboard', label: 'Accueil',  icon: 'Accueil' },
  { id: 'planning',  label: 'Planning', icon: 'Planning' },
  { id: 'taches',    label: 'Taches',   icon: 'Taches' },
  { id: 'messagerie',label: 'Messages', icon: 'Messages' },
  { id: 'rappels',   label: 'Rappels',  icon: 'Rappels' },
  { id: 'personnel', label: 'Equipe',   icon: 'Equipe' },
]

function Toast({ toasts, remove }) {
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => remove(t.id)} style={{
          background: t.type === 'success' ? '#ECFDF5' : t.type === 'error' ? '#FEF2F2' : '#EFF6FF',
          border: '0.5px solid ' + (t.type === 'success' ? '#6EE7B7' : t.type === 'error' ? '#FCA5A5' : '#BFDBFE'),
          color: t.type === 'success' ? '#065F46' : t.type === 'error' ? '#991B1B' : '#1E40AF',
          padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxWidth: 280, lineHeight: 1.4,
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

function AppInner() {
  const { user, profile, loading, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (msg, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'taches' },
        (payload) => addToast('Nouvelle tache : ' + payload.new.titre, 'info'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'taches' },
        (payload) => {
          if (payload.new.statut === 'terminee') addToast('Tache terminee : ' + payload.new.titre, 'success')
          else if (payload.new.statut === 'en_cours') addToast('En cours : ' + payload.new.titre, 'info')
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.expediteur_id !== user.id) addToast('Nouveau message recu', 'info')
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>H</div>
      <div style={{ fontSize: 13, color: '#aaa' }}>Chargement...</div>
    </div>
  )

  if (!user) return <Login />

  const TITLES = { dashboard: 'Accueil', planning: 'Planning', taches: 'Taches', messagerie: 'Messagerie', rappels: 'Rappels', personnel: 'Equipe' }
  const PAGES = { dashboard: <Dashboard />, planning: <Planning />, taches: <Taches />, messagerie: <Messagerie />, rappels: <Rappels />, personnel: <Personnel /> }

  const couleurProfil = profile?.couleur || '#185FA5'
  const initiales = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Toast toasts={toasts} remove={removeToast} />

      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0dfd8', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 18 }}>H</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>HotelDesk Pro</span>
          <span style={{ fontSize: 13, color: '#888', marginLeft: 2 }}>-- {TITLES[page]}</span>
        </div>
        {profile && (
          <div onClick={() => setMenuOpen(!menuOpen)} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: couleurProfil + '22',
            border: '2px solid ' + couleurProfil,
            color: couleurProfil,
            fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0
          }}>
            {initiales}
          </div>
        )}
      </div>

      {menuOpen && (
        <div>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{ position: 'fixed', top: 60, right: 12, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: 14, zIndex: 100, minWidth: 190, boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: couleurProfil + '22', border: '2px solid ' + couleurProfil, color: couleurProfil, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {initiales}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.prenom} {profile?.nom}</div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>{profile?.role} - {profile?.departement}</div>
              </div>
            </div>
            <button onClick={() => { signOut(); setMenuOpen(false) }} style={{ width: '100%', padding: '8px 12px', background: '#FEF2F2', color: '#991B1B', border: '0.5px solid #FCA5A5', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              Deconnexion
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '16px 16px 80px' }}>
        {PAGES[page]}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e0dfd8', display: 'flex', justifyContent: 'space-around', padding: '8px 0 12px', zIndex: 50 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: page === n.id ? '#185FA5' : '#888', fontSize: 10, cursor: 'pointer', padding: '4px 8px',
            fontWeight: page === n.id ? 600 : 400
          }}>
            <span style={{ fontSize: 18, opacity: page === n.id ? 1 : 0.5 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
        }
