import React, { useEffect, useState } from 'react'
import { updateSite } from '../services.js'

function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  return fetch(url, { headers: { Accept: 'application/json' } }).then((response) => {
    if (!response.ok) throw new Error('Geocodage impossible pour le moment.')
    return response.json()
  })
}

export default function GestionSitesPointage({ sites = [], permissions }) {
  const [localSites, setLocalSites] = useState(sites)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [feedback, setFeedback] = useState({})

  useEffect(() => {
    setLocalSites(sites)
  }, [sites])

  const canManage = permissions?.canManageSettings === true

  function startEdit(site) {
    setEditingId(site.id)
    setForm({
      adresse: site.adresse || '',
      ville: site.ville || '',
      pays: site.pays || '',
      latitude: site.latitude ?? '',
      longitude: site.longitude ?? '',
      rayonPointageMetres: site.rayonPointageMetres ?? 50,
      gpsObligatoire: Boolean(site.gpsObligatoire),
    })
    setFeedback({})
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({})
  }

  async function handleGeocode() {
    const query = [form.adresse, form.ville, form.pays].filter(Boolean).join(', ')
    if (!query) {
      setFeedback({ type: 'error', message: 'Renseignez une adresse avant de géocoder.' })
      return
    }
    setGeocoding(true)
    setFeedback({})
    try {
      const results = await geocodeAddress(query)
      if (!results || results.length === 0) {
        setFeedback({ type: 'error', message: 'Adresse introuvable. Vérifiez la saisie ou renseignez la position manuellement.' })
        return
      }
      const [best] = results
      setForm((current) => ({
        ...current,
        latitude: Number(best.lat),
        longitude: Number(best.lon),
      }))
      setFeedback({ type: 'success', message: 'Position trouvée à partir de l’adresse.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Erreur lors du géocodage.' })
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSave(siteId) {
    setSaving(true)
    setFeedback({})
    try {
      const payload = {
        adresse: form.adresse,
        ville: form.ville,
        pays: form.pays,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        rayonPointageMetres: form.rayonPointageMetres === '' ? null : Number(form.rayonPointageMetres),
        gpsObligatoire: Boolean(form.gpsObligatoire),
      }
      await updateSite(siteId, payload)
      setLocalSites((current) =>
        current.map((site) =>
          site.id === siteId
            ? {
                ...site,
                ...payload,
                actif: Boolean(payload.latitude && payload.longitude && payload.rayonPointageMetres),
              }
            : site
        )
      )
      setFeedback({ type: 'success', message: 'Paramètres du site enregistrés.' })
      setEditingId(null)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Erreur lors de l’enregistrement.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {localSites.map((site) => (
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

          <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            {site.equipe} personne{site.equipe !== 1 ? 's' : ''} affectée{site.equipe !== 1 ? 's' : ''}
          </p>

          {site.adresse ? (
            <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.8rem' }}>
              📍 {[site.adresse, site.ville, site.pays].filter(Boolean).join(', ')}
            </p>
          ) : null}

          <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.8rem' }}>
            Rayon de pointage : {site.rayonPointageMetres || '—'} m • GPS obligatoire : {site.gpsObligatoire ? 'Oui' : 'Non'}
          </p>

          {canManage && editingId !== site.id && (
            <button
              type="button"
              onClick={() => startEdit(site)}
              style={{ marginTop: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Modifier l’adresse et le rayon
            </button>
          )}

          {canManage && editingId === site.id && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: '#374151' }}>
                Adresse
                <input
                  type="text"
                  value={form.adresse}
                  onChange={(event) => setForm((current) => ({ ...current, adresse: event.target.value }))}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: '#374151', flex: 1 }}>
                  Ville
                  <input
                    type="text"
                    value={form.ville}
                    onChange={(event) => setForm((current) => ({ ...current, ville: event.target.value }))}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: '#374151', flex: 1 }}>
                  Pays
                  <input
                    type="text"
                    value={form.pays}
                    onChange={(event) => setForm((current) => ({ ...current, pays: event.target.value }))}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleGeocode}
                disabled={geocoding}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #0f766e', background: '#f0fdfa', color: '#0f766e', cursor: 'pointer', fontSize: '0.8rem', justifySelf: 'start' }}
              >
                {geocoding ? 'Recherche en cours…' : 'Géocoder l’adresse'}
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: '#374151', flex: 1 }}>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: '#374151', flex: 1 }}>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: '#374151' }}>
                Rayon de tolérance (mètres)
                <input
                  type="number"
                  min="0"
                  value={form.rayonPointageMetres}
                  onChange={(event) => setForm((current) => ({ ...current, rayonPointageMetres: event.target.value }))}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={form.gpsObligatoire}
                  onChange={(event) => setForm((current) => ({ ...current, gpsObligatoire: event.target.checked }))}
                />
                GPS obligatoire pour pointer sur ce site
              </label>

              {feedback.message && (
                <div style={{ fontSize: '0.8rem', color: feedback.type === 'error' ? '#b91c1c' : '#166534' }}>
                  {feedback.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleSave(site.id)}
                  disabled={saving}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {localSites.length === 0 && (
        <p style={{ color: '#6b7280' }}>Aucun site configuré pour le moment.</p>
      )}
    </div>
  )
}
