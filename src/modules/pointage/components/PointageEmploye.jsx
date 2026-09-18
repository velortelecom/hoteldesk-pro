// src/modules/pointage/components/PointageEmploye.jsx
// =====================================================================
// QUATRE POINTAGES PAR JOUR : arrivee, debut de pause, fin de pause,
// depart. L'ecran propose ce qui est possible MAINTENANT, et rien
// d'autre.
//
// CE QUI NE MARCHAIT PAS
//   L'etat vivait dans une variable locale initialisee a « arrivee ». A
//   chaque rechargement de page, quelqu'un deja pointe se voyait
//   proposer une seconde arrivee -- refusee ensuite par le serveur pour
//   double_arrivee, sans explication lisible.
//
//   Et il n'y avait que deux boutons, arrivee et depart. Les pauses
//   n'etaient jamais pointees, donc jamais deduites : tout le monde
//   etait paye comme s'il avait travaille son dejeuner.
//
// L'etat vient maintenant de la base, et il est recharge apres chaque
// pointage. Le serveur reste juge : il refuse les enchainements
// impossibles, cet ecran ne fait que ne pas les proposer.
// =====================================================================
import React, { useMemo, useState } from 'react'
import { createPointageEntry, messageRefus, METHODES } from '../services.js'
import { ACTIONS, ETATS, LIBELLES_ACTIONS, formaterDuree } from '../journees.js'

const carte = { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }

const COULEURS_ACTION = {
  [ACTIONS.ARRIVEE]: '#0f766e',
  [ACTIONS.DEBUT_PAUSE]: '#b45309',
  [ACTIONS.FIN_PAUSE]: '#0f766e',
  [ACTIONS.DEPART]: '#ef4444',
}

const PHRASES_ETAT = {
  [ETATS.HORS_SERVICE]: 'Vous n’avez pas encore pointe votre arrivee.',
  [ETATS.EN_SERVICE]: 'Vous etes en service.',
  [ETATS.EN_PAUSE]: 'Vous etes en pause.',
}

function heure(date) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function PointageEmploye({ permissions, profile, sites = [], etatJour, chargementEtat, erreurEtat, onPointage }) {
  const [message, setMessage] = useState(null)
  const [erreur, setErreur] = useState(false)
  const [actionEnCours, setActionEnCours] = useState(null)

  const canCreate = permissions?.canCreate === true
  const siteOptions = useMemo(() => sites || [], [sites])
  const siteAffectation = useMemo(
    () => siteOptions.find((site) => site.id === profile?.site_id) || null,
    [profile?.site_id, siteOptions],
  )

  const actions = etatJour?.actionsAutorisees || []

  const pointer = async (action) => {
    if (!canCreate || !profile?.id) {
      setErreur(true)
      setMessage('Vous ne disposez pas des droits pour enregistrer un pointage.')
      return
    }

    setActionEnCours(action)
    setErreur(false)
    setMessage(null)

    try {
      // Pointage d'HEURES : aucune position. Savoir ou se trouve
      // quelqu'un est un autre module, une autre finalite.
      const resultat = await createPointageEntry({
        profile,
        action,
        methode: METHODES.NAVIGATEUR,
      })

      if (resultat?.statut === 'accepte') {
        setMessage(LIBELLES_ACTIONS[action] + ' enregistre a ' + heure(new Date()) + '.')
      } else if (resultat?.statut === 'en_attente_correction') {
        setMessage('Pointage enregistre, mais il devra etre verifie par votre responsable.')
      } else {
        setErreur(true)
        setMessage(messageRefus(resultat))
      }
    } catch (err) {
      setErreur(true)
      setMessage(err?.message || 'Impossible d’enregistrer le pointage en ce moment.')
    } finally {
      setActionEnCours(null)
      // On relit l'etat dans TOUS les cas, meme apres un refus : le
      // serveur a peut-etre enregistre une ligne refusee, et surtout
      // l'ecran doit repartir de ce que dit la base, pas de ce qu'il
      // croyait.
      if (typeof onPointage === 'function') await onPointage()
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={carte}>
        <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Pointer</h3>

        {erreurEtat ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '0.625rem 0.75rem', fontSize: '0.8125rem' }}>
            Votre journee en cours n&apos;a pas pu etre lue : {erreurEtat}
            <div style={{ marginTop: '0.375rem' }}>
              Aucun bouton n&apos;est propose tant qu&apos;on ne sait pas ou vous en etes &mdash;
              vous proposer une arrivee au hasard serait vous faire refuser le pointage.
            </div>
          </div>
        ) : chargementEtat ? (
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Lecture de votre journee...</div>
        ) : (
          <>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#374151' }}>
              {PHRASES_ETAT[etatJour?.etat] || ''}
              {etatJour?.depuis && etatJour.etat !== ETATS.HORS_SERVICE && (
                <> Depuis <strong>{heure(etatJour.depuis)}</strong>.</>
              )}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={!canCreate || actionEnCours != null}
                  onClick={() => pointer(action)}
                  style={{
                    padding: '0.875rem 1.25rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: actionEnCours != null ? '#d1d5db' : COULEURS_ACTION[action],
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    cursor: canCreate && actionEnCours == null ? 'pointer' : 'not-allowed',
                    opacity: canCreate ? 1 : 0.6,
                  }}
                >
                  {actionEnCours === action ? 'Enregistrement...' : LIBELLES_ACTIONS[action]}
                </button>
              ))}
            </div>

            {etatJour?.minutesJour != null && (
              <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                Temps de travail aujourd&apos;hui : <strong>{formaterDuree(etatJour.minutesJour)}</strong>
                {etatJour.etat === ETATS.EN_SERVICE && (
                  <span style={{ color: '#6b7280' }}> (en cours)</span>
                )}
              </div>
            )}
          </>
        )}

        {message && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem', borderRadius: '8px',
            background: erreur ? '#FEF2F2' : '#ECFDF5',
            border: '1px solid ' + (erreur ? '#FCA5A5' : '#A7F3D0'),
            color: erreur ? '#991B1B' : '#065F46',
            fontSize: '0.875rem',
          }}>
            {message}
          </div>
        )}

        <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.6 }}>
          Ce pointage enregistre une <strong>presence</strong> : la date et l&apos;heure, rien
          d&apos;autre. Aucune position n&apos;est relevee.
        </p>
      </div>

      <div style={carte}>
        <h3 style={{ marginTop: 0 }}>Votre journee</h3>
        {(etatJour?.evenements || []).length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            Aucun pointage enregistre pour le moment.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.375rem' }}>
            {etatJour.evenements.map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#374151' }}>
                <span>{LIBELLES_ACTIONS[e.action] || e.action}</span>
                <span>
                  {heure(e.horodatage_evenement)}
                  {e.statut === 'en_attente_correction' && (
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#92400E' }}>a verifier</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
          Site d&apos;affectation : {siteAffectation?.nom || 'non renseigne'}
        </p>
      </div>
    </div>
  )
}
