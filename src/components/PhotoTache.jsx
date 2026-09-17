// src/components/PhotoTache.jsx
// =====================================================================
// Afficher la photo d'une tache.
//
// L'espace de stockage est PRIVE : il n'existe pas d'adresse permanente
// vers ces fichiers. On demande un lien signe, valable une heure, au
// moment de l'affichage. C'est ce qui garantit qu'une photo de la chambre
// 214 ne circule pas hors de l'entreprise.
//
// Un seul composant pour le planning et pour l'onglet Taches : deux copies
// auraient fini par diverger, comme tout ce qu'on a duplique sur ce projet.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET_PHOTOS } from '../lib/photoTache'

export default function PhotoTache({ chemin, taille = 28 }) {
  const [url, setUrl] = useState(null)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    let annule = false
    if (!chemin) return undefined

    supabase.storage.from(BUCKET_PHOTOS).createSignedUrl(chemin, 3600)
      .then(({ data, error }) => {
        if (annule) return
        if (error || !data) { setErreur(true); return }
        setUrl(data.signedUrl)
      })

    return () => { annule = true }
  }, [chemin])

  if (!chemin) return null

  // Un echec se dit. Une image cassee sans explication laisserait croire
  // que la photo n'a jamais ete envoyee.
  if (erreur) {
    return <span style={{ fontSize: 11, color: '#B45309' }} title="Le lien vers la photo n a pas pu etre obtenu">photo indisponible</span>
  }

  if (!url) return <span style={{ fontSize: 11, color: '#9CA3AF' }}>…</span>

  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
      <img
        src={url}
        alt="Etat constate sur place"
        style={{ width: taille, height: taille, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb', display: 'block' }}
      />
    </a>
  )
}
