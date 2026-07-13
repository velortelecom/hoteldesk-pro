import { useEffect, useState } from 'react'

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }
const tagStyle = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 10px', background: '#EEF2FF', color: '#3730A3', fontSize: 12, fontWeight: 600 }

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return '—'
  }
}

function Metric({ title, value, subtitle, accent = '#1D4ED8' }) {
  return (
    <div style={{ ...cardStyle, borderLeft: '4px solid ' + accent }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, marginTop: 4 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}

export default function SuperAdminPlatformHealth({ supabase, branchName = 'pointage-migration-draft' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [health, setHealth] = useState(null)
  const [migrations, setMigrations] = useState([])
  const [functions, setFunctions] = useState([])
  const [deployment, setDeployment] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [healthRes, auditRes, branchRes, migrationsRes, functionsRes] = await Promise.all([
          supabase.rpc('super_admin_platform_health'),
          supabase
            .from('audit_events')
            .select('id, action, type_cible, description, entreprise_id, acteur_email, created_at, adresse_ip')
            .order('created_at', { ascending: false })
            .limit(12),
          fetch('https://api.github.com/repos/velortelecom/hoteldesk-pro/commits?sha=' + encodeURIComponent(branchName) + '&per_page=1', { headers: { Accept: 'application/vnd.github+json' } }),
          fetch('https://api.github.com/repos/velortelecom/hoteldesk-pro/contents/supabase/migrations?ref=' + encodeURIComponent(branchName), { headers: { Accept: 'application/vnd.github+json' } }),
          fetch('https://api.github.com/repos/velortelecom/hoteldesk-pro/contents/supabase/functions?ref=' + encodeURIComponent(branchName), { headers: { Accept: 'application/vnd.github+json' } }),
        ])

        if (!mounted) return
        if (healthRes.error) throw healthRes.error
        if (auditRes.error) throw auditRes.error

        setHealth(healthRes.data || null)
        setRecentAudits(auditRes.data || [])

        const branchJson = await branchRes.json()
        const commit = Array.isArray(branchJson) ? branchJson[0] : null
        let statusData = null
        if (commit?.sha) {
          const statusRes = await fetch('https://api.github.com/repos/velortelecom/hoteldesk-pro/commits/' + commit.sha + '/status', { headers: { Accept: 'application/vnd.github+json' } })
          statusData = await statusRes.json()
        }
        setDeployment({
          commit: commit ? { sha: commit.sha, url: commit.html_url, date: commit.commit?.committer?.date } : null,
          status: statusData,
        })

        const migrationsJson = await migrationsRes.json()
        const functionsJson = await functionsRes.json()
        setMigrations(Array.isArray(migrationsJson) ? migrationsJson.filter((row) => row.type === 'file').map((row) => row.name).sort().reverse() : [])
        setFunctions(Array.isArray(functionsJson) ? functionsJson.filter((row) => row.type === 'dir').map((row) => row.name).sort() : [])
      } catch (err) {
        if (mounted) setError(err?.message || 'Impossible de charger l état de la plateforme.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [supabase, branchName])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <div style={{ ...cardStyle, background: '#FEF2F2', color: '#991B1B' }}>{error}</div>}
      {loading && <div style={cardStyle}>Chargement de la plateforme...</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Metric title='Entreprises' value={health?.total_entreprises ?? '—'} subtitle={(health?.entreprises_actives ?? 0) + ' actives · ' + (health?.entreprises_suspendues ?? 0) + ' suspendues'} accent='#1E40AF' />
        <Metric title='Utilisateurs' value={health?.total_users ?? '—'} subtitle={(health?.users_actifs ?? 0) + ' actifs · ' + (health?.users_desactives ?? 0) + ' désactivés'} accent='#0F766E' />
        <Metric title='Modules actifs' value={health?.modules_actifs ?? '—'} subtitle={(health?.alertes_configuration ?? 0) + ' alertes de configuration'} accent='#7C3AED' />
        <Metric title='Incidents' value={health?.incidents_24h ?? '—'} subtitle={(health?.incidents_7j ?? 0) + ' sur 7 jours'} accent='#B45309' />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>État de la plateforme</h2>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Source de vérité: Supabase, audit, GitHub branch et état de déploiement public.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Vercel / commit courant</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{deployment?.commit?.sha ? deployment.commit.sha.slice(0, 7) : '—'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{deployment?.status?.statuses?.[0]?.description || 'Statut non disponible'}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{deployment?.status?.statuses?.[0]?.target_url ? <a href={deployment.status.statuses[0].target_url} target='_blank' rel='noreferrer'>Ouvrir le déploiement</a> : 'Aucune URL de déploiement disponible'}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Migrations récentes</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {migrations.slice(0, 5).map((name) => <span key={name} style={tagStyle}>{name}</span>)}
                {migrations.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 12 }}>Aucune migration détectée.</div>}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Edge Functions</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {functions.slice(0, 8).map((name) => <span key={name} style={tagStyle}>{name}</span>)}
                {functions.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 12 }}>Aucune fonction détectée.</div>}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Dernière activité</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{formatDateTime(health?.last_audit_at)}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Journal d'audit total: {health?.audit_total ?? 0}</div>
            </div>
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 16 }}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Erreurs critiques récentes</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {recentAudits.slice(0, 8).map((evt) => (
                <div key={evt.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10, background: '#FAFAFB' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{evt.action}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{evt.description}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{formatDateTime(evt.created_at)} {evt.acteur_email ? '· ' + evt.acteur_email : ''}</div>
                </div>
              ))}
              {recentAudits.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 12 }}>Aucun événement disponible.</div>}
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Dépôts et déploiement</h3>
            <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#374151' }}>
              <div><strong>Branche:</strong> {branchName}</div>
              <div><strong>État Vercel:</strong> {deployment?.status?.state || 'unknown'}</div>
              <div><strong>Commit:</strong> {deployment?.commit?.sha || '—'}</div>
              <div><strong>Dernière mise à jour:</strong> {formatDateTime(deployment?.commit?.date)}</div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}