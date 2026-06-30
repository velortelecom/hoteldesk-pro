// src/App.jsx
// Velor One - V4 : Plugin System + React.lazy/Suspense + loader.js
import { useState, useEffect, Suspense } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useModules } from './hooks/useModules'
import { buildLoadedModules, buildNavItems, buildRouteMap, canAccessRoute } from './modules/loader.js'
import { SOCLE_MENUS } from './lib/modules'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Planning from './pages/Planning'
import Taches from './pages/Taches'
import Messagerie from './pages/Messagerie'
import Rappels from './pages/Rappels'
import Personnel from './pages/Personnel'
import Dashboard from './pages/Dashboard'
import SuperAdmin from './pages/SuperAdmin'
import { ModuleNonAutorise } from './pages/ModuleEnPreparation'

// Icones emoji du socle
const ICONES_SOCLE = {
  dashboard: '🏠', planning: '📅', taches: '✅',
  messagerie: '💬', rappels: '🔔', personnel: '👥',
}

// Composant de chargement pour Suspense
function LoadingModule() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>Chargement...</div>
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { modulesActifs, catalogue } = useModules()
  const [page, setPage] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    // Si non-super-admin arrive sur superadmin, rediriger vers dashboard
    return hash || 'dashboard'
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [nomEntreprise, setNomEntreprise] = useState('Velor One')
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    if (profile?.entreprise_id) {
      supabase.from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        .then(({ data }) => { if (data?.nom) setNomEntreprise(data.nom) })
    }
  }, [profile?.entreprise_id])

  // Auto-corriger le prenom si c'est 'Nouveau' (profil par defaut du trigger)
  useEffect(() => {
    if (profile?.id && (profile.prenom === 'Nouveau' || !profile.prenom)) {
      const emailParts = user?.email?.split('@')[0]?.split('_') || []
      const autoPrenom = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Admin'
      supabase.from('profiles').update({ prenom: autoPrenom }).eq('id', profile.id)
    }
  }, [profile?.id, profile?.prenom])

  // Si admin non-super-admin arrive sur superadmin, rediriger vers dashboard
  useEffect(() => {
    if (profile && !profile.is_super_admin && page === 'superadmin') {
      setPage('dashboard')
      window.location.hash = 'dashboard'
    }
  }, [profile, page])

  // Hash navigation sync
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (h) setPage(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    window.location.hash = page
  }, [page])

  if (authLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: '#aaa' }}>Chargement...</div>
  if (!user) return <Login />

  const isSuperAdmin = profile?.is_super_admin
  const loadedModules = buildLoadedModules(modulesActifs, catalogue)
  // Navigation: socle toujours present + modules charges
  const socleNavItems = SOCLE_MENUS.map(m => ({ id: m.id, label: m.label || m.nom, icon: ICONES_SOCLE[m.id] || m.icone || '' }))
  const moduleNavItems = buildNavItems(loadedModules).map(m => ({ id: m.id, label: m.label || m.nom, icon: m.icone || '' }))
  const moduleIds = moduleNavItems.map(m => m.id)
  const uniqueSocle = socleNavItems.filter(m => !moduleIds.includes(m.id))
  const superAdminItem = isSuperAdmin ? [{ id: 'superadmin', label: 'Super Admin', icon: '🛡️' }] : []
  const navItems = [...superAdminItem, ...uniqueSocle, ...moduleNavItems]
  const routeMap = buildRouteMap(loadedModules)

  const navigate = (p) => { setPage(p); setMenuOpen(false); setShowUserMenu(false) }

  function addToast(msg, color = '#185FA5') {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, color }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const prenomDisplay = profile?.prenom && profile.prenom !== 'Nouveau' ? profile.prenom : (user?.email?.split('@')[0] || 'Admin')
  const initiales = profile?.avatar_initiales || (prenomDisplay[0] + (profile?.nom?.[0] || '')).toUpperCase()

  function renderPage() {
    if (isSuperAdmin && page === 'superadmin') return <SuperAdmin />
    if (!isSuperAdmin && page === 'superadmin') return <Dashboard />

    const isSoclePage = SOCLE_MENUS.some(m => m.id === page)
    if (!isSoclePage && !canAccessRoute(page, loadedModules, routeMap)) {
      if (page === 'dashboard') return <Dashboard />
      return <ModuleNonAutorise />
    }

    switch (page) {
      case 'dashboard': return <Dashboard />
      case 'planning': return <Planning />
      case 'taches': return <Taches />
      case 'messages': return profile?.entreprise_id ? <Messagerie /> : <Dashboard />
      case 'rappels': return <Rappels />
      case 'personnel': return <Personnel />
      default:
        if (routeMap[page]) {
          const Comp = routeMap[page]
          return <Suspense fallback={<LoadingModule />}><Comp /></Suspense>
        }
        return <Dashboard />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F5F6FA', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: '#1E40AF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>V</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{nomEntreprise}</span>
          {isSuperAdmin && (
            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>SUPER ADMIN</span>
          )}
          {!isSuperAdmin && profile?.role === 'admin' && (
            <span style={{ background: '#EEF2FF', color: '#3730A3', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>ADMIN</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isSuperAdmin && (
            <button onClick={() => navigate('superadmin')} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
              🛡️ Super Admin
            </button>
          )}
          <button onClick={signOut} title="Se deconnecter" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#DC2626', fontWeight: 500 }}>
            ⏻ Se deconnecter
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(m => !m)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#1E40AF', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {initiales}
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 0', minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200 }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{prenomDisplay} {profile?.nom || ''}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{user?.email}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{profile?.role || 'employe'}</div>
                </div>
                {isSuperAdmin && (
                  <button onClick={() => { setShowUserMenu(false); navigate('superadmin') }} style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    🛡️ Super Admin
                  </button>
                )}
                <button onClick={() => { setShowUserMenu(false); signOut() }} style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#DC2626' }}>
                  ⏻ Se deconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <nav style={{ width: 220, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', paddingTop: 16, flexShrink: 0, overflowY: 'auto' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => navigate(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: page === item.id ? '#EEF2FF' : 'none', border: 'none', borderLeft: page === item.id ? '3px solid #1E40AF' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: page === item.id ? 600 : 400, color: page === item.id ? '#1E40AF' : '#374151', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {renderPage()}
        </main>
      </div>

      {/* Mobile nav */}
      <nav style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', padding: '8px 0', zIndex: 50 }} className="mobile-nav">
        {navItems.slice(0, 7).map(item => (
          <button key={item.id} onClick={() => navigate(item.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: page === item.id ? '#1E40AF' : '#6B7280', fontSize: 10 }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.color, color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}
