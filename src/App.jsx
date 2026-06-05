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
  { id: 'dashboard', label: 'Accueil',  icon: '🏠' },
  { id: 'planning',  label: 'Planning', icon: '📅' },
  { id: 'taches',    label: 'Tâches',   icon: '✅' },
  { id: 'messagerie',label: 'Messages', icon: '💬' },
  { id: 'rappels',   label: 'Rappels',  icon: '🔔' },
  { id: 'personnel', label: 'Équipe',   icon: '👥' },
  ]

function Toast({ toasts, remove }) {
    return (
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {toasts.map(t => (
                    <div key={t.id} onClick={() => remove(t.id)} style={{
                                background: t.type === 'success' ? '#ECFDF5' : t.type === 'error' ? '#FEF2F2' : '#EFF6FF',
                                border: `0.5px solid ${t.type === 'success' ? '#6EE7B7' : t.type === 'error' ? '#FCA5A5' : '#BFDBFE'}`,
                                color: t.type === 'success' ? '#065F46' : t.type === 'error' ? '#991B1B' : '#1E40AF',
                                padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxWidth: 280, lineHeight: 1.4,
                                animation: 'slideIn .2s ease'
                    }}>
                      {t.type === 'success' ? '✅ ' : t.type === 'error' ? '❌ ' : '🔔 '}{t.msg}
                    </div>div>
                  ))}
          </div>div>
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
                      (payload) => addToast(`Nouvelle tâche : ${payload.new.titre}`, 'info'))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'taches' },
                      (payload) => {
                                  if (payload.new.statut === 'terminee') addToast(`✔ Tâche terminée : ${payload.new.titre}`, 'success')
                                  else if (payload.new.statut === 'en_cours') addToast(`▶ En cours : ${payload.new.titre}`, 'info')
                      })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
                      (payload) => {
                                  if (payload.new.expediteur_id !== user.id) addToast('Nouveau message reçu', 'info')
                      })
          .subscribe()
        return () => supabase.removeChannel(channel)
  }, [user])

  if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏨</div>div>
                <div style={{ fontSize: 13, color: '#aaa' }}>Chargement...</div>div>
        </div>div>
      )

  if (!user) return <Login />

  const TITLES = { dashboard: 'Accueil', planning: 'Planning', taches: 'Tâches', messagerie: 'Messagerie', rappels: 'Rappels', personnel: 'Équipe' }
    const PAGES = { dashboard: <Dashboard />, planning: <Planning />, taches: <Taches />, messagerie: <Messagerie />, rappels: <Rappels />, personnel: <Personnel /> }

  const couleurProfil = profile?.couleur || '#185FA5'

  return (
        <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }`}</style>style>
        
              <Toast toasts={toasts} remove={removeToast} />
        
          {/* Header */}
              <div style={{ background: '#fff', borderBottom: '0.5px solid #e0dfd8', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                <span style={{ fontSize: 18 }}>🏨</span>span>
                                <span style={{ fontSize: 15, fontWeight: 500 }}>HôtelDesk</span>span>
                                <span style={{ fontSize: 13, color: '#888', marginLeft: 2 }}>— {TITLES[page]}</span>span>
                      </div>div>
                {profile && (
                    <div onClick={() => setMenuOpen(!menuOpen)} style={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  background: couleurProfil + '22',
                                  border: `2px solid ${couleurProfil}`,
                                  color: couleurProfil,
                                  fontSize: 12, fontWeight: 500,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', flexShrink: 0
                    }}>
                      {((profile.prenom?.[0] || '') + (profile.nom?.[0] || '')).toUpperCase()}
                    </div>div>
                      )}
              </div>div>
        
          {/* Dropdown profil */}
          {menuOpen && (
                  <>
                            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                            <div style={{ position: 'fixed', top: 60, right: 12, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: 14, zIndex: 100, minWidth: 190, boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: couleurProfil + '22', border: `2px solid ${couleurProfil}`, color: couleurProfil, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()}
                                                      </div>div>
                                                      <div>
                                                                      <div style={{ fontSize: 13, fontWeight: 500 }}>{profile?.prenom} {profile?.nom}</div>div>
                                                                      <div style={{ fontSize: 11, color: '#888' }}>{profile?.departement} · {profile?.role}</div>div>
                                                      </div>div>
                                        </div>div>
                                        <button onClick={() => { setPage('personnel'); setMenuOpen(false) }}
                                                        style={{ width: '100%', padding: '7px 0', background: '#f0efe8', color: '#444', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>
                                                      👥 Gérer l'équipe
                                        </button>button>
                                        <button onClick={signOut}
                                                        style={{ width: '100%', padding: '7px 0', background: '#FCEBEB', color: '#A32D2D', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                                                      Se déconnecter
                                        </button>button>
                            </div>div>
                  </>>
                )}
        
          {/* Page content */}
              <div style={{ padding: '16px 16px 80px' }}>
                {PAGES[page]}
              </div>div>
        
          {/* Bottom nav */}
              <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e0dfd8', display: 'flex', zIndex: 50 }}>
                {NAV.map(n => (
                    <button key={n.id} onClick={() => setPage(n.id)} style={{
                                  flex: 1, padding: '9px 0 11px', border: 'none', background: 'transparent', cursor: 'pointer',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                  color: page === n.id ? '#185FA5' : '#bbb',
                                  borderTop: page === n.id ? '2px solid #185FA5' : '2px solid transparent',
                    }}>
                                <span style={{ fontSize: 18 }}>{n.icon}</span>span>
                                <span style={{ fontSize: 9, fontWeight: page === n.id ? 500 : 400, letterSpacing: '.02em' }}>{n.label}</span>span>
                    </button>button>
                  ))}
              </div>div>
        </div>div>
      )
}

export default function App() {
    return <AuthProvider><AppInner /></AuthProvider>AuthProvider>
      }</></style>
