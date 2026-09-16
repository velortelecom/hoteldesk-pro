import React from 'react'
import { supabase } from '../lib/supabase'

/**
 * Reglage d'abonnement d'une entreprise, cote Super Admin uniquement.
 *
 *   date_fin_abonnement   jusqu'a quand le client peut ecrire
 *   abonnement_recurrent  coche -> la date avance d'un mois toute seule
 *                         (job pg_cron quotidien renouveler_abonnements)
 *
 * Decoche + date passee = lecture seule. C'est le scenario de resiliation.
 *
 * Deux choix deliberes, tires de ce qui a rate avant :
 *  - AUCUN window.confirm : une boite qui ne s'affiche pas donne un bouton
 *    qui "ne fait rien" sans la moindre trace.
 *  - .select('id') apres l'update : PostgREST renvoie alors les lignes
 *    modifiees. Une RLS qui filtre silencieusement rend un tableau vide SANS
 *    erreur -- c'est exactement ce cas qu'on ne veut plus jamais rater.
 */

function versInputDate(valeur) {
  if (!valeur) return ''
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

function joursRestants(valeur) {
  if (!valeur) return null
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d - new Date()) / 86400000)
}

export default function BlocAbonnement({ ent, onFait }) {
  const [date, setDate] = React.useState(versInputDate(ent.date_fin_abonnement))
  const [recurrent, setRecurrent] = React.useState(!!ent.abonnement_recurrent)
  const [etat, setEtat] = React.useState('repos')
  const [erreur, setErreur] = React.useState('')

  // Resynchronise quand la fiche est rechargee depuis la base.
  React.useEffect(() => {
    setDate(versInputDate(ent.date_fin_abonnement))
    setRecurrent(!!ent.abonnement_recurrent)
    setEtat('repos')
    setErreur('')
  }, [ent.date_fin_abonnement, ent.abonnement_recurrent])

  const modifie =
    versInputDate(ent.date_fin_abonnement) !== date ||
    !!ent.abonnement_recurrent !== recurrent

  const jours = joursRestants(ent.date_fin_abonnement)

  let statut
  if (ent.abonnement_recurrent) {
    statut = {
      texte: ent.date_fin_abonnement
        ? "Renouvellement mensuel actif — prochaine échéance le " + new Date(ent.date_fin_abonnement).toLocaleDateString('fr-FR')
        : "Renouvellement mensuel actif",
      couleur: '#065F46', fond: '#ECFDF5', trait: '#A7F3D0',
    }
  } else if (!ent.date_fin_abonnement) {
    statut = { texte: "Aucune date de fin — écriture ouverte sans limite", couleur: '#374151', fond: '#F9FAFB', trait: '#E5E7EB' }
  } else if (jours > 0) {
    statut = {
      texte: "Écriture ouverte jusqu'au " + new Date(ent.date_fin_abonnement).toLocaleDateString('fr-FR') + ' — ' + jours + ' j',
      couleur: '#1E40AF', fond: '#EFF6FF', trait: '#BFDBFE',
    }
  } else {
    statut = {
      texte: "Lecture seule depuis le " + new Date(ent.date_fin_abonnement).toLocaleDateString('fr-FR'),
      couleur: '#991B1B', fond: '#FEF2F2', trait: '#FECACA',
    }
  }

  async function enregistrer() {
    setEtat('envoi')
    setErreur('')

    // 23:59:59 : la journee choisie est couverte en entier.
    const valeur = date ? new Date(date + 'T23:59:59').toISOString() : null

    const { data, error } = await supabase
      .from('entreprises')
      .update({ date_fin_abonnement: valeur, abonnement_recurrent: recurrent })
      .eq('id', ent.id)
      .select('id')

    if (error) {
      setEtat('erreur')
      setErreur(error.message || 'Mise à jour refusée.')
      return
    }

    if (!data || data.length === 0) {
      setEtat('erreur')
      setErreur("Aucune ligne modifiée. La RLS a filtré la mise à jour sans lever d'erreur — vérifie que ton compte est bien Super Admin.")
      return
    }

    // L'abonnement redevient actif : on clot les demandes en attente.
    const actifMaintenant = recurrent || (valeur && new Date(valeur) > new Date())
    if (actifMaintenant) {
      await supabase
        .from('demandes_pack')
        .update({ statut: 'traitee', traite_at: new Date().toISOString() })
        .eq('entreprise_id', ent.id)
        .in('statut', ['nouvelle', 'en_cours'])
    }

    setEtat('ok')
    if (onFait) onFait()
  }

  const styleChamp = {
    border: '1px solid #D1D5DB', borderRadius: 6, padding: '5px 8px',
    fontSize: 12.5, color: '#111827', background: '#fff',
  }

  return (
    <div style={{
      marginTop: 2, padding: '10px 12px', background: '#FAFAFA',
      border: '1px solid #E5E7EB', borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Abonnement
        </span>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151' }}>
          Fin
          <input
            type="date"
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            style={styleChamp}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={recurrent}
            onChange={(ev) => setRecurrent(ev.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer' }}
          />
          Renouvellement mensuel
        </label>

        <button
          type="button"
          disabled={!modifie || etat === 'envoi'}
          onClick={enregistrer}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
            border: 'none',
            background: !modifie || etat === 'envoi' ? '#D1D5DB' : '#1E40AF',
            color: !modifie || etat === 'envoi' ? '#6B7280' : '#fff',
            cursor: !modifie || etat === 'envoi' ? 'default' : 'pointer',
          }}>
          {etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        {etat === 'ok' && !modifie && (
          <span style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>Enregistré</span>
        )}
      </div>

      <div style={{
        marginTop: 8, padding: '6px 10px', borderRadius: 6,
        background: statut.fond, border: '1px solid ' + statut.trait,
        color: statut.couleur, fontSize: 12, fontWeight: 600,
      }}>
        {statut.texte}
      </div>

      {etat === 'erreur' && (
        <div style={{
          marginTop: 8, padding: '8px 10px', borderRadius: 6,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 12, lineHeight: 1.5,
        }}>
          {erreur}
        </div>
      )}

      {!ent.abonnement_recurrent && ent.date_fin_abonnement && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
          Sans renouvellement, l&apos;espace passe en lecture seule à cette date.
          Les données restent consultables, seules les modifications sont suspendues.
        </div>
      )}
    </div>
  )
}
