import React from 'react'

export default function ParametresPointage({ permissions, moduleId, settings = {} }) {
  const canManage = permissions?.canManageSettings === true
  const toleranceRetard = settings?.toleranceRetardMinutes ?? 5
  const heuresParJour = settings?.heuresParJour ?? 8
  const autoriserPointageMobile = settings?.autoriserPointageMobile ?? true
  const notificationRetards = settings?.notificationRetards ?? true

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Paramètres du module Pointage</h3>
        <p style={{ margin: 0, color: '#6b7280' }}>Module ID : {moduleId || 'pointage'}</p>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.75rem' }}>
          <li>Tolérance de retard : {toleranceRetard} minutes</li>
          <li>Horaire standard : {heuresParJour} h/jour</li>
          <li>Pointage mobile autorisé : {autoriserPointageMobile ? 'oui' : 'non'}</li>
          <li>Notifications retards : {notificationRetards ? 'activées' : 'désactivées'}</li>
        </ul>
        {!canManage && <p style={{ marginTop: '1rem', color: '#6b7280' }}>Accès lecture seule.</p>}
      </div>
    </div>
  )
}
