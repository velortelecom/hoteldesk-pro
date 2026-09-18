// src/modules/pointage/components/ParametresPointage.jsx
// =====================================================================
// CE QUE CET ECRAN AFFICHAIT AVANT
//
//   Tolérance de retard : 50 minutes
//   Horaire standard : 8 h/jour
//   Pointage mobile autorisé : oui
//   Notifications retards : activées
//
// Aucun de ces quatre reglages n'existe dans la base. Le service les
// fabriquait en lisant des colonnes sans rapport : les « 50 minutes » de
// tolerance etaient la precision GPS maximale, EN METRES. Un responsable
// qui reglait sa tolerance de retard reglait en realite un rayon GPS --
// s'il avait pu regler quoi que ce soit, car l'ecran etait en lecture
// seule de bout en bout.
//
// On affiche desormais ce que la table contient, et rien de plus. Un
// ecran court et vrai vaut mieux qu'un ecran complet et faux.
// =====================================================================
import React from 'react'

const carte = { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }
const ligne = { display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderTop: '1px solid #f3f4f6', fontSize: '0.875rem' }

const LIBELLES_METHODES = {
  navigateur: 'Depuis l’application, sans position',
  gps: 'Geolocalise (deplacements)',
  manuel: 'Saisi par un responsable',
}

export default function ParametresPointage({ permissions, settings, chargement = false, erreur = null }) {
  const canManage = permissions?.canManageSettings === true

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={carte}>
        <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Parametres du pointage</h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
          Ces valeurs viennent de la base. Elles ne sont pas modifiables depuis cet ecran
          pour l&apos;instant &mdash; il vaut mieux un reglage qu&apos;on lit sans pouvoir
          le changer qu&apos;un bouton qui n&apos;enregistre rien.
        </p>
      </div>

      {erreur ? (
        <div style={{ ...carte, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '0.875rem' }}>
          Les parametres n&apos;ont pas pu etre lus : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ ...carte, color: '#6b7280', fontSize: '0.875rem' }}>Lecture des parametres...</div>
      ) : !settings ? null : (
        <>
          {!settings.parametree && (
            <div style={{ ...carte, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Aucun parametrage enregistre pour votre entreprise. Les valeurs ci-dessous
              sont celles que la base applique par defaut &mdash; personne ne les a choisies.
            </div>
          )}

          <div style={carte}>
            <div style={{ ...ligne, borderTop: 'none' }}>
              <span>Facons de pointer autorisees</span>
              <span style={{ textAlign: 'right' }}>
                {settings.methodesActives.length === 0
                  ? <em style={{ color: '#991B1B' }}>aucune &mdash; personne ne peut pointer</em>
                  : settings.methodesActives.map(m => (
                    <div key={m}>{LIBELLES_METHODES[m] || m}</div>
                  ))}
              </span>
            </div>

            <div style={ligne}>
              <span>Position exigee pour le pointage geolocalise</span>
              <span>{settings.gpsObligatoire ? 'oui' : 'non'}</span>
            </div>

            <div style={ligne}>
              <span>Precision GPS maximale acceptee</span>
              <span>{settings.precisionGpsMaxMetres} metres</span>
            </div>

            <div style={ligne}>
              <span>Pointage hors zone accepte, avec verification</span>
              <span>{settings.autoriserHorsZoneAvecValidation ? 'oui' : 'non'}</span>
            </div>

            <div style={ligne}>
              <span>Duree maximale entre deux pointages</span>
              <span>
                {settings.dureeMaxEntrePointagesMinutes == null
                  ? 'non definie'
                  : settings.dureeMaxEntrePointagesMinutes + ' minutes'}
              </span>
            </div>
          </div>
        </>
      )}

      {!canManage && (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8125rem' }}>
          Acces en lecture seule.
        </p>
      )}
    </div>
  )
}
