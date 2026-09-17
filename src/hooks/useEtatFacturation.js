// src/hooks/useEtatFacturation.js
// =====================================================================
// CE QUE DOIT L'ENTREPRISE CE MOIS-CI, LU EN BASE.
//
// Pourquoi passer par la base plutot que compter les profils cote
// navigateur : le nombre affiche au client doit etre CELUI QU'ON
// FACTURE. etat_facturation() est la fonction que figer_releves_
// facturation() utilise pour etablir les releves ; en la lisant ici, on
// s'interdit d'afficher un montant different de la facture.
//
// L'erreur PARLE. On a perdu une soiree sur un repli silencieux
// (« if (error) return » sur le tarif fondateur) : ici toute erreur est
// ecrite en console avec son code, et l'appelant recoit erreur != null
// pour pouvoir se taire plutot qu'afficher un faux montant.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function useEtatFacturation(entrepriseId) {
  const [etat, setEtat] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let annule = false

    if (!entrepriseId) {
      setEtat(null)
      setChargement(false)
      return undefined
    }

    setChargement(true)

    supabase
      .rpc('etat_facturation')
      .then(({ data, error }) => {
        if (annule) return

        if (error) {
          console.error(
            '[facturation] etat_facturation a echoue : aucun montant ne sera affiche. '
            + 'code=' + (error.code || '-')
            + ' message=' + (error.message || '-')
            + ' details=' + (error.details || '-')
            + ' hint=' + (error.hint || '-'),
          )
          setErreur(error)
          setEtat(null)
          setChargement(false)
          return
        }

        // La fonction renvoie une table : zero ligne quand l'appelant n'a
        // pas d'entreprise, une sinon.
        const ligne = Array.isArray(data) ? data[0] : data
        if (!ligne) {
          console.warn('[facturation] etat_facturation n\'a renvoye aucune ligne pour cette entreprise.')
        }
        setErreur(null)
        setEtat(ligne || null)
        setChargement(false)
      })

    return () => { annule = true }
  }, [entrepriseId])

  return { etat, chargement, erreur }
}
