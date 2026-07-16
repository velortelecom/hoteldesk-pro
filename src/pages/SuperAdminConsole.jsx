import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import SuperAdminShell from '../components/superadmin/SuperAdminShell'
import SuperAdminEnterprisesPanel from '../components/superadmin/SuperAdminEnterprisesPanel'
import SuperAdminModulesPanel from '../components/superadmin/SuperAdminModulesPanel'
import SuperAdminOffersPanel from '../components/superadmin/SuperAdminOffersPanel'
import SuperAdminSupportPanel from '../components/superadmin/SuperAdminSupportPanel'
import SuperAdminSettingsPanel from '../components/superadmin/SuperAdminSettingsPanel'
import { getSuperAdminSectionLabel } from '../components/superadmin/shellConfig'
import { fetchSuperAdminSnapshot, filterSnapshotEntreprises } from '../services/superadmin/superAdminCoreService'
import { closeAssistanceSession, fetchAssistanceState } from '../services/superadmin/assistanceService'
import SuperAdmin from './SuperAdmin'
import SuperAdminUsersPanel from './SuperAdminUsersPanel'
import SuperAdminSupervision from './SuperAdminSupervision'
import SuperAdminAssistance from './SuperAdminAssistance'
import SuperAdminPlatformHealth from './SuperAdminPlatformHealth'

const panelStyle = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }

function DashboardCard({ title, value, subtitle, color }) {
  return (
    <div style={{ ...panelStyle, borderLeft: '4px solid ' + color }}>
      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 27, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#94A3B8' }}>{subtitle}</div>
    </div>
  )
}

export default function SuperAdminConsole() {
  const { profile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snapshot, setSnapshot] = useState({ health: null, entreprises: [] })
  const [legacyMode, setLegacyMode] = useState(false)
  const [assistanceState, setAssistanceState] = useState({ backendState: 'ok', activeSession: null, rows: [] })

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const nextSnapshot = await fetchSuperAdminSnapshot(supabase)
        if (!mounted) return
        setSnapshot(nextSnapshot)
      } catch (loadError) {
        if (!mounted) return
        setError(loadError?.message || 'Chargement impossible')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    refreshAssistanceState()
  }, [profile?.id])

  async function reloadSnapshot() {
    setError(null)
    try {
      const nextSnapshot = await fetchSuperAdminSnapshot(supabase)
      setSnapshot(nextSnapshot)
    } catch (loadError) {
      setError(loadError?.message || 'Chargement impossible')
    }
  }

  async function refreshAssistanceState() {
    if (!profile?.id) return
    try {
      const state = await fetchAssistanceState(supabase, profile.id)
      setAssistanceState(state)
    } catch {
      setAssistanceState({ backendState: 'indisponible', activeSession: null, rows: [] })
    }
  }

  const filteredEntreprises = useMemo(
    () => filterSnapshotEntreprises(snapshot.entreprises, searchQuery),
    [snapshot.entreprises, searchQuery]
  )

  const assistanceActive = Boolean(assistanceState.activeSession)
  const breadcrumbs = ['Super Admin', getSuperAdminSectionLabel(activeSection)]
  const accountLabel = (profile?.prenom || user?.email || 'Compte') + ' / Deconnexion'

  function openLegacyEnterpriseManager() {
    setLegacyMode(true)
    setActiveSection('enterprises')
  }

  function closeLegacyMode() {
    setLegacyMode(false)
  }

  async function handleExitAssistance() {
    if (!assistanceState.activeSession?.id) {
      setActiveSection('assistance')
      return
    }

    try {
      await closeAssistanceSession(supabase, {
        sessionId: assistanceState.activeSession.id,
        actorProfileId: profile?.id,
      })
      await refreshAssistanceState()
      setActiveSection('dashboard')
    } catch {
      setActiveSection('assistance')
    }
  }

  function renderPlaceholder(title, description) {
    return (
      <section style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ color: '#64748B', marginBottom: 0 }}>{description}</p>
      </section>
    )
  }

  function renderContent() {
    if (loading) return <section style={panelStyle}>Chargement de la console...</section>
    if (error) return <section style={{ ...panelStyle, background: '#FEF2F2', color: '#991B1B' }}>{error}</section>

    if (activeSection === 'dashboard') {
      const health = snapshot.health || {}
      return (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <DashboardCard title='Entreprises' value={health.total_entreprises ?? snapshot.entreprises.length} subtitle={(health.entreprises_actives ?? 0) + ' actives'} color='#1D4ED8' />
            <DashboardCard title='Utilisateurs' value={health.total_users ?? 0} subtitle={(health.users_desactives ?? 0) + ' desactives'} color='#0891B2' />
            <DashboardCard title='Modules actifs' value={health.modules_actifs ?? 0} subtitle={(health.alertes_configuration ?? 0) + ' alertes'} color='#7C3AED' />
            <DashboardCard title='Incidents 24h' value={health.incidents_24h ?? 0} subtitle={(health.incidents_7j ?? 0) + ' sur 7 jours'} color='#B45309' />
          </section>
          <section style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Entreprises recentes</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredEntreprises.slice(0, 10).map((ent) => (
                <div key={ent.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 10, background: '#F8FAFC' }}>
                  <div style={{ fontWeight: 700 }}>{ent.nom}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{ent.slug} / plan {ent.plan} / {ent.actif === false ? 'suspendue' : 'active'}</div>
                </div>
              ))}
              {filteredEntreprises.length === 0 && <div style={{ color: '#94A3B8' }}>Aucune entreprise selon le filtre</div>}
            </div>
          </section>
        </>
      )
    }

    if (activeSection === 'enterprises') {
      if (legacyMode) {
        return (
          <section style={{ ...panelStyle, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={closeLegacyMode} style={{ border: '1px solid #CBD5E1', background: '#fff', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                Fermer mode legacy
              </button>
            </div>
            <SuperAdmin />
          </section>
        )
      }

      return (
        <SuperAdminEnterprisesPanel
          supabase={supabase}
          searchQuery={searchQuery}
          onOpenLegacyCreate={openLegacyEnterpriseManager}
          onOpenLegacyManager={openLegacyEnterpriseManager}
          onDataChanged={reloadSnapshot}
        />
      )
    }

    if (activeSection === 'users') {
      return <SuperAdminUsersPanel supabase={supabase} profile={profile} entreprises={snapshot.entreprises} />
    }

    if (activeSection === 'audit') {
      return <SuperAdminSupervision supabase={supabase} profile={profile} />
    }

    if (activeSection === 'platform') {
      return <SuperAdminPlatformHealth supabase={supabase} />
    }

    if (activeSection === 'assistance') {
      return (
        <SuperAdminAssistance
          entreprises={snapshot.entreprises}
          profile={profile}
          onSessionChange={(state) => setAssistanceState(state)}
        />
      )
    }

    if (activeSection === 'modules') {
      return <SuperAdminModulesPanel supabase={supabase} searchQuery={searchQuery} />
    }

    if (activeSection === 'offers') {
      return <SuperAdminOffersPanel supabase={supabase} searchQuery={searchQuery} />
    }

    if (activeSection === 'support') {
      return <SuperAdminSupportPanel supabase={supabase} searchQuery={searchQuery} entreprises={snapshot.entreprises} />
    }

    if (activeSection === 'settings') {
      return <SuperAdminSettingsPanel supabase={supabase} searchQuery={searchQuery} />
    }

    return null
  }

  return (
    <SuperAdminShell
      activeSection={activeSection}
      breadcrumbs={breadcrumbs}
      searchValue={searchQuery}
      onSearch={setSearchQuery}
      onSectionChange={(sectionId) => { setActiveSection(sectionId); setLegacyMode(false) }}
      onQuickCreate={openLegacyEnterpriseManager}
      onExitAssistance={handleExitAssistance}
      assistanceActive={assistanceActive}
      assistanceSession={assistanceState.activeSession}
      onSignOut={async () => { await signOut(); navigate('/') }}
      accountLabel={accountLabel}
    >
      {renderContent()}
    </SuperAdminShell>
  )
}
