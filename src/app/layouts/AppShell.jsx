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
import { fetchRecentNotifications, fetchUnreadNotificationCount, markNotificationRead } from '../../services/notifications'
import { closeAssistanceSession, fetchAssistanceState } from '../../services/superadmin/assistanceService'
import Login from '../../pages/Login'
import Planning from '../../pages/Planning'
import Taches from '../../pages/Taches'
import Messagerie from '../../pages/Messagerie'
import Rappels from '../../pages/Rappels'
import Personnel from '../../pages/Personnel'
import Dashboard from '../../pages/Dashboard'
import SuperAdminConsole from '../../pages/SuperAdminConsole'
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
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [globalAssistanceSession, setGlobalAssistanceSession] = useState(null)

  const loadedModules = useMemo(() => buildLoadedModules(modulesActifs, profile), [modulesActifs, profile])
  const currentPageId = getPageIdFromPath(location.pathname, loadedModules) || 'dashboard'
  const superAdminEnabled = canAccessSuperAdmin(profile)
  const adminLike = isAdminLike(profile)
  const isSuperAdminRoute = location.pathname.startsWith('/superadmin')

  useEffect(() => {
    setShowUserMenu(false)
    setShowNotifications(false)
  }, [location.pathname])

  useEffect(() => {
    if (!profile?.id) return
    loadNotifications()
  }, [profile?.id])

  useEffect(() => {
    if (profile?.entreprise_id) {
      supabase.from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        .then(({ data }) => { if (data?.nom) setNomEntreprise(data.nom) })
    }
  }, [profile?.entreprise_id])

  useEffect(() => {
    let mounted = true
    let intervalId = null

    async function loadGlobalAssistance() {
      if (!profile?.id || !profile?.is_super_admin) {
        if (mounted) setGlobalAssistanceSession(null)
        return
      }

      try {
        const state = await fetchAssistanceState(supabase, profile.id)
        if (!mounted) return
        setGlobalAssistanceSession(state.activeSession || null)
      } catch {
        if (mounted) setGlobalAssistanceSession(null)
      }
    }

    loadGlobalAssistance()
    if (profile?.id && profile?.is_super_admin) {
      intervalId = window.setInterval(loadGlobalAssistance, 30000)
    }

    return () => {
      mounted = false
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [profile?.id, profile?.is_super_admin, location.pathname])

  useEffect(() => {
    if (profile?.id && (profile.prenom === 'Nouveau' || !profile.prenom)) {
      const emailParts = user?.email?.split('@')[0]?.split('_') || []
      const autoPrenom = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Admin'
      supabase.from('profiles').update({ prenom: autoPrenom }).eq('id', profile.id)
    }
  }, [profile?.id, profile?.prenom, user?.email])

  useEffect(() => {
    if (profile && !profile.is_super_admin && location.pathname.startsWith('/superadmin')) {
      navigate('/', { replace: true })
    }
  }, [profile, location.pathname, navigate])

  function goToPage(pageId) {
    navigate(getPagePath(pageId, loadedModules))
    setShowUserMenu(false)
    setShowNotifications(false)
  }

  async function loadNotifications() {
    try {
      const [items, count] = await Promise.all([
        fetchRecentNotifications(profile),
        fetchUnreadNotificationCount(profile),
      ])
      setNotifications(items)
      setUnreadCount(count)
    } catch (error) {
      console.error('notifications:', error)
    }
  }

  async function handleOpenNotification(notification) {
    if (!notification.read_at) {
      await markNotificationRead(notification.id)
      await loadNotifications()
    }
    setShowNotifications(false)
    if (notification.link) navigate(notification.link)
  }

  async function handleExitGlobalAssistance() {
    if (!globalAssistanceSession?.id || !profile?.id) return
    try {
      await closeAssistanceSession(supabase, { sessionId: globalAssistanceSession.id, actorProfileId: profile.id })
      const state = await fetchAssistanceState(supabase, profile.id)
      setGlobalAssistanceSession(state.activeSession || null)
    } catch {
      // no-op: fallback remains available from Assistance page
    }
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
  const navItems = isSuperAdminRoute ? [] : [...superAdminItem, ...uniqueSocle, ...moduleNavItems, ...congesItem]
  const routeEntries = buildRouteEntries(loadedModules)

  const prenomDisplay = profile?.prenom && profile.prenom !== 'Nouveau' ? profile.prenom : (user?.email?.split('@')[0] || 'Admin')
  const initiales = profile?.avatar_initiales || (prenomDisplay[0] + (profile?.nom?.[0] || '')).toUpperCase()
  const assistanceRemainingMs = globalAssistanceSession?.expires_at
    ? new Date(globalAssistanceSession.expires_at).getTime() - Date.now()
    : null
  const assistanceRemainingMin = assistanceRemainingMs !== null ? Math.max(0, Math.ceil(assistanceRemainingMs / 60000)) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F5F6FA', fontFamily: "'Inter', sans-serif" }}>
      <MobileStyles />
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={32} radius={8} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{isSuperAdminRoute ? 'Velor Super Admin' : nomEntreprise}</span>
          {superAdminEnabled && <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>SUPER ADMIN</span>}
          {!superAdminEnabled && profile?.role === 'admin' && <span style={{ background: '#EEF2FF', color: '#3730A3', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>ADMIN</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {superAdminEnabled && !isSuperAdminRoute && (
            <button onClick={() => goToPage('superadmin')} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
              🛡 Super Admin
            </button>
          )}
          {superAdminEnabled && isSuperAdminRoute && (
            <button onClick={() => navigate('/')} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#1D4ED8' }}>
              Retour espace entreprise
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications((open) => !open)} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 999, width: 36, height: 36, cursor: 'pointer', fontSize: 16, position: 'relative' }}>
              🔔
              {unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, minWidth: 320, maxWidth: 360, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 220, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', fontWeight: 600, fontSize: 13 }}>Notifications</div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notifications.length === 0 && <div style={{ padding: '14px', fontSize: 12, color: '#6B7280' }}>Aucune notification.</div>}
                  {notifications.map((notification) => (
                    <button key={notification.id} onClick={() => handleOpenNotification(notification)} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid #F3F4F6', background: notification.read_at ? '#fff' : '#EFF6FF', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{notification.title}</div>
                      {notification.content && <div style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>{notification.content}</div>}
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{new Date(notification.created_at).toLocaleString('fr-FR')}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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

      {globalAssistanceSession && (
        <div style={{ background: '#FFF7ED', borderBottom: '1px solid #FDBA74', color: '#9A3412', padding: '8px 24px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>
            Assistance active · entreprise {globalAssistanceSession.entreprise_id || 'n/a'} · {globalAssistanceSession.readonly_mode ? 'lecture seule' : 'modification'} · motif: {globalAssistanceSession.reason || 'n/a'} · temps restant: {assistanceRemainingMin !== null ? `${assistanceRemainingMin} min` : 'n/a'}
          </span>
          <button onClick={handleExitGlobalAssistance} style={{ border: '1px solid #F59E0B', background: '#fff', color: '#B45309', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Quitter le mode assistance
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <nav className="desktop-nav" style={{ width: isSuperAdminRoute ? 0 : 220, background: '#fff', borderRight: isSuperAdminRoute ? 'none' : '1px solid #E5E7EB', display: isSuperAdminRoute ? 'none' : 'flex', flexDirection: 'column', paddingTop: 16, flexShrink: 0, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => goToPage(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: currentPageId === item.id ? '#EEF2FF' : 'none', border: 'none', borderLeft: currentPageId === item.id ? '3px solid #1E40AF' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: currentPageId === item.id ? 600 : 400, color: currentPageId === item.id ? '#1E40AF' : '#374151', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: isSuperAdminRoute ? 0 : 24 }}>
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
              <Route path="/conges" element={loadedModules.some((m) => m.id === 'conges') ? <Suspense fallback={<LoadingModule />}><CongesModule permissions={getPermissionsForModule('conges', profile)} profile={profile} /></Suspense> : <ModuleNonAutorise />} />
              <Route path="/superadmin/*" element={superAdminEnabled ? <SuperAdminConsole /> : <Navigate to="/" replace />} />
              {routeEntries.map((entry) => (
                <Route key={entry.id} path={entry.routePath} element={<ModuleRouteRenderer entry={entry} profile={profile} />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      <footer style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderTop: '1px solid #E5E7EB', flexShrink: 0 }}><BrandMark size={16} radius={4} />Velor One</footer>

      {!isSuperAdminRoute && (
        <nav className="mobile-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', padding: '8px 0', zIndex: 50 }}>
          {navItems.slice(0, 7).map((item) => (
            <button key={item.id} onClick={() => goToPage(item.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: currentPageId === item.id ? '#1E40AF' : '#6B7280', fontSize: 10 }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ background: toast.color, color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
        ))}
      </div>
    </div>
  )
}
