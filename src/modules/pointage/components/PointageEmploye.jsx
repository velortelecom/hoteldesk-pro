import React, { useMemo, useState } from 'react'
import { createPointageEntry } from '../services.js'

const LOCATION_LABELS = {
  idle: '',
  locating: '📍 Localisation en cours…',
  ok: '📍 Position obtenue.',
  error: '⚠️ Localisation indisponible ou refusée : le pointage sera enregistré sans position GPS.',
  unsupported: '⚠️ Géolocalisation non supportée par cet appareil.',
}

export default function PointageEmploye({ permissions, profile, sites = [] }) {
  const [nextAction, setNextAction] = useState('arrivee')
  const [selectedSiteId, setSelectedSiteId] = useState(profile?.site_id || sites[0]?.id || '')
  const [message, setMessage] = useState('En attente d’un pointage pour aujourd’hui.')
  const [saving, setSaving] = useState(false)
  const [locationStatus, setLocationStatus] = useState('idle')

  const canCreate = permissions?.canCreate === true
  const siteOptions = useMemo(() => sites || [], [sites])

  const activeSite = useMemo(
    () => siteOptions.find((site) => site.id === selectedSiteId) || siteOptions.find((site) => site.id === profile?.site_id) || siteOptions[0],
    [profile?.site_id, selectedSiteId, siteOptions]
  )

  const handlePointage = async (action) => {
    if (!canCreate || !profile?.id) {
      setMessage('Vous ne disposez pas des droits pour enregistrer un pointage.')
      return
    }

    setSaving(true)
    setLocationStatus('locating')

    let coords = { latitude: null, longitude: null, precisionMetres: null }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
        })
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisionMetres: position.coords.accuracy,
        }
        setLocationStatus('ok')
      } catch (geoError) {
        setLocationStatus('error')
      }
    } else {
      setLocationStatus('unsupported')
    }

    try {
      const result = await createPointageEntry({
        profile,
        action: action,
        latitude: coords.latitude,
        longitude: coords.longitude,
        precisionMetres: coords.precisionMetres,
        commentaire: coords.latitude !== null ? 'Pointage GPS depuis le module V1.' : 'Pointage manuel depuis le module V1 (localisation indisponible).',
      })

      const serverNextAction = result?.historique_jour?.prochain_bouton_autorise || 'arrivee'
      setNextAction(serverNextAction)

      if (result?.statut === 'accepte') {
        setMessage(
          serverNextAction === 'depart'
            ? 'Entrée enregistrée avec succès. Vous pouvez maintenant clôturer la journée.'
            : 'Sortie enregistrée avec succès pour la journée en cours.'
        )
      } else if (result?.statut === 'en_attente_correction') {
        setMessage('Le pointage a été pris en compte mais doit faire l’objet d’une vérification manuelle.')
      } else {
        setMessage(`Le pointage a été refusé : ${result?.motif_refus || 'vérification nécessaire'}.`)
      }
    } catch (error) {
      setMessage(error?.message || 'Impossible d’enregistrer le pointage en ce moment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Pointage rapide</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Site</span>
            <select
              value={selectedSiteId}
              onChange={(event) => setSelectedSiteId(event.target.value)}
              style={{ padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            >
              {(siteOptions || []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nom}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!canCreate || saving || nextAction !== 'arrivee'}
            onClick={() => handlePointage('arrivee')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              borderRadius: '8px',
              background: '#0f766e',
              color: 'white',
              fontWeight: 600,
              cursor: canCreate && !saving && nextAction === 'arrivee' ? 'pointer' : 'not-allowed',
              opacity: canCreate && nextAction === 'arrivee' ? 1 : 0.6,
            }}
          >
            {saving
              ? 'Enregistrement...' : 'Enregistrer l’entrée'}
          </button>
          <button
            type="button"
            disabled={!canCreate || saving || nextAction !== 'depart'}
            onClick={() => handlePointage('depart')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              borderRadius: '8px',
              background: '#ef4444',
              color: 'white',
              fontWeight: 600,
              cursor: canCreate && !saving && nextAction === 'depart' ? 'pointer' : 'not-allowed',
              opacity: canCreate && nextAction === 'depart' ? 1 : 0.6,
            }}
          >
            {saving
              ? 'Enregistrement...' : 'Enregistrer la sortie'}
          </button>
        </div>

                {locationStatus !== 'idle' && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
            {LOCATION_LABELS[locationStatus]}
          </div>
        )}

        <div style={{ marginTop: '1rem', color: '#374151', background: '#f3f4f6', padding: '0.75rem', borderRadius: '8px' }}>
          {message}
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Profil</h3>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Utilisateur : {profile?.prenom || profile?.nom || 'Employé'} {profile?.nom || ''} • Rôle : {profile?.role || 'employe'}
        </p>
        <p style={{ margin: '0.5rem 0 0', color: '#6b7280' }}>
          Site d’affectation : {activeSite?.nom || 'Non renseigné'}
        </p>
      </div>
    </div>
  )
}
