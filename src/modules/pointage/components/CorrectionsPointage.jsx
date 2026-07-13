import React from 'react'

export default function CorrectionsPointage() {
  const items = [
    'Correction de journée pour Sophie Martin – 15 min de retard',
    'Vérification du pointage sur le site Résidence Le Parc',
    'Rapprochement des horaires de sortie avec le service RH',
  ]

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Corrections en attente</h3>
      <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.75rem' }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
