// src/components/DetailTache.jsx
// =====================================================================
// Le detail d'une tache : ce qu'elle dit, sa photo, et la discussion.
//
// UN SEUL COMPOSANT POUR LES DEUX ECRANS
//   Le planning et l'onglet Taches montrent la meme chose. Ecrire cette
//   fenetre deux fois, c'etait garantir qu'un jour la discussion existe
//   d'un cote et pas de l'autre -- exactement ce qui vient d'arriver avec
//   le champ photo.
//
// ON CONSULTE ET ON FAIT AVANCER, ON N'ADMINISTRE PAS
//   Le statut se change ici. Modifier le contenu ou supprimer reste dans
//   l'onglet Taches : deux formulaires complets finiraient par diverger.
// =====================================================================
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { LIBELLES_PRIORITE, STATUTS_TACHE } from '../lib/taches'
import { resumeVisibiliteTache } from '../lib/resumeVisibilite'
import PhotoTache from './PhotoTache'
import FilCommentaires from './FilCommentaires'

const COULEURS_PORTEE = {
  personne: { fond: '#EEF2FF', bord: '#C7D2FE', texte: '#3730A3' },
  departement: { fond: '#ECFDF5', bord: '#A7F3D0', texte: '#065F46' },
  entreprise: { fond: '#FEF3C7', bord: '#FCD34D', texte: '#92400E' },
}

export default function DetailTache({ tache, profile, employes, departements, onFermer, onChangement }) {
  const [courante, setCourante] = useState(tache)
  const [erreur, setErreur] = useState('')

  if (!courante) return null

  const resume = resumeVisibiliteTache({
    departement: courante.departement,
    assigneA: courante.assigne_a,
    employes, departements, moiId: profile?.id,
  })
  const couleurs = COULEURS_PORTEE[resume.portee]

  async function changerStatut(statut) {
    setErreur('')
    // .select() : sans lui, une ligne ecartee par les regles d'acces
    // passerait pour une modification reussie.
    const { data, error } = await supabase.from('taches')
      .update({ statut }).eq('id', courante.id).select('id')

    if (error) { setErreur(error.message); return }
    if (!data || data.length === 0) {
      setErreur("Changement refuse : vous n'avez pas le droit de modifier cette tache.")
      return
    }
    setCourante(t => ({ ...t, statut }))
    if (onChangement) onChangement()
  }

  return (
    <div onClick={onFermer}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}>
      <div onClick={ev => ev.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: 22, width: 470, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1F2937' }}>{courante.titre}</h3>
          <button onClick={onFermer}
            style={{ background: 'none', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: '#9CA3AF' }}>&times;</button>
        </div>

        {courante.description && (
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4B5563', whiteSpace: 'pre-wrap' }}>{courante.description}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12, color: '#374151', marginBottom: 14 }}>
          <span style={{ color: '#6B7280' }}>Quand</span>
          <span>
            {courante.date_echeance ? format(parseISO(courante.date_echeance), 'EEEE d MMMM', { locale: fr }) : '--'}
            {courante.heure_debut ? ' a ' + courante.heure_debut.slice(0, 5) : ''}
            {courante.heure_fin ? ' - ' + courante.heure_fin.slice(0, 5) : ''}
          </span>

          <span style={{ color: '#6B7280' }}>Priorite</span>
          <span>{LIBELLES_PRIORITE[courante.priorite] || courante.priorite}</span>

          {courante.chambre && (<><span style={{ color: '#6B7280' }}>Lieu</span><span>{courante.chambre}</span></>)}
        </div>

        <div style={{ background: couleurs.fond, border: '1px solid ' + couleurs.bord, color: couleurs.texte, borderRadius: 8, padding: '7px 10px', fontSize: 11, marginBottom: 14 }}>
          {resume.texte}
        </div>

        {courante.photo_chemin && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 5 }}>Photo</div>
            <PhotoTache chemin={courante.photo_chemin} taille={140} />
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Statut</label>
          <select value={courante.statut} onChange={e => changerStatut(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, background: '#fff' }}>
            {STATUTS_TACHE.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {erreur && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '8px 11px', fontSize: 12, marginTop: 12 }}>
            {erreur}
          </div>
        )}

        <FilCommentaires tacheId={courante.id} profile={profile} />
      </div>
    </div>
  )
}
