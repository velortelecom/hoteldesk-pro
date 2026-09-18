import React from 'react'

export default function DashboardPointage({ stats, sites }) {
  // « Retards » comptait en realite les pointages refuses ou en attente
  // de correction -- ce ne sont pas des retards, ce sont des journees a
  // verifier. Le libelle dit maintenant ce que le chiffre contient.
  //
  // « Temps cumule » affichait un tiret plutot que 0h quand rien n'est
  // mesurable : 0h se lit « personne n'a travaille », ce qui n'est pas la
  // meme chose que « aucune journee n'est encore terminee ».
  const cards = [
    { label: 'Employés présents', value: stats?.present ?? 0, tone: '#0f766e' },
    { label: 'Journées à corriger', value: stats?.aCorriger ?? 0, tone: '#f59e0b' },
    { label: 'Absences', value: stats?.absents ?? 0, tone: '#ef4444' },
    { label: 'Temps mesuré', value: stats?.tempsTotal ?? '\u2014', tone: '#2563eb' },
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

      {(stats?.journeesIncompletes ?? 0) > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8125rem', lineHeight: 1.6 }}>
          Le temps mesure ne couvre que les <strong>{stats.journeesCompletes}</strong> journee
          {stats.journeesCompletes !== 1 ? 's' : ''} complete{stats.journeesCompletes !== 1 ? 's' : ''}.
          {' '}<strong>{stats.journeesIncompletes}</strong> journee{stats.journeesIncompletes !== 1 ? 's' : ''}
          {' '}n&apos;{stats.journeesIncompletes !== 1 ? 'ont' : 'a'} pas pu etre calculee
          {stats.journeesIncompletes !== 1 ? 's' : ''} et {stats.journeesIncompletes !== 1 ? 'sont' : 'est'}
          {' '}a corriger. Elles ne sont ni estimees, ni comptees pour zero.
        </div>
      )}

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
