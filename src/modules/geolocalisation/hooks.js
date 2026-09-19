// src/modules/geolocalisation/hooks.js
// =====================================================================
// LE BRANCHEMENT : savoir si on est suivi, et relever a la connexion.
//
// UN SEUL RELEVE PAR SESSION, PAS UN PAR RENDU
//   React remonte un composant a chaque changement d'etat. Sans
//   precaution, « relever a la connexion » deviendrait « relever a
//   chaque fois que React en a envie » -- des dizaines de positions
//   pour une seule ouverture de l'application, toutes au meme endroit,
//   et une note de conservation qui devient ridicule a defendre.
//
//   On garde donc une marque par onglet : un releve de connexion, et
//   plus rien jusqu'a la prochaine ouverture.
//
// LE RELEVE NE BLOQUE RIEN
//   Il part en arriere-plan apres le rendu. L'utilisateur n'attend
//   jamais apres sa position pour voir son ecran, et un echec ne
//   remonte nulle part -- sauf dans la console.
//
// LE BANDEAU EST LE PENDANT DE TOUT CA
//   Quelqu'un qui voit qu'il est localise decide en connaissance de
//   cause. Sans le bandeau, « il n'avait qu'a ne pas se connecter »
//   suppose qu'il savait -- et cette supposition ne tient pas devant
//   un juge.
// =====================================================================
import { useEffect, useState } from 'react'
import { ACTIONS_RELEVE, enregistrerReleve, estInscrit } from './services.js'

/** Marque de session : un releve de connexion par onglet, pas plus. */
const CLE_SESSION = 'velor.geo.connexion_relevee'

export function connexionDejaRelevee(profileId, stockage) {
  try {
    const s = stockage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    if (!s) return false
    return s.getItem(CLE_SESSION) === String(profileId)
  } catch {
    // Navigation privee, stockage bloque : on ne releve pas plutot que
    // de relever en boucle.
    return true
  }
}

export function marquerConnexionRelevee(profileId, stockage) {
  try {
    const s = stockage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    if (s) s.setItem(CLE_SESSION, String(profileId))
  } catch {
    /* sans stockage, le garde-fou ci-dessus a deja bloque */
  }
}

/**
 * Suivi de position : l'etat, et le releve de connexion.
 *
 * @returns {{ inscrit: boolean, charge: boolean }}
 */
export function useGeolocalisation(profile, options = {}) {
  const [inscrit, setInscrit] = useState(false)
  const [charge, setCharge] = useState(false)

  const { services = { estInscrit, enregistrerReleve }, stockage } = options
  const profileId = profile?.id || null

  useEffect(() => {
    let vivant = true

    if (!profileId) {
      setInscrit(false)
      setCharge(true)
      return undefined
    }

    ;(async () => {
      const suivi = await services.estInscrit(profile)
      if (!vivant) return
      setInscrit(suivi)
      setCharge(true)

      // Le releve de connexion ne part QUE pour une personne inscrite.
      // Le serveur le refuserait de toute facon, mais demander sa
      // position a quelqu'un qui n'est pas concerne -- avec la fenetre
      // du navigateur que ca declenche -- serait indefendable.
      if (!suivi) return
      if (connexionDejaRelevee(profileId, stockage)) return

      // Marque AVANT l'appel : deux rendus rapproches ne doivent pas
      // lancer deux relevements pendant que le premier attend.
      marquerConnexionRelevee(profileId, stockage)
      services.enregistrerReleve(ACTIONS_RELEVE.CONNEXION)
    })()

    return () => { vivant = false }
  }, [profileId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { inscrit, charge }
}
