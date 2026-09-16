import React from 'react'
import { EVENEMENT_ESSAI_TERMINE } from '../lib/supabase'

// Adresse affichee au client quand son essai est termine.
// C'est le seul endroit a changer si le contact evolue.
const CONTACT_EMAIL = 'contact@velortelecom.fr'
const CONTACT_TEL = ''   // optionnel, ex : '+33 4 XX XX XX XX'

/**
 * Affiche un message clair quand la base refuse une ecriture pour cause
 * d'essai expire. Monte une seule fois, a la racine : il couvre toutes les
 * pages sans qu'aucune n'ait a s'en occuper.
 *
 * Volontairement refermable : l'espace reste consultable en lecture, et on
 * ne veut pas enfermer le client dans une boite de dialogue. Le message
 * reapparait a la prochaine tentative d'ecriture.
 */
export default function EssaiTermineGuard() {
  const [info, setInfo] = React.useState(null)

  React.useEffect(() => {
    function surEvenement(e) {
      const d = (e && e.detail) || {}
      setInfo({
        message: d.message || 'Votre période d\'essai est terminée : votre espace est passé en lecture seule.',
        aide: d.aide || 'Contactez Velor One pour activer votre abonnement.',
      })
    }
    window.addEventListener(EVENEMENT_ESSAI_TERMINE, surEvenement)
    return () => window.removeEventListener(EVENEMENT_ESSAI_TERMINE, surEvenement)
  }, [])

  if (!info) return null

  const sujet = encodeURIComponent('Activation de mon abonnement Velor One')
  const lienMail = 'mailto:' + CONTACT_EMAIL + '?subject=' + sujet

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essai-termine-titre"
      onClick={() => setInfo(null)}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(17, 24, 39, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 14, maxWidth: 460, width: '100%',
          padding: '26px 28px', boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
        }}>

        <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 12 }}>⏳</div>

        <h2 id="essai-termine-titre" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#111827' }}>
          Votre période d'essai est terminée
        </h2>

        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: '#374151' }}>
          {info.message}
        </p>

        <div style={{
          margin: '16px 0 0', padding: '12px 14px', background: '#F0FDF4',
          border: '1px solid #BBF7D0', borderRadius: 8,
          fontSize: 13, lineHeight: 1.5, color: '#166534',
        }}>
          <strong>Vos données sont intactes.</strong> Vous pouvez toujours tout
          consulter — seules les modifications sont suspendues. Elles reprendront
          dès l'activation de votre abonnement, sans aucune perte.
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 13, color: '#6B7280' }}>
          {info.aide}
          {CONTACT_TEL ? ' — ' + CONTACT_TEL : ''}
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <a
            href={lienMail}
            style={{
              flex: 1, minWidth: 170, textAlign: 'center', textDecoration: 'none',
              background: '#1E40AF', color: '#FFFFFF', borderRadius: 8,
              padding: '10px 16px', fontSize: 14, fontWeight: 600,
            }}>
            Activer mon abonnement
          </a>
          <button
            type="button"
            onClick={() => setInfo(null)}
            style={{
              background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB',
              borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer',
            }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
