import React from 'react'

export default function ParametresPointage({ permissions, moduleId }) {
  const canManage = permissions?.canManageSettings === true

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Paramètres du module Pointage</h3>
        <p style={{ margin: 0, color: '#6b7280' }}>Module ID : {moduleId || 'pointage'}</p>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.75rem' }}>
          <li>Tolérance de retard : 5 minutes</li>
          <li>Horaire standard : 8 h/jour</li>
          <li>Pointage mobile autorisé : oui</li>
          <li>Notifications retards : activées</li>
        </ul>
        {!canManage && <p style={{ marginTop: '1rem', color: '#6b7280' }}>Accès lecture seule.</p>}
      </div>
    </div>
  )
}
