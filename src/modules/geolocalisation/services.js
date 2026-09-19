// src/modules/geolocalisation/services.js
// =====================================================================
// ENVOYER UN RELEVE, ET LIRE CE QUI A ETE RELEVE.
//
// LA REGLE QUI PRIME SUR TOUTES LES AUTRES
//   Un releve qui echoue ne doit JAMAIS empecher l'action metier.
//   Si le technicien termine sa tache et que la position ne part pas,
//   la tache se termine quand meme.
//
//   C'est le meme raisonnement que pour le declencheur de mouvements :
//   le metier d'abord, la comptabilite ensuite. Un module de suivi qui
//   empeche de travailler se fait desactiver dans la semaine, et on
//   perd tout -- pas seulement la position manquante.
//
//   Consequence directe : toutes les fonctions d'ecriture renvoient un
//   compte rendu et ne levent jamais. L'appelant regarde s'il veut.
//
// ON NE SE TAIT PAS POUR AUTANT
//   Chaque echec part en console avec son code. Un releve manquant doit
//   pouvoir s'expliquer -- « rien ne s'est passe » est la reponse qui
//   fait perdre le plus de temps.
//
// LES REFUS NORMAUX NE SONT PAS DES ERREURS
//   « Pas inscrit au suivi » et « hors temps de travail » sont les
//   reponses ATTENDUES pour la plupart des gens, la plupart du temps.
//   Les afficher en rouge apprendrait aux utilisateurs a ignorer les
//   messages rouges. Ils sont donc silencieux a l'ecran, et lisibles
//   dans le compte rendu.
// =====================================================================
import { supabase } from '../../lib/supabase'
import { appareilCourt, relever } from './position.js'

/** Les actions qui justifient un releve. Copie de la contrainte SQL. */
export const ACTIONS_RELEVE = {
  CONNEXION: 'connexion',
  TACHE_TERMINEE: 'tache_terminee',
  PHOTO: 'photo',
  VISITE: 'visite',
  INTERVENTION_DEBUT: 'intervention_debut',
}

/** Pourquoi un releve n'a pas eu lieu. */
export const RESULTATS = {
  ENREGISTRE: 'enregistre',
  NON_INSCRIT: 'non_inscrit',
  HORS_TEMPS_TRAVAIL: 'hors_temps_travail',
  POSITION_INDISPONIBLE: 'position_indisponible',
  ERREUR: 'erreur',
}

/**
 * Un refus attendu, ou un vrai probleme ?
 *
 * Sert a l'ecran : seuls les seconds meritent d'etre montres.
 */
export function refusNormal(resultat) {
  return resultat === RESULTATS.NON_INSCRIT
    || resultat === RESULTATS.HORS_TEMPS_TRAVAIL
}

/**
 * Traduit le message d'erreur de la base en resultat.
 *
 * On lit le TEXTE parce que PostgREST remonte les exceptions PL/pgSQL
 * sans code exploitable. C'est fragile, donc le defaut est ERREUR :
 * en cas de doute on signale, on ne classe pas en « refus normal » ce
 * qu'on n'a pas reconnu.
 */
export function resultatDepuisErreur(erreur) {
  const message = String((erreur && (erreur.message || erreur.details)) || '')
  if (/pas inscrite au suivi/i.test(message)) return RESULTATS.NON_INSCRIT
  if (/hors temps de travail/i.test(message)) return RESULTATS.HORS_TEMPS_TRAVAIL
  if (/position absente/i.test(message)) return RESULTATS.POSITION_INDISPONIBLE
  return RESULTATS.ERREUR
}

/**
 * Releve la position et l'enregistre, pour une action donnee.
 *
 * @returns {Promise<{resultat, id?, motif?, message?, detail?}>}
 *          Ne leve jamais.
 */
export async function enregistrerReleve(actionType, options = {}) {
  const {
    actionId = null,
    siteId = null,
    api,
    rpc = (nom, params) => supabase.rpc(nom, params),
    userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  } = options

  try {
    const position = await relever(api ? { api } : {})

    if (!position.ok) {
      console.warn('[geo] position non relevee (' + actionType + ') : ' + position.motif)
      return {
        resultat: RESULTATS.POSITION_INDISPONIBLE,
        motif: position.motif,
        message: position.message,
        definitif: position.definitif,
      }
    }

    const { data, error } = await rpc('enregistrer_releve_position', {
      p_action_type: actionType,
      p_action_id: actionId,
      p_latitude: position.latitude,
      p_longitude: position.longitude,
      p_precision_metres: position.precisionMetres,
      p_site_id: siteId,
      p_appareil: appareilCourt(userAgent),
    })

    if (error) {
      const resultat = resultatDepuisErreur(error)
      // Un refus attendu ne merite pas un console.error : sinon la
      // console d'un salarie non inscrit se remplit de rouge a chaque
      // action, et on n'y voit plus les vrais problemes.
      const tracer = refusNormal(resultat) ? console.info : console.error
      tracer('[geo] releve non enregistre (' + actionType + ') : ' + (error.message || '-'))
      return { resultat, detail: error.message || null }
    }

    return { resultat: RESULTATS.ENREGISTRE, id: data || null }
  } catch (err) {
    // Filet : meme un bug ici ne doit pas remonter a l'appelant, qui
    // est au milieu d'une action metier.
    console.error('[geo] releve impossible (' + actionType + ') : ' + (err && err.message))
    return { resultat: RESULTATS.ERREUR, detail: (err && err.message) || null }
  }
}

/**
 * Cette personne est-elle inscrite au suivi ?
 *
 * Sert au bandeau de transparence. En cas d'echec de lecture on renvoie
 * false : afficher « vous etes suivi » a quelqu'un qui ne l'est pas
 * serait un mensonge de plus mauvais aloi que l'inverse.
 */
export async function estInscrit(profile, options = {}) {
  const { rpc = (nom, params) => supabase.rpc(nom, params) } = options
  if (!profile?.id) return false

  const { data, error } = await rpc('est_geolocalise', { p_profile_id: profile.id })
  if (error) {
    console.error('[geo] inscription illisible : ' + (error.message || '-'))
    return false
  }
  return data === true
}

/**
 * Les releves d'une entreprise, pour la carte.
 *
 * La base filtre deja par RLS -- l'admin voit son entreprise, le
 * responsable son departement. On ne refiltre pas ici : ce serait une
 * seconde regle a maintenir, et c'est toujours celle qu'on oublie.
 */
export async function getReleves(profile, options = {}) {
  const { depuisJours = 7, limite = 500, client = supabase } = options
  if (!profile?.entreprise_id) return []

  const depuis = new Date()
  depuis.setDate(depuis.getDate() - depuisJours)

  const { data, error } = await client
    .from('releves_position')
    .select('id, profile_id, action_type, latitude, longitude, precision_metres, site_id, distance_site_metres, dans_le_rayon, releve_le, appareil')
    .gte('releve_le', depuis.toISOString())
    .order('releve_le', { ascending: false })
    .limit(limite)

  if (error) {
    // Pas de liste vide silencieuse : « aucun releve » et « la lecture a
    // echoue » ne se ressemblent que pour la machine.
    console.error(
      '[geo] releves illisibles. code=' + (error.code || '-')
      + ' message=' + (error.message || '-'),
    )
    throw new Error(error.message || 'Releves illisibles.')
  }

  return data || []
}

/** Les personnes inscrites, avec leur mode. Pour l'ecran d'inscription. */
export async function getInscriptions(profile, options = {}) {
  const { client = supabase } = options
  if (!profile?.entreprise_id) return []

  const { data, error } = await client
    .from('geolocalisation_inscriptions')
    .select('id, profile_id, inscrit, suivre_pointage, motif, decide_le, decide_par')
    .order('decide_le', { ascending: false })

  if (error) {
    console.error('[geo] inscriptions illisibles : ' + (error.message || '-'))
    throw new Error(error.message || 'Inscriptions illisibles.')
  }

  return data || []
}

/**
 * L'etat ACTUEL de chaque personne, deduit de l'historique.
 *
 * La table est une suite de decisions ; l'ecran a besoin de la
 * derniere. On la calcule ici plutot que de demander a la base une
 * seconde fois : l'historique sert aussi a afficher « depuis le ... ».
 */
export function etatActuelParProfil(inscriptions = []) {
  const parProfil = new Map()

  // Les lignes arrivent de la plus recente a la plus ancienne : la
  // premiere vue pour un profil est donc la bonne.
  ;(inscriptions || []).forEach((ligne) => {
    if (!ligne || !ligne.profile_id) return
    if (!parProfil.has(ligne.profile_id)) {
      parProfil.set(ligne.profile_id, {
        profileId: ligne.profile_id,
        inscrit: ligne.inscrit === true,
        depuis: ligne.decide_le,
        motif: ligne.motif || null,
        // Peut rester null : la personne suit alors le reglage de
        // l'entreprise, et l'ecran doit pouvoir le dire.
        suivrePointage: ligne.suivre_pointage,
      })
      return
    }
    // Le mode peut avoir ete fixe par une decision ANTERIEURE a la
    // derniere. On complete sans ecraser l'etat courant.
    const etat = parProfil.get(ligne.profile_id)
    if (etat.suivrePointage == null && ligne.suivre_pointage != null) {
      etat.suivrePointage = ligne.suivre_pointage
    }
  })

  return [...parProfil.values()]
}

/** Inscrire ou retirer quelqu'un. Renvoie un compte rendu, ne leve pas. */
export async function inscrire(profileId, inscrit, options = {}) {
  const {
    motif = null,
    suivrePointage = null,
    rpc = (nom, params) => supabase.rpc(nom, params),
  } = options

  const { data, error } = await rpc('inscrire_geolocalisation', {
    p_profile_id: profileId,
    p_inscrit: inscrit,
    p_motif: motif,
    p_suivre_pointage: suivrePointage,
  })

  if (error) {
    console.error('[geo] inscription refusee : ' + (error.message || '-'))
    return { ok: false, message: error.message || 'Modification impossible.' }
  }

  // null = rien n'a change. Ce n'est pas un echec, et le dire evite un
  // « enregistre » qui n'a rien enregistre.
  return { ok: true, id: data || null, sansChangement: data == null }
}
