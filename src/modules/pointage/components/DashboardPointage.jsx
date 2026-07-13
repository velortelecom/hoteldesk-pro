import React from 'react'

export default function DashboardPointage({ stats, sites }) {
  const cards = [
    { label: 'Employés présents', value: stats?.present ?? 0, tone: '#0f766e' },
    { label: 'Retards', value: stats?.retards ?? 0, tone: '#f59e0b' },
    { label: 'Absences', value: stats?.absents ?? 0, tone: '#ef4444' },
    { label: 'Temps cumulé', value: stats?.tempsTotal ?? '0h', tone: '#2563eb' },
  ]

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {cards.map((card) => (
          <div key={card.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{card.label}</div>
            <div style={{ color: card.tone, fontSize: '1.75rem', fontWeight: 700 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Sites actifs</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {(sites || []).map((site) => (
            <div key={site.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{site.nom}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{site.equipe} agents • {site.actif ? 'Actif' : 'Inactif'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
