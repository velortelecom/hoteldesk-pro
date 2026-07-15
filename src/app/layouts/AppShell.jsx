import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useModules } from '../../hooks/useModules'
import { buildLoadedModules, buildNavItems } from '../../modules/loader'
import { SOCLE_MENUS } from '../../lib/modules'
import { getPageIdFromPath, getPagePath, buildRouteEntries } from '../router/routeConfig'
import { canAccessSuperAdmin, getPermissionsForModule, isAdminLike } from '../../lib/permissions'
import { ErrorBoundary } from '../../components/shared/ErrorBoundary'
import { supabase } from '../../lib/supabase'
import Login from '../../pages/Login'
import Planning from '../../pages/Planning'
import Taches from '../../pages/Taches'
import Messagerie from '../../pages/Messagerie'
import Rappels from '../../pages/Rappels'
import Personnel from '../../pages/Personnel'
import Dashboard from '../../pages/Dashboard'
import SuperAdmin from '../../pages/SuperAdmin'
import { ModuleNonAutorise } from '../../pages/ModuleEnPreparation'
import { BrandMark } from '../../branding/Brand'

const CongesModule = lazy(() => import('../../modules/conges/index.jsx'))

const MOBILE_STYLE = `
  @media (max-width: 768px) {
    .desktop-nav { display: none !important; }
    .mobile-nav { display: flex !important; }
    .main-content { padding-bottom: 70px !important; }
  }
`

function MobileStyles() {
  return <style>{MOBILE_STYLE}</style>
}

function LoadingModule() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}><BrandMark size={40} radius={10} /><br />Chargement...</div>
}

function ModuleRouteRenderer({ entry, profile }) {
  const Comp = entry.composant || entry
  return (
    <Suspense fallback={<LoadingModule />}>
      <Comp permissions={entry.permissions || getPermissionsForModule(entry.id, profile)} profile={profile} />
    </Suspense>
  )
}

export default function AppShell() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { modulesActifs } = useModules()
  const location = useLocation()
  const navigate = useNavigate()
  const [toasts, setToasts] = useState([])
  const [nomEntreprise, setNomEntreprise] = useState('Velor One')
  const [showUserMenu, setShowUserMenu] = useState(false)

  const loadedModules = useMemo(() => buildLoadedModules(modulesActifs, profile), [modulesActifs, profile])
  const currentPageId = getPageIdFromPath(location.pathname, loadedModules) || 'dashboard'
  const superAdminEnabled = canAccessSuperAdmin(profile)
  const adminLike = isAdminLike(profile)

  useEffect(() => {
    setShowUserMenu(false)
  }, [location.pathname])

  useEffect(() => {
    if (profile?.entreprise_id) {
      supabase.from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        .then(({ data }) => { if (data?.nom) setNomEntreprise(data.nom) })
    }
  }, [profile?.entreprise_id])

  useEffect(() => {
    if (profile?.id && (profile.prenom === 'Nouveau' || !profile.prenom)) {
      const emailParts = user?.email?.split('@')[0]?.split('_') || []
      const autoPrenom = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Admin'
      supabase.from('profiles').update({ prenom: autoPrenom }).eq('id', profile.id)
    }
  }, [profile?.id, profile?.prenom, user?.email])

  useEffect(() => {
    if (profile && !profile.is_super_admin && location.pathname === '/superadmin') {
      navigate('/', { replace: true })
    }
  }, [profile, location.pathname, navigate])

  function goToPage(pageId) {
    navigate(getPagePath(pageId, loadedModules))
    setShowUserMenu(false)
  }

  if (authLoading) {
    return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}><BrandMark size={64} radius={16} /><div style={{ fontSize: 14, color: '#aaa' }}>Chargement...</div></div>
  }

  if (!user) return <Login />

  const socleNavItems = SOCLE_MENUS.map((item) => ({ id: item.id, label: item.label || item.nom, icon: item.icone || '' }))
  const moduleNavItems = buildNavItems(loadedModules).map((item) => ({ id: item.id, label: item.label || item.nom, icon: item.icone || '' }))
  const moduleIds = moduleNavItems.map((item) => item.id)
  const uniqueSocle = socleNavItems.filter((item) => !moduleIds.includes(item.id))
  const superAdminItem = superAdminEnabled ? [{ id: 'superadmin', label: 'Super Admin', icon: '🛡' }] : []
  const congesItem = adminLike && !moduleIds.includes('conges') ? [{ id: 'conges', label: 'Congés & Absences', icon: '🏖' }] : []
  const navItems = [...superAdminItem, ...uniqueSocle, ...moduleNavItems, ...congesItem]
  const routeEntries = buildRouteEntries(loadedModules)

  const prenomDisplay = profile?.prenom && profile.prenom !== 'Nouveau' ? profile.prenom : (user?.email?.split('@')[0] || 'Admin')
  const initiales = profile?.avatar_initiales || (prenomDisplay[0] + (profile?.nom?.[0] || '')).toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F5F6FA', fontFamily: "'Inter', sans-serif" }}>
      <MobileStyles />
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={32} radius={8} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{nomEntreprise}</span>
          {superAdminEnabled && <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>SUPER ADMIN</span>}
          {!superAdminEnabled && profile?.role === 'admin' && <span style={{ background: '#EEF2FF', color: '#3730A3', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>ADMIN</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {superAdminEnabled && (
            <button onClick={() => goToPage('superadmin')} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
              🛡 Super Admin
            </button>
          )}
          <button onClick={signOut} title="Se deconnecter" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#DC2626', fontWeight: 500 }}>
            ⏻ Se deconnecter
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu((open) => !open)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#1E40AF', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {initiales}
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 0', minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200 }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{prenomDisplay} {profile?.nom || ''}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{user?.email}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{profile?.role || 'employe'}</div>
                </div>
                {superAdminEnabled && (
                  <button onClick={() => goToPage('superadmin')} style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    🛡 Super Admin
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
        <nav className="desktop-nav" style={{ width: 220, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', paddingTop: 16, flexShrink: 0, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => goToPage(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: currentPageId === item.id ? '#EEF2FF' : 'none', border: 'none', borderLeft: currentPageId === item.id ? '3px solid #1E40AF' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: currentPageId === item.id ? 600 : 400, color: currentPageId === item.id ? '#1E40AF' : '#374151', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/taches" element={<Taches />} />
              <Route path="/messages" element={profile?.entreprise_id ? <Messagerie /> : <Navigate to="/" replace />} />
              <Route path="/messagerie" element={<Navigate to="/messages" replace />} />
              <Route path="/rappels" element={<Rappels />} />
              <Route path="/personnel" element={<Navigate to="/equipe" replace />} />
              <Route path="/equipe" element={<Personnel />} />
              <Route path="/conges" element={adminLike ? <Suspense fallback={<LoadingModule />}><CongesModule permissions={getPermissionsForModule('conges', profile)} profile={profile} /></Suspense> : <ModuleNonAutorise />} />
              <Route path="/superadmin" element={superAdminEnabled ? <SuperAdmin /> : <Navigate to="/" replace />} />
              {routeEntries.map((entry) => (
                <Route key={entry.id} path={entry.routePath} element={<ModuleRouteRenderer entry={entry} profile={profile} />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      <footer style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderTop: '1px solid #E5E7EB', flexShrink: 0 }}><BrandMark size={16} radius={4} />Velor One</footer>

      <nav className="mobile-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', padding: '8px 0', zIndex: 50 }}>
        {navItems.slice(0, 7).map((item) => (
          <button key={item.id} onClick={() => goToPage(item.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: currentPageId === item.id ? '#1E40AF' : '#6B7280', fontSize: 10 }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ background: toast.color, color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
        ))}
      </div>
    </div>
  )
}