import React, { useState } from 'react'

export default function PointageEmploye({ permissions, profile }) {
  const [isClockedIn, setIsClockedIn] = useState(true)
  const [selectedSite, setSelectedSite] = useState('Hôtel Central')
  const [message, setMessage] = useState('Pointage valide aujourd’hui, aucune correction requise.')

  const canCreate = permissions?.canCreate === true

  const handleToggleClock = () => {
    setIsClockedIn((current) => !current)
    setMessage(
      isClockedIn
        ? 'Sortie enregistrée pour la journée en cours.'
        : 'Entrée enregistrée avec succès pour ce site.'
    )
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Pointage rapide</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Site</span>
            <select
              value={selectedSite}
              onChange={(event) => setSelectedSite(event.target.value)}
              style={{ padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            >
              <option>Hôtel Central</option>
              <option>Restaurant Le Sud</option>
              <option>Résidence Le Parc</option>
            </select>
          </label>

          <button
            type="button"
            disabled={!canCreate}
            onClick={handleToggleClock}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              borderRadius: '8px',
              background: isClockedIn ? '#ef4444' : '#0f766e',
              color: 'white',
              fontWeight: 600,
              cursor: canCreate ? 'pointer' : 'not-allowed',
              opacity: canCreate ? 1 : 0.6,
            }}
          >
            {isClockedIn ? 'Enregistrer la sortie' : 'Enregistrer l’entrée'}
          </button>
        </div>

        <div style={{ marginTop: '1rem', color: '#374151', background: '#f3f4f6', padding: '0.75rem', borderRadius: '8px' }}>
          {message}
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Profil</h3>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Utilisateur : {profile?.nom || 'Employé'} • Rôle : {profile?.role || 'employe'}
        </p>
      </div>
    </div>
  )
}
