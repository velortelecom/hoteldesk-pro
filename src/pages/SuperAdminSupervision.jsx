import { useEffect, useMemo, useState } from 'react'
import { buildAuditActionLabel, buildSupervisionSnapshot, filterAuditEvents } from './superAdminAudit'

const PAGE_SIZE = 50

function Card({ title, value, subtitle, color = '#111827' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}

function EmptyState({ title, description }) {
  return (
    <div style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6B7280' }}>
      <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  )
}

export default function SuperAdminSupervision({ supabase, profile }) {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [health, setHealth] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [referenceData, setReferenceData] = useState({ entreprises: [], profiles: [], modules: [], sites: [] })
  const [filters, setFilters] = useState({
    entrepriseId: '',
    action: '',
    actor: '',
    search: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    let mounted = true
    async function loadReferenceData() {
      try {
        const [ents, profiles, modules, sites, healthRes] = await Promise.all([
          supabase.from('entreprises').select('id, nom, slug, actif, plan, secteur').order('nom'),
          supabase.from('profiles').select('id, entreprise_id, prenom, nom, role, actif, is_super_admin').order('nom'),
          supabase.from('entreprise_modules').select('entreprise_id, module_id, actif'),
          supabase.from('sites').select('id, entreprise_id, nom, actif'),
          supabase.rpc('super_admin_platform_health'),
        ])
        if (!mounted) return
        if (!healthRes.error) {
          const healthData = Array.isArray(healthRes.data) ? (healthRes.data[0] || null) : (healthRes.data || null)
          setHealth(healthData)
        }
        setReferenceData({
          entreprises: ents.data || [],
          profiles: profiles.data || [],
          modules: modules.data || [],
          sites: sites.data || [],
        })
      } catch (err) {
        if (mounted) setError(err.message)
      }
    }

    loadReferenceData()
    return () => { mounted = false }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    async function loadEvents() {
      setLoading(true)
      setError(null)
      setHasMore(true)
      setPage(0)
      try {
        const { data, error: fetchError } = await supabase
          .from('audit_events')
          .select('id, acteur_profile_id, acteur_email, entreprise_id, action, type_cible, cible_id, description, metadonnees, adresse_ip, user_agent, created_at')
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1)
        if (!mounted) return
        setEvents(fetchError ? [] : (data || []))
        setHasMore((data || []).length === PAGE_SIZE)
      } catch {
        if (mounted) {
          setEvents([])
          setHasMore(false)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadEvents()
    return () => { mounted = false }
  }, [supabase])

  const snapshot = useMemo(() => buildSupervisionSnapshot({
    entreprises: referenceData.entreprises,
    profiles: referenceData.profiles,
    modules: referenceData.modules,
    sites: referenceData.sites,
    events,
  }), [referenceData, events])

  const visibleEvents = useMemo(() => filterAuditEvents(events, filters, profile), [events, filters, profile])
  const visibleCriticalIncidents = snapshot.criticalIncidents.filter(evt => filterAuditEvents([evt], filters, profile).length > 0)

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const from = nextPage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error: fetchError } = await supabase
        .from('audit_events')
        .select('id, acteur_profile_id, acteur_email, entreprise_id, action, type_cible, cible_id, description, metadonnees, adresse_ip, user_agent, created_at')
        .order('created_at', { ascending: false })
        .range(from, to)
      if (fetchError) throw fetchError
      setEvents(prev => [...prev, ...(data || [])])
      setPage(nextPage)
      setHasMore((data || []).length === PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const actions = Array.from(new Set(events.map(evt => evt.action).filter(Boolean))).sort()

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Card title="Entreprises totales" value={health?.total_entreprises ?? snapshot.totalEntreprises} color="#1E40AF" />
        <Card title="Entreprises actives/suspendues" value={(health?.entreprises_actives ?? snapshot.activeEntreprises) + ' / ' + (health?.entreprises_suspendues ?? snapshot.suspendedEntreprises)} color="#0F766E" />
        <Card title="Utilisateurs totaux" value={health?.total_users ?? snapshot.totalUsers} color="#6D28D9" />
        <Card title="Utilisateurs désactivés" value={health?.users_desactives ?? snapshot.disabledUsers.length} color="#047857" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Card title="Entreprises sans admin" value={health?.entreprises_sans_admin ?? snapshot.entrepriseSansAdmin.length} color="#B45309" />
        <Card title="Entreprises sans site" value={health?.entreprises_sans_site ?? snapshot.entrepriseSansSite.length} color="#B91C1C" />
        <Card title="Modules actifs" value={health?.modules_actifs ?? snapshot.activeModules} color="#1D4ED8" />
        <Card title="Erreurs de configuration" value={health?.alertes_configuration ?? snapshot.configIssues.length} color="#B91C1C" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>Journal d’audit</h2>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Supervision en lecture seule, sans suppression ni modification.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={filters.entrepriseId} onChange={e => setFilters(f => ({ ...f, entrepriseId: e.target.value }))} style={selectStyle}>
                <option value="">Toutes les entreprises</option>
                {referenceData.entreprises.map(ent => <option key={ent.id} value={ent.id}>{ent.nom}</option>)}
              </select>
              <select value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))} style={selectStyle}>
                <option value="">Toutes les actions</option>
                {actions.map(action => <option key={action} value={action}>{buildAuditActionLabel(action)}</option>)}
              </select>
              <input value={filters.actor} onChange={e => setFilters(f => ({ ...f, actor: e.target.value }))} placeholder="Utilisateur" style={inputStyle} />
              <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Recherche" style={inputStyle} />
              <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} style={inputStyle} />
              <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {loading && <EmptyState title="Chargement des événements" description="Lecture du journal d’audit en cours..." />}
          {error && !loading && <EmptyState title="Erreur réseau" description={error} />}
          {!loading && !error && visibleEvents.length === 0 && <EmptyState title="Aucun événement" description="Aucun audit ne correspond aux filtres actuels." />}

          {!loading && !error && visibleEvents.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              {visibleEvents.map(evt => {
                const enterprise = referenceData.entreprises.find(ent => ent.id === evt.entreprise_id)
                return (
                  <div key={evt.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, background: '#FAFAFB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#111827' }}>{buildAuditActionLabel(evt.action)}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{evt.description}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', textAlign: 'right' }}>
                        <div>{new Date(evt.created_at).toLocaleString('fr-FR')}</div>
                        <div>{enterprise?.nom || 'Toutes entreprises'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <Tag>{evt.type_cible}</Tag>
                      {evt.acteur_email && <Tag>{evt.acteur_email}</Tag>}
                      {evt.cible_id && <Tag>{evt.cible_id}</Tag>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button onClick={loadMore} disabled={!hasMore || loadingMore} style={buttonStyle}>
              {loadingMore ? 'Chargement...' : hasMore ? 'Charger plus' : 'Plus de résultats'}
            </button>
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 16 }}>
          <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Statut des entreprises</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <Tag>Période limitée au périmètre RLS</Tag>
              <Tag>{health?.entreprises_actives ?? snapshot.activeEntreprises} actives</Tag>
              <Tag>{health?.entreprises_suspendues ?? snapshot.suspendedEntreprises} suspendues</Tag>
              <Tag>{health?.total_users ?? snapshot.totalUsers} utilisateurs</Tag>
            </div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Erreurs de configuration</h3>
            {snapshot.configIssues.length === 0 ? (
              <EmptyState title="Aucune alerte" description="Aucun écart de configuration détecté." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {snapshot.configIssues.slice(0, 8).map(issue => (
                  <Tag key={issue.entreprise_id + issue.type}>{issue.nom} · {issue.type === 'sans_admin' ? 'sans admin' : issue.type === 'sans_site' ? 'sans site' : 'sans module'}</Tag>
                ))}
              </div>
            )}
          </section>

          <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Derniers incidents métier</h3>
            {visibleCriticalIncidents.length === 0 ? (
              <EmptyState title="Aucun incident" description="Aucun incident critique dans le filtre courant." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {visibleCriticalIncidents.slice(0, 8).map(evt => (
                  <Tag key={evt.id}>{buildAuditActionLabel(evt.action)} · {new Date(evt.created_at).toLocaleDateString('fr-FR')}</Tag>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function Tag({ children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 10px', background: '#EEF2FF', color: '#3730A3', fontSize: 12, fontWeight: 600 }}>{children}</span>
}

const selectStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 13, minWidth: 180 }
const inputStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 13, minWidth: 150 }
const buttonStyle = { border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 14px', background: '#fff', cursor: 'pointer', fontSize: 13 }
