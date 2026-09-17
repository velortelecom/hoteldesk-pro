// src/components/FilCommentaires.jsx
// =====================================================================
// Le fil de discussion d'une tache.
//
// C'est ce qui manquait pour qu'une tache remplace un ticket de
// maintenance : quelqu'un signale une panne avec une photo, un autre
// repond "je passe cet apres-midi", et il reste une trace de ce qui s'est
// dit. Sans ce va-et-vient, la conversation retourne sur WhatsApp et se
// perd.
//
// DEUX REGLES ASSUMEES
//   Un message ne se modifie pas : un fil qu'on peut reecrire apres coup
//   ne vaut plus comme trace. Seul l'administrateur peut en effacer un.
//
// LA VISIBILITE N'EST PAS REDEFINIE ICI
//   En base, un commentaire se voit si et seulement si sa tache se voit.
//   Cet ecran ne filtre rien : il affiche ce que la base lui rend.
// =====================================================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function FilCommentaires({ tacheId, profile }) {
  const [messages, setMessages] = useState([])
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(true)

  const estAdmin = profile?.role === 'admin' || profile?.is_super_admin === true

  const charger = useCallback(async () => {
    if (!tacheId) return
    setChargement(true)
    const { data, error } = await supabase
      .from('taches_commentaires')
      .select('id, message, created_at, auteur_id, auteur:auteur_id(prenom, nom)')
      .eq('tache_id', tacheId)
      .order('created_at', { ascending: true })

    setChargement(false)
    // Un echec de lecture ne doit pas ressembler a une conversation vide.
    if (error) { setErreur('Discussion illisible : ' + (error.message || '')); return }
    setErreur('')
    setMessages(data || [])
  }, [tacheId])

  useEffect(() => { charger() }, [charger])

  async function envoyer(e) {
    e.preventDefault()
    const contenu = texte.trim()
    if (!contenu) return

    setEnvoi(true)
    setErreur('')
    const { error } = await supabase.from('taches_commentaires').insert({
      tache_id: tacheId,
      entreprise_id: profile?.entreprise_id,
      auteur_id: profile?.id,
      message: contenu,
    })
    setEnvoi(false)

    if (error) { setErreur("Message non envoye : " + (error.message || '')); return }
    setTexte('')
    charger()
  }

  async function effacer(id) {
    setErreur('')
    const { data, error } = await supabase
      .from('taches_commentaires').delete().eq('id', id).select('id')

    if (error) { setErreur(error.message); return }
    if (!data || data.length === 0) {
      setErreur("Suppression refusee : seul l'administrateur peut effacer un message.")
      return
    }
    charger()
  }

  const nomAuteur = (m) => {
    if (m.auteur_id === profile?.id) return 'Vous'
    if (!m.auteur) return 'Compte supprime'
    return [m.auteur.prenom, m.auteur.nom].filter(Boolean).join(' ') || 'Sans nom'
  }

  return (
    <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14, marginTop: 14 }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
        Discussion {messages.length > 0 && '(' + messages.length + ')'}
      </div>

      {chargement && <div style={{ fontSize: 12, color: '#9CA3AF' }}>…</div>}

      {!chargement && messages.length === 0 && (
        <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 }}>
          Aucun message. Ecrivez ce qui a ete constate, ou ce qui a ete fait.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {messages.map(m => (
          <div key={m.id} style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{nomAuteur(m)}</span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                {m.created_at ? format(parseISO(m.created_at), "d MMM 'a' HH:mm", { locale: fr }) : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#1F2937', whiteSpace: 'pre-wrap' }}>{m.message}</div>
            {estAdmin && (
              <button onClick={() => effacer(m.id)}
                style={{ marginTop: 5, background: 'none', border: 'none', color: '#B91C1C', fontSize: 10, cursor: 'pointer', padding: 0 }}>
                Effacer
              </button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={envoyer} style={{ display: 'flex', gap: 6 }}>
        <input
          value={texte}
          onChange={e => setTexte(e.target.value)}
          placeholder="Ecrire un message…"
          style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12 }}
        />
        <button type="submit" disabled={envoi || !texte.trim()}
          style={{
            background: (envoi || !texte.trim()) ? '#C7D2FE' : '#4F46E5', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600,
            cursor: (envoi || !texte.trim()) ? 'default' : 'pointer',
          }}>
          {envoi ? '…' : 'Envoyer'}
        </button>
      </form>

      {erreur && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '8px 11px', fontSize: 11, marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </div>
  )
}
