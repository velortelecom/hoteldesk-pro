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
  dashboard: 'ð ', planning: 'ð', taches: 'â',
  messagerie: 'ð¬', rappels: 'ð', personnel: 'ð¥',
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
  const [page, setPage] = useState(() => window.location.hash.replace('#', '') || 'dashboard')
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
  const navItems = buildNavItems(loadedModules, ICONES_SOCLE, SOCLE_MENUS, isSuperAdmin)
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
    if (!isSuperAdmin && page === 'superadmin') return <div style={{ padding: 40, color: '#EF4444', fontWeight: 600 }}>Acces refuse</div>

    if (!canAccessRoute(page, loadedModules, routeMap)) {
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

  const pageTitle = navItems.find(n => n.page === page)?.label || (page === 'superadmin' ? 'Super Admin' : 'Accueil')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f5f4ef', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ height: 48, background: '#fff', borderBottom: '0.5px solid #e0dfd8', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {nomEntreprise[0]}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{nomEntreprise}</div>
          <div style={{ fontSize: 12, color: '#aaa' }}>â {pageTitle}</div>
          {isSuperAdmin && (
            <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>SUPER ADMIN</span>
          )}
        </div>

        {/* Bouton deconnexion visible */}
        <button
          onClick={() => signOut()}
          title="Se deconnecter"
          style={{ padding: '5px 12px', background: 'none', border: '0.5px solid #e0dfd8', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <span>â»</span> <span style={{ display: 'none', '@media(min-width:600px)': { display: 'inline' } }}>Quitter</span>
        </button>

        {/* Avatar + menu profil */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{ width: 34, height: 34, borderRadius: '50%', background: profile?.couleur ? profile.couleur + '22' : '#E6F1FB', border: '2px solid ' + (profile?.couleur || '#185FA5'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: profile?.couleur || '#185FA5', cursor: 'pointer' }}
          >
            {initiales}
          </button>
          {showUserMenu && (
            <div style={{ position: 'absolute', right: 0, top: 42, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: 8, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,.12)', minWidth: 200 }}>
              <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #f0efe8', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{prenomDisplay} {profile?.nom || ''}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{user?.email}</div>
                <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 2, textTransform: 'uppercase', fontWeight: 600 }}>{profile?.role || 'employe'}</div>
              </div>
              {isSuperAdmin && (
                <button onClick={() => navigate('superadmin')} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#185FA5', borderRadius: 6 }}>
                  âï¸ Super Admin
                </button>
              )}
              <button onClick={() => { signOut(); setShowUserMenu(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#FEF2F2', padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#EF4444', borderRadius: 6, marginTop: 2, fontWeight: 600 }}>
                â» Se deconnecter
              </button>
            </div>
          )}
          {showUserMenu && <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '0 16px 80px' }}>
        {renderPage()}
      </main>

      {/* Bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e0dfd8', display: 'flex', overflowX: 'auto', zIndex: 20, flexShrink: 0 }}>
        {navItems.map(item => (
          <button
            key={item.page}
            onClick={() => navigate(item.page)}
            style={{
              flex: '0 0 auto', minWidth: 60, padding: '6px 8px 4px', border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: page === item.page ? '#185FA5' : '#888',
              borderTop: page === item.page ? '2px solid #185FA5' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 9, fontWeight: page === item.page ? 600 : 400, whiteSpace: 'nowrap' }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Toasts */}
      <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.color, color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxWidth: 280, lineHeight: 1.4,
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
