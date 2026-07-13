import React from 'react'

export default function HistoriquePointages({ pointages = [] }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Historique des pointages</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Employé</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Site</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Date</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Entrée</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Sortie</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {pointages.map((pointage) => (
              <tr key={pointage.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>{pointage.employe}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{pointage.site}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{pointage.date}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{pointage.entree}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{pointage.sortie}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{pointage.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
