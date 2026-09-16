import React from 'react'

export default function GestionSitesPointage({ sites = [] }) {
  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {sites.map((site) => (
        <div key={site.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>{site.nom}</h3>
            <span
              style={{
                background: site.actif ? '#dcfce7' : '#f3f4f6',
                color: site.actif ? '#166534' : '#6b7280',
                borderRadius: '999px',
                padding: '0.15rem 0.55rem',
                fontSize: '0.75rem',
              }}
            >
              {site.actif ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <p style={{ margin: '0.75rem 0 0', color: '#6b7280' }}>{site.equipe} agents assignés</p>
        </div>
      ))}
    </div>
  )
}
