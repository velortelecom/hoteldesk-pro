import { SUPER_ADMIN_SECTIONS } from './shellConfig'

const styles = {
  root: { display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 'calc(100vh - 56px)' },
  sidebar: { background: '#0F172A', color: '#E2E8F0', padding: 16, borderRight: '1px solid #1E293B' },
  brand: { fontWeight: 800, letterSpacing: 0.3, fontSize: 16, marginBottom: 16 },
  sideButton: { width: '100%', textAlign: 'left', border: '1px solid transparent', background: 'transparent', color: '#CBD5E1', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, marginBottom: 6 },
  contentWrap: { background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)', padding: 18, display: 'grid', gap: 14 },
  topBar: { background: '#FFFFFFCC', backdropFilter: 'blur(6px)', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  breadcrumb: { fontSize: 12, color: '#64748B', fontWeight: 600 },
  title: { fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '4px 0 0 0' },
  actions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  search: { border: '1px solid #CBD5E1', borderRadius: 10, padding: '9px 11px', minWidth: 220, fontSize: 13, background: '#fff' },
  button: { border: '1px solid #CBD5E1', borderRadius: 10, background: '#fff', padding: '9px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155' },
  quickButton: { border: 'none', borderRadius: 10, background: '#0EA5E9', color: '#fff', padding: '9px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  body: { display: 'grid', gap: 12 },
}

export default function SuperAdminShell({
  activeSection,
  breadcrumbs,
  searchValue,
  onSearch,
  onSectionChange,
  onQuickCreate,
  onExitAssistance,
  assistanceActive,
  assistanceSession,
  onSignOut,
  accountLabel,
  children,
}) {
  const breadcrumbText = Array.isArray(breadcrumbs) ? breadcrumbs.join(' / ') : 'Super Admin'

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>VELOR SUPER ADMIN V2</div>
        {SUPER_ADMIN_SECTIONS.map((section) => {
          const active = section.id === activeSection
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              style={{
                ...styles.sideButton,
                background: active ? '#1D4ED8' : 'transparent',
                color: active ? '#fff' : '#CBD5E1',
                borderColor: active ? '#60A5FA' : 'transparent',
              }}
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          )
        })}
      </aside>

      <section style={styles.contentWrap}>
        {assistanceSession && (
          <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', borderRadius: 12, padding: '10px 12px', fontWeight: 700, fontSize: 12 }}>
            Assistance active · entreprise {assistanceSession.entreprise_id || 'n/a'} · motif: {assistanceSession.reason || 'n/a'} · fin: {assistanceSession.expires_at ? new Date(assistanceSession.expires_at).toLocaleString('fr-FR') : 'n/a'}
          </div>
        )}

        <div style={styles.topBar}>
          <div>
            <div style={styles.breadcrumb}>{breadcrumbText}</div>
            <h1 style={styles.title}>Console Super Admin</h1>
          </div>
          <div style={styles.actions}>
            <input
              value={searchValue}
              onChange={(event) => onSearch(event.target.value)}
              style={styles.search}
              placeholder='Recherche globale'
            />
            <button onClick={onQuickCreate} style={styles.quickButton}>+ Creation entreprise</button>
            {assistanceActive && (
              <button onClick={onExitAssistance} style={{ ...styles.button, borderColor: '#F59E0B', color: '#B45309' }}>
                Quitter assistance
              </button>
            )}
            <button onClick={onSignOut} style={styles.button}>{accountLabel}</button>
          </div>
        </div>

        <div style={styles.body}>{children}</div>
      </section>
    </div>
  )
}
