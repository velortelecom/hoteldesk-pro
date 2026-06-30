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
function ModuleLoading() {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 14 }}>Chargement du module...</div>
    </div>
  )
}

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
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { modulesActifs, catalogue } = useModules()
  const [page, setPage] = useState(() => window.location.hash.replace('#', '') || 'dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [nomEntreprise, setNomEntreprise] = useState('Velor One')

  useEffect(() => {
    if (profile?.entreprise_id) {
      supabase.from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        .then(({ data }) => { if (data?.nom) setNomEntreprise(data.nom) })
    }
  }, [profile?.entreprise_id])

  // Sync URL hash -> page (navigation arriere/avant)
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '') || 'dashboard';
      setPage(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Sync page -> URL hash
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== page) {
      window.location.hash = page;
    }
  }, [page]);

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

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>V</div>
      <div style={{ fontSize: 13, color: '#aaa' }}>Chargement...</div>
    </div>
  )

  if (!user) return <Login />

  // === PLUGIN SYSTEM V4 ===
  // buildLoadedModules : croise BDD actifs + registre local, applique permissions
  const modulesCharges = buildLoadedModules(modulesActifs, profile)
  // buildNavItems : genere les items de navigation depuis les modules charges
  const navModules = buildNavItems(modulesCharges)
  // buildRouteMap : map id -> { composant, permissions, nom, icone }
  const routeMap = buildRouteMap(modulesCharges)

  // Navigation complete : socle inalterable + modules actifs
  const NAV = [...SOCLE_MENUS, ...navModules]

  // Pages du socle (toujours chargees)
  const SOCLE_PAGES = {
    dashboard: <Dashboard />,
    planning: <Planning />,
    taches: <Taches />,
    messagerie: <Messagerie />,
    rappels: <Rappels />,
    personnel: <Personnel />,
    superadmin: profile?.is_super_admin ? <SuperAdmin /> : <Dashboard />,
  }

  // Resolution de la page courante
  function resolvePage(pageId) {
    // 1. Pages socle : toujours accessibles
    if (SOCLE_PAGES[pageId]) return SOCLE_PAGES[pageId]

    // 2. Module actif -> charge en lazy avec Suspense
    const route = routeMap[pageId]
    if (route) {
      const Composant = route.composant
      return (
        <Suspense fallback={<ModuleLoading />}>
          <Composant
            permissions={route.permissions}
            profile={profile}
            moduleId={pageId}
          />
        </Suspense>
      )
    }

    // 3. Module existe dans le catalogue mais pas actif pour cette entreprise
    const modCatalogue = catalogue.find(m => m.id === pageId)
    if (modCatalogue) {
      return <ModuleNonAutorise moduleId={modCatalogue.id} nom={modCatalogue.nom} />
    }

    // 4. Fallback : dashboard
    return <Dashboard />
  }

  const couleurProfil = profile?.couleur || '#185FA5'
  const initiales = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()
  const pageNav = NAV.find(n => n.id === page)
  const pageTitre = pageNav?.label || pageNav?.nom || (page === 'superadmin' && profile?.is_super_admin ? 'Super Admin' : 'Accueil')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Toast toasts={toasts} remove={removeToast} />

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0dfd8', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ width: 28, height: 28, background: '#185FA5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>V</div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{nomEntreprise}</span>
          <span style={{ fontSize: 13, color: '#888', marginLeft: 2 }}>— {pageTitre}</span>
          {profile?.is_super_admin && (
            <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700, marginLeft: 8 }}>SUPER ADMIN</span>
          )}
        </div>
        {profile && (
          <div onClick={() => setMenuOpen(!menuOpen)} style={{
            width: 32, height: 32, borderRadius: '50%', background: couleurProfil + '22',
            border: '2px solid ' + couleurProfil, color: couleurProfil,
            fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            {initiales}
          </div>
        )}
      </div>

      {/* Menu profil */}
      {menuOpen && (
        <div>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{ position: 'fixed', top: 60, right: 12, background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: 14, zIndex: 100, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: couleurProfil + '22', border: '2px solid ' + couleurProfil, color: couleurProfil, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {initiales}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.prenom} {profile?.nom}</div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>{profile?.role} — {profile?.departement}</div>
              </div>
            </div>
            {profile?.is_super_admin && (
              <button onClick={() => { setPage('superadmin'); setMenuOpen(false) }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                Super Admin
              </button>
            )}
            <button onClick={() => { signOut(); setMenuOpen(false) }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: '#FEF2F2', color: '#EF4444', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              Deconnexion
            </button>
          </div>
        </div>
      )}

      {/* Contenu */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 80px' }}>
        {resolvePage(page)}
      </div>

      {/* Navigation bas : socle inalterable + modules actifs */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '0.5px solid #e0dfd8',
        display: 'flex',
        overflowX: NAV.length > 6 ? 'auto' : 'visible',
        justifyContent: NAV.length <= 6 ? 'space-around' : 'flex-start',
        alignItems: 'center',
        padding: '8px ' + (NAV.length > 6 ? '8px' : '0') + ' 12px',
        zIndex: 40, scrollbarWidth: 'none',
      }}>
        {NAV.map(item => {
          const isActive = page === item.id
          const emoji = ICONES_SOCLE[item.id] || item.icone || '🧩'
          const couleur = isActive ? (item.couleur || couleurProfil) : '#9CA3AF'
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 8, color: couleur,
              minWidth: 52, flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>{emoji}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap' }}>
                {item.label || item.nom}
              </span>
              {item.badge && (
                <span style={{ fontSize: 7, background: item.couleur || '#374151', color: 'white', borderRadius: 6, padding: '1px 4px', fontWeight: 700, marginTop: -2 }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
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
