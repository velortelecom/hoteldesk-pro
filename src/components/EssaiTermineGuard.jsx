import React from 'react'
import { supabase, EVENEMENT_ESSAI_TERMINE } from '../lib/supabase'

// Affiche en secours si la demande ne peut pas partir. Texte simple, pas un
// lien mailto : on ne veut pas ouvrir le client de messagerie du client.
const CONTACT_SECOURS = 'contact@velortelecom.fr'

/**
 * Affiche un message clair quand la base refuse une ecriture pour cause
 * d'essai expire, et permet de deposer une demande d'activation qui arrive
 * directement dans l'onglet Demandes du Super Admin.
 *
 * Monte une seule fois, a la racine : couvre toutes les pages sans qu'aucune
 * n'ait a s'en occuper.
 *
 * Autonome par construction : il lit la session via supabase plutot que par
 * useAuth(), car AuthProvider vit a l'interieur de <App /> et ce composant est
 * monte a cote.
 *
 * La table demandes_pack n'est PAS protegee par trg_lecture_seule : un client
 * expire doit toujours pouvoir demander a payer. C'est volontaire.
 */
export default function EssaiTermineGuard() {
  const [info, setInfo] = React.useState(null)
  const [etat, setEtat] = React.useState('repos')
  const [detail, setDetail] = React.useState('')

  React.useEffect(() => {
    function surEvenement(e) {
      const d = (e && e.detail) || {}
      setEtat('repos')
      setDetail('')
      setInfo({
        message: d.message || 'Votre période d\'essai est terminée : votre espace est passé en lecture seule.',
        aide: d.aide || 'Demandez l\'activation de votre abonnement, Velor One vous recontacte.',
      })
    }
    window.addEventListener(EVENEMENT_ESSAI_TERMINE, surEvenement)
    return () => window.removeEventListener(EVENEMENT_ESSAI_TERMINE, surEvenement)
  }, [])

  async function demanderActivation() {
    setEtat('envoi')
    setDetail('')

    try {
      const auth = await supabase.auth.getUser()
      const utilisateur = auth && auth.data ? auth.data.user : null
      if (!utilisateur) {
        setEtat('erreur')
        setDetail('Session expirée. Reconnectez-vous et réessayez.')
        return
      }

      const profilRes = await supabase
        .from('profiles')
        .select('id, role, entreprise_id, telephone, prenom, nom')
        .eq('id', utilisateur.id)
        .single()

      const profil = profilRes.data
      if (!profil || !profil.entreprise_id) {
        setEtat('erreur')
        setDetail('Profil introuvable.')
        return
      }

      // La policy d'insertion de demandes_pack n'autorise que le role admin.
      if (profil.role !== 'admin') {
        setEtat('refus')
        return
      }

      // Une demande deja en attente : on ne la duplique pas.
      const existantes = await supabase
        .from('demandes_pack')
        .select('id, statut')
        .eq('entreprise_id', profil.entreprise_id)
        .in('statut', ['nouvelle', 'en_cours'])
        .limit(1)

      if (existantes.data && existantes.data.length > 0) {
        setEtat('deja')
        return
      }

      const insertion = await supabase.from('demandes_pack').insert({
        entreprise_id: profil.entreprise_id,
        demandeur_id: profil.id,
        pack_demande: 'activation',
        message: 'Fin de période d\'essai : demande d\'activation de l\'abonnement.',
        contact_email: utilisateur.email || null,
        contact_telephone: profil.telephone || null,
        statut: 'nouvelle',
      })

      if (insertion.error) {
        setEtat('erreur')
        setDetail(insertion.error.message || 'Envoi impossible.')
        return
      }

      setEtat('envoyee')
    } catch (e) {
      setEtat('erreur')
      setDetail((e && e.message) || 'Envoi impossible.')
    }
  }

  if (!info) return null

  const fermer = () => setInfo(null)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essai-termine-titre"
      onClick={fermer}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(17, 24, 39, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 14, maxWidth: 470, width: '100%',
          padding: '26px 28px', boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
        }}>

        <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 12 }}>
          {etat === 'envoyee' || etat === 'deja' ? '✅' : '⏳'}
        </div>

        <h2 id="essai-termine-titre" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#111827' }}>
          {etat === 'envoyee' ? 'Demande envoyée'
            : etat === 'deja' ? 'Demande déjà enregistrée'
            : 'Votre période d\'essai est terminée'}
        </h2>

        {etat !== 'envoyee' && etat !== 'deja' && (
          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: '#374151' }}>
            {info.message}
          </p>
        )}

        {etat === 'envoyee' && (
          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: '#374151' }}>
            Velor One a reçu votre demande et vous recontacte rapidement pour activer
            votre abonnement. Vous n'avez rien d'autre à faire.
          </p>
        )}

        {etat === 'deja' && (
          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: '#374151' }}>
            Une demande est déjà en cours de traitement pour votre espace.
            Velor One vous recontacte, inutile d'en envoyer une seconde.
          </p>
        )}

        <div style={{
          margin: '16px 0 0', padding: '12px 14px', background: '#F0FDF4',
          border: '1px solid #BBF7D0', borderRadius: 8,
          fontSize: 13, lineHeight: 1.5, color: '#166534',
        }}>
          <strong>Vos données sont intactes.</strong> Vous pouvez toujours tout
          consulter — seules les modifications sont suspendues. Elles reprendront
          dès l'activation, sans aucune perte.
        </div>

        {etat === 'refus' && (
          <div style={{
            margin: '14px 0 0', padding: '12px 14px', background: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: 8,
            fontSize: 13, lineHeight: 1.5, color: '#92400E',
          }}>
            Seul l'administrateur de votre espace peut déposer cette demande.
            Prévenez-le, ou écrivez à {CONTACT_SECOURS}.
          </div>
        )}

        {etat === 'erreur' && (
          <div style={{
            margin: '14px 0 0', padding: '12px 14px', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 8,
            fontSize: 13, lineHeight: 1.5, color: '#991B1B',
          }}>
            La demande n'a pas pu être envoyée{detail ? ' (' + detail + ')' : ''}.
            Écrivez à {CONTACT_SECOURS}.
          </div>
        )}

        {etat === 'repos' && (
          <p style={{ margin: '16px 0 0', fontSize: 13, color: '#6B7280' }}>
            {info.aide}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          {(etat === 'repos' || etat === 'envoi' || etat === 'erreur') && (
            <button
              type="button"
              disabled={etat === 'envoi'}
              onClick={demanderActivation}
              style={{
                flex: 1, minWidth: 190,
                background: etat === 'envoi' ? '#93A3C4' : '#1E40AF', color: '#FFFFFF',
                border: 'none', borderRadius: 8, padding: '10px 16px',
                fontSize: 14, fontWeight: 600,
                cursor: etat === 'envoi' ? 'default' : 'pointer',
              }}>
              {etat === 'envoi' ? 'Envoi en cours…' : 'Demander l\'activation'}
            </button>
          )}
          <button
            type="button"
            onClick={fermer}
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
