// src/App.jsx
// Velor One - V3 : navigation dynamique connectee via useModules()
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useModules } from './hooks/useModules'
import { supabase } from './lib/supabase'
import { SOCLE_MENUS } from './lib/modules'
import Login from './pages/Login'
import Planning from './pages/Planning'
import Taches from './pages/Taches'
import Messagerie from './pages/Messagerie'
import Rappels from './pages/Rappels'
import Personnel from './pages/Personnel'
import Dashboard from './pages/Dashboard'
import SuperAdmin from './pages/SuperAdmin'
import ModuleEnPreparation, { ModuleNonAutorise } from './pages/ModuleEnPreparation'

// Icones emoji par id de menu
const ICONES = {
  dashboard: '🏠', planning: '📅', taches: '✅',
  messagerie: '💬', rappels: '🔔', personnel: '👥',
  conges: '🏖', gps: '📍', documents: '📄', vehicules: '🚗',
  ia: '🤖', stocks: '📦', facturation: '🧾', reservations: '📆',
  clients: '👥', qualite: '✅', formations: '🎓', securite: '🛡',
  rapports: '📊', planning_avance: '🗂', multi_sites: '🔀',
  api: '💻', white_label: '🎨',
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
  const { getModuleMenus, getActiveModuleIds, catalogue, loading: modulesLoading } = useModules()
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

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', fontWeight: 700 }}>V</div>
      <div style={{ fontSize: 13, color: '#aaa' }}>Chargement...</div>
    </div>
  )

  if (!user) return <Login />

  // --- Navigation ---
  // Socle inalterable toujours present
  const navSocle = SOCLE_MENUS
  // Modules dynamiques : uniquement ceux actives pour l'entreprise
  const navModules = getModuleMenus()
  // Nav complete
  const NAV = [...navSocle, ...navModules]

  // IDs des modules autorises (pour protection des routes)
  const activeModuleIds = getActiveModuleIds()

  // --- Pages du socle ---
  const SOCLE_PAGES = {
    dashboard: <Dashboard />,
    planning: <Planning />,
    taches: <Taches />,
    messagerie: <Messagerie />,
    rappels: <Rappels />,
    personnel: <Personnel />,
    superadmin: <SuperAdmin />,
  }

  // --- Resolution de la page courante ---
  function resolvePage(pageId) {
    // Pages socle : toujours accessibles
    if (SOCLE_PAGES[pageId]) return SOCLE_PAGES[pageId]

    // Super admin
    if (pageId === 'superadmin') return <SuperAdmin />

    // Module : verifier si actif
    const moduleActif = navModules.find(m => m.id === pageId)
    if (moduleActif) {
      // Module actif mais page pas encore developpee
      return <ModuleEnPreparation
        moduleId={moduleActif.id}
        nom={moduleActif.label}
        description={moduleActif.description}
        icone={moduleActif.icone}
      />
    }

    // Module existe dans le catalogue mais pas actif pour cette entreprise
    const moduleExiste = catalogue.find(m => m.id === pageId)
    if (moduleExiste) {
      return <ModuleNonAutorise moduleId={moduleExiste.id} nom={moduleExiste.nom} />
    }

    // Page inconnue : retour dashboard
    return <Dashboard />
  }

  const couleurProfil = profile?.couleur || '#185FA5'
  const initiales = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()

  // Titre de la page courante
  const pageNav = NAV.find(n => n.id === page)
  const pageTitre = pageNav?.label || (page === 'superadmin' ? 'Super Admin' : 'Accueil')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Toast toasts={toasts} remove={removeToast} />

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e0dfd8', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ width: 28, height: 28, background: '#185FA5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>V</div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Velor One</span>
          <span style={{ fontSize: 13, color: '#888', marginLeft: 2 }}>-- {pageTitre}</span>
          {profile?.is_super_admin && (
            <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700, marginLeft: 8 }}>
              SUPER ADMIN
            </span>
          )}
        </div>
        {profile && (
          <div onClick={() => setMenuOpen(!menuOpen)} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: couleurProfil + '22', border: '2px solid ' + couleurProfil,
            color: couleurProfil, fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0
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
                <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>{profile?.role} - {profile?.departement}</div>
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

      {/* Contenu principal */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 80px' }}>
        {resolvePage(page)}
      </div>

      {/* Navigation bas - Socle + modules actifs */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '0.5px solid #e0dfd8',
        display: 'flex',
        overflowX: NAV.length > 6 ? 'auto' : 'visible',
        justifyContent: NAV.length <= 6 ? 'space-around' : 'flex-start',
        alignItems: 'center',
        padding: '8px ' + (NAV.length > 6 ? '8px' : '0') + ' 12px',
        zIndex: 40,
        scrollbarWidth: 'none',
      }}>
        {NAV.map(item => {
          const isActive = page === item.id
          const emoji = ICONES[item.id] || '🧩'
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 8,
              color: isActive ? couleurProfil : '#9CA3AF',
              minWidth: 52, flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>{emoji}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap' }}>
                {item.label || item.nom}
              </span>
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
