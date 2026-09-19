import { supabase } from '../../lib/supabase'
import { messageErreurEdge } from '../../lib/edgeErreur'
import { DEFAULT_POINTAGE_SETTINGS } from './config.js'
import {
  ANOMALIES, construireJournees, etatJournee, formaterDuree,
  journeesAvecAnomalie, LIBELLES_ANOMALIES, minutesEnCours, STATUTS_ETAT,
  totalMinutes,
} from './journees.js'
import {
  LIBELLES_PROVENANCE, marquerProvenance, PROVENANCES, reseauDeReference,
} from './reseau.js'

const EMPTY_STATS = {
  totalEmployes: 0,
  present: 0,
  absents: 0,
  aCorriger: 0,
  tempsTotal: '\u2014',
  journeesCompletes: 0,
  journeesIncompletes: 0,
}

function getDayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return { start: start.toISOString(), end: end.toISOString() }
}

// formatMinutes() a ete SUPPRIME : formaterDuree() (journees.js) est
// desormais le seul formateur de duree du module. Deux formateurs, c'est
// deux formats a l'ecran et, tot ou tard, deux facons d'arrondir.

function formatTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR')
}

export function formatStatut(statut) {
  switch (String(statut || '').trim()) {
    case 'accepte':
      return 'Validé'
    case 'en_attente_correction':
      return 'À vérifier'
    case 'refuse':
      return 'Refusé'
    case 'corrige':
      return 'Corrigé'
    default:
      return 'Inconnu'
  }
}

/**
 * L'historique, en JOURNEES.
 *
 * Cette fonction renvoyait une ligne par EVENEMENT, avec la colonne
 * « entree » remplie pour une arrivee et « sortie » pour un depart --
 * donc deux lignes par journee, chacune a moitie vide, et aucune duree
 * nulle part. On ne pouvait ni lire une feuille d'heures, ni la donner a
 * un comptable, ni la produire en cas de litige.
 *
 * L'appariement se fait dans journees.js, une seule fois, teste.
 */
export async function getPointages(profile, options = {}) {
  if (!profile?.entreprise_id) return []

  const limite = options.limite || 500

  const { data: pointagesRaw, error } = await supabase
    .from('pointages')
    .select('*')
    .eq('entreprise_id', profile.entreprise_id)
    .order('horodatage_evenement', { ascending: false })
    .limit(limite)

  if (error) {
    // On ne renvoie pas une liste vide sans rien dire : un historique
    // vide se lit « personne n'a pointe », ce qui est un mensonge quand
    // la lecture a simplement echoue.
    console.error(
      '[pointage] lecture de l\'historique impossible. '
      + 'code=' + (error.code || '-')
      + ' message=' + (error.message || '-')
      + ' details=' + (error.details || '-')
      + ' hint=' + (error.hint || '-'),
    )
    throw new Error(error.message || 'Historique illisible.')
  }

  const evenements = pointagesRaw || []

  // TEMOIN RESEAU. La reference se deduit de la majorite des pointages
  // lus -- soit plusieurs semaines pour une petite equipe. Aucun reglage,
  // personne a former : le reseau que la plupart des gens utilisent la
  // plupart du temps est celui de l'etablissement.
  //
  // Sous le seuil, reseauDeReference renvoie etabli: false et
  // marquerProvenance ne touche a rien. On n'accuse personne tant qu'on
  // ne sait pas.
  const reference = reseauDeReference(evenements)
  const journees = marquerProvenance(
    construireJournees(evenements),
    reference,
    ANOMALIES.RESEAU_INCONNU,
  )

  const profileIds = [...new Set(evenements.map(p => p.profile_id).filter(Boolean))]
  const siteIds = [...new Set(evenements.map(p => p.site_id).filter(Boolean))]

  const [{ data: profilesData = [] }, { data: sitesData = [] }] = await Promise.all([
    profileIds.length > 0
      ? supabase.from('profiles').select('id, prenom, nom').in('id', profileIds)
      : Promise.resolve({ data: [] }),
    siteIds.length > 0
      ? supabase.from('sites').select('id, nom').in('id', siteIds)
      : Promise.resolve({ data: [] }),
  ])

  const profilesById = new Map((profilesData || []).map(e => [e.id, e]))
  const sitesById = new Map((sitesData || []).map(e => [e.id, e]))

  return journees
    .slice()
    .sort((a, b) => {
      const da = a.debut || a.fin
      const db = b.debut || b.fin
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0)
    })
    .map(journee => {
      const personnel = profilesById.get(journee.profileId) || {}
      const site = sitesById.get(journee.siteId) || {}

      return {
        id: journee.profileId + '@' + (journee.date || 'sans-date')
          + '@' + (journee.debut ? journee.debut.getTime() : (journee.fin ? journee.fin.getTime() : '0')),
        profileId: journee.profileId,
        employe: [personnel.prenom, personnel.nom].filter(Boolean).join(' ').trim() || 'Employe',
        site: site.nom || 'Site inconnu',
        date: formatDate(journee.debut || journee.fin),
        // La cle de jour LOCALE (AAAA-MM-JJ), gardee telle quelle a cote
        // de la date affichee : « 19/09/2026 » se lit bien mais ne se
        // trie ni ne se regroupe par mois sans la reanalyser -- et la
        // reanalyser, c'est se tromper un jour sur le fuseau.
        jour: journee.date || null,
        periode: (journee.date || '').slice(0, 7) || null,
        entree: formatTime(journee.debut),
        sortie: formatTime(journee.fin),
        pause: journee.minutesPause > 0 ? formaterDuree(journee.minutesPause) : '\u2014',
        duree: formaterDuree(journee.minutesTravaillees),
        minutesTravaillees: journee.minutesTravaillees,
        complete: journee.complete,
        anomalies: journee.anomalies,
        // Libelles lisibles : l'ecran n'a pas a connaitre les codes.
        anomaliesLisibles: journee.anomalies.map(code => LIBELLES_ANOMALIES[code] || code),
        provenance: journee.provenance || PROVENANCES.INCONNUE,
        provenanceLisible: LIBELLES_PROVENANCE[journee.provenance || PROVENANCES.INCONNUE],
      }
    })
}

/**
 * Le tableau de bord du jour.
 *
 * CE QUI ETAIT FAUX
 *   const totalMinutes = presentProfiles.size * 8 * 60
 *
 *   Autrement dit : « toute personne ayant pointe une arrivee a
 *   travaille huit heures ». Le « temps total » affiche n'etait pas une
 *   mesure mais une hypothese, et personne ne pouvait le savoir en
 *   regardant l'ecran. C'est la seule chose que ce module ne doit jamais
 *   faire : le decompte des heures est ce qui a une valeur legale.
 *
 *   Le compteur « retards » comptait, lui, les pointages refuses ou en
 *   attente de correction. Ce ne sont pas des retards -- ce sont des
 *   journees a verifier. Il est renomme.
 *
 * Desormais le temps vient de journees.js : mesure, et seulement sur les
 * journees completes. Les incompletes sont affichees a part.
 */
export async function getTodaySummary(profile) {
  if (!profile?.entreprise_id) return EMPTY_STATS

  const { start, end } = getDayRange()

  const [employesRes, pointagesRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('entreprise_id', profile.entreprise_id).eq('actif', true),
    supabase
      .from('pointages')
      .select('id, profile_id, site_id, action, statut, horodatage_evenement')
      .eq('entreprise_id', profile.entreprise_id)
      .gte('horodatage_evenement', start)
      .lte('horodatage_evenement', end),
  ])

  const echec = employesRes.error || pointagesRes.error
  if (echec) {
    console.error(
      '[pointage] tableau de bord illisible. '
      + 'code=' + (echec.code || '-')
      + ' message=' + (echec.message || '-')
      + ' details=' + (echec.details || '-')
      + ' hint=' + (echec.hint || '-'),
    )
    throw new Error(echec.message || 'Tableau de bord illisible.')
  }

  const employes = employesRes.data || []
  const evenements = pointagesRes.data || []

  const journees = construireJournees(evenements)
  const total = totalMinutes(journees)

  // Present = a pointe une arrivee aujourd'hui, quel que soit l'etat de
  // sa journee. Quelqu'un dont le depart manque est bien present.
  const presents = new Set(
    journees.filter(j => j.debut != null).map(j => j.profileId),
  )

  return {
    totalEmployes: employes.length,
    present: presents.size,
    absents: Math.max(0, employes.length - presents.size),
    aCorriger: journeesAvecAnomalie(journees).length,
    // Un tiret quand rien n'est mesurable : « 0h » se lirait « personne
    // n'a travaille », ce qui est different de « on ne sait pas encore ».
    tempsTotal: total.completes > 0 ? formaterDuree(total.minutes) : '\u2014',
    journeesCompletes: total.completes,
    journeesIncompletes: total.incompletes,
  }
}

export async function getSitesSummary(profile) {
  if (!profile?.entreprise_id) return []

  const [{ data: sites = [] }, { data: members = [] }] = await Promise.all([
    supabase.from('sites').select('id, nom, latitude, longitude, rayon_pointage_metres, pointage_gps_obligatoire').eq('entreprise_id', profile.entreprise_id),
    supabase.from('profiles').select('id, site_id').eq('entreprise_id', profile.entreprise_id).eq('actif', true),
  ])

  const effectifParSite = new Map()
  for (const member of members || []) {
    const current = effectifParSite.get(member.site_id) || 0
    effectifParSite.set(member.site_id, current + 1)
  }

  return (sites || []).map((site) => ({
    id: site.id,
    nom: site.nom,
    equipe: effectifParSite.get(site.id) || 0,
    actif: Boolean(site.latitude && site.longitude && site.rayon_pointage_metres),
    rayonPointageMetres: site.rayon_pointage_metres,
    gpsObligatoire: site.pointage_gps_obligatoire,
  }))
}

/**
 * Les parametres REELS du pointage.
 *
 * CE QUI ETAIT FAUX
 *   Cette fonction inventait quatre reglages qui n'existent nulle part en
 *   base, en les branchant sur des colonnes sans rapport :
 *
 *     toleranceRetardMinutes   <- precision_gps_max_metres
 *     heuresParJour            <- duree_max_entre_pointages_minutes
 *     autoriserPointageMobile  <- gps_obligatoire
 *     notificationRetards      <- autoriser_hors_zone_avec_validation
 *
 *   L'ecran affichait donc « Tolerance de retard : 50 minutes » alors que
 *   50 etait une precision GPS EN METRES. Quatre valeurs lues, quatre
 *   mensonges, et rien pour s'en apercevoir.
 *
 * On renvoie maintenant ce que la table contient vraiment. Les reglages
 * qui n'existent pas ne sont plus affiches : mieux vaut un ecran court et
 * vrai qu'un ecran complet et faux.
 */
export async function getPointageSettings(profile) {
  if (!profile?.entreprise_id) return null

  const { data, error } = await supabase
    .from('entreprise_parametres_pointage')
    .select('precision_gps_max_metres, gps_obligatoire, autoriser_hors_zone_avec_validation, duree_max_entre_pointages_minutes, methodes_actives')
    .eq('entreprise_id', profile.entreprise_id)
    .maybeSingle()

  if (error) {
    console.error(
      '[pointage] parametres illisibles. '
      + 'code=' + (error.code || '-')
      + ' message=' + (error.message || '-')
      + ' details=' + (error.details || '-')
      + ' hint=' + (error.hint || '-'),
    )
    throw new Error(error.message || 'Parametres illisibles.')
  }

  // Aucune ligne : l'entreprise n'a jamais ete parametree. On le DIT, au
  // lieu d'afficher des valeurs par defaut que personne n'a choisies.
  if (!data) return { ...DEFAULT_POINTAGE_SETTINGS, parametree: false }

  const methodes = data.methodes_actives || {}

  return {
    parametree: true,
    precisionGpsMaxMetres: data.precision_gps_max_metres,
    gpsObligatoire: data.gps_obligatoire === true,
    autoriserHorsZoneAvecValidation: data.autoriser_hors_zone_avec_validation === true,
    dureeMaxEntrePointagesMinutes: data.duree_max_entre_pointages_minutes,
    methodesActives: Object.keys(methodes).filter(cle => methodes[cle] === true),
  }
}

/**
 * Ou en est la personne connectee, MAINTENANT.
 *
 * L'ecran gardait cet etat dans une variable locale, remise a « arrivee »
 * a chaque rechargement de page : quelqu'un deja pointe se voyait
 * proposer une seconde arrivee, que le serveur refusait ensuite pour
 * double_arrivee sans que personne comprenne. On lit donc la base.
 *
 * On remonte 48 heures et pas « depuis minuit » : une equipe de nuit
 * arrivee a 22h est toujours en service a 2h du matin. Couper a minuit la
 * remettrait hors service en pleine nuit de travail.
 */
export async function getEtatJour(profile) {
  if (!profile?.id) return null

  const depuis = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const { data, error } = await supabase
    .from('pointages')
    .select('id, action, statut, horodatage_evenement')
    .eq('profile_id', profile.id)
    .in('statut', STATUTS_ETAT)
    .gte('horodatage_evenement', depuis)
    .order('horodatage_evenement', { ascending: true })

  if (error) {
    // Sans etat lisible, l'ecran ne doit PAS retomber sur « arrivee » :
    // ce serait proposer un pointage qui sera refuse.
    console.error(
      '[pointage] etat du jour illisible. '
      + 'code=' + (error.code || '-')
      + ' message=' + (error.message || '-')
      + ' details=' + (error.details || '-')
      + ' hint=' + (error.hint || '-'),
    )
    throw new Error(error.message || 'Impossible de lire votre journee en cours.')
  }

  const evenements = data || []
  const etat = etatJournee(evenements)

  return {
    ...etat,
    minutesJour: minutesEnCours(evenements),
    evenements,
  }
}

/** Methodes de pointage, telles que la base et la fonction serveur les connaissent. */
export const METHODES = {
  /** Les heures : depuis l'application, sans aucune position. */
  NAVIGATEUR: 'navigateur',
  /** L'itinerance : la position EST le sujet. */
  GPS: 'gps',
}

export async function createPointageEntry({
  profile,
  action,
  methode = METHODES.NAVIGATEUR,
  latitude = null,
  longitude = null,
  precisionMetres = null,
  appareil = null,
  timezone = null,
  commentaire = null,
}) {
  if (!profile?.id || !profile?.entreprise_id) {
    throw new Error('Impossible de lancer un pointage sans utilisateur connecte.')
  }

  // La methode n'etait PAS un parametre : tout partait en 'gps', y compris
  // le pointage d'une receptionniste derriere son comptoir. Le serveur
  // exigeait alors une position que le navigateur n'avait jamais demandee,
  // et refusait le pointage. Personne ne pouvait pointer.
  //
  // Un pointage d'heures ne transporte aucune coordonnee. Ce n'est pas un
  // oubli qu'on rattrape plus tard : c'est la separation entre compter le
  // temps de travail et savoir ou se trouve quelqu'un. La CNIL interdit
  // d'ailleurs de calculer le temps de travail a partir de la
  // geolocalisation quand un autre moyen existe -- et il existe.
  const sansPosition = methode === METHODES.NAVIGATEUR

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown-agent'
  const resolvedTimezone = timezone
    || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null)

  const { data, error } = await supabase.functions.invoke('create-pointage', {
    body: {
      action,
      methode,
      latitude: sansPosition ? null : latitude,
      longitude: sansPosition ? null : longitude,
      precision_metres: sansPosition ? null : precisionMetres,
      appareil,
      user_agent: userAgent,
      timezone: resolvedTimezone,
      commentaire,
    },
  })

  if (error) {
    throw new Error(await messagePointage(error))
  }

  if (!data?.success) {
    throw new Error(messageRefus(data))
  }

  return data
}

/**
 * Traduit ce que renvoie le serveur.
 *
 * L'ecran affichait le code brut : « Le pointage a ete refuse :
 * gps_manquant ». Un employe ne sait pas quoi en faire, et un responsable
 * non plus.
 */
export function messageRefus(data) {
  const code = String(data?.error || data?.motif_refus || '').trim()

  switch (code) {
    case 'module_inactive':
      return 'Le module Pointage n\'est pas actif pour votre entreprise. '
        + 'Si vous y etes abonne, la fonction create-pointage doit etre redeployee.'
    case 'methode_disabled':
      return 'Cette facon de pointer n\'est pas autorisee dans votre entreprise.'
    case 'methode_unknown':
      // Cas typique : la fonction serveur n'a pas ete redeployee et ne
      // connait pas encore la methode « navigateur ».
      return 'Cette facon de pointer n\'est pas reconnue par le serveur. '
        + 'La fonction create-pointage doit etre redeployee.'
    case 'double_arrivee':
      return 'Vous avez deja pointe votre arrivee. Rechargez la page.'
    case 'depart_sans_arrivee':
      return 'Aucune arrivee en cours : impossible de pointer un depart.'
    case 'pause_incoherente':
      return 'Cette pause ne s\'enchaine pas avec votre dernier pointage. Rechargez la page.'
    case 'invalid_token':
    case 'missing_token':
      return 'Votre session a expire. Reconnectez-vous.'
    case 'profile_not_found':
      return 'Votre profil est introuvable. Reconnectez-vous.'
    case 'gps_manquant':
      return 'Position introuvable. Autorisez la localisation, ou pointez sans position si votre entreprise l\'autorise.'
    case 'site_non_configure':
      return 'Votre site n\'a pas de coordonnees enregistrees : le pointage geolocalise est impossible tant qu\'elles manquent.'
    case 'hors_zone':
      return 'Vous etes en dehors de la zone du site. Le pointage est enregistre mais doit etre verifie.'
    case 'position_non_attendue':
      return 'Un pointage d\'heures ne transporte pas de position.'
    case '':
      return 'Le pointage n\'a pas pu etre enregistre.'
    default:
      return 'Le pointage n\'a pas pu etre enregistre (' + code + ').'
  }
}

/**
 * Le VRAI motif du refus, pas « non-2xx status code ».
 *
 * supabase.functions.invoke() rend toujours la meme erreur :
 * « Edge Function returned a non-2xx status code ». Le motif reel --
 * module_inactive, methode_disabled, gps_manquant -- est dans le CORPS
 * de la reponse, accessible via error.context.
 *
 * Je l'ai appris a mes depens : l'ecran affichait cette phrase inutile
 * alors que la fonction disait precisement ce qui n'allait pas. Le
 * helper qui lit ce corps existait deja dans le projet (lib/edgeErreur),
 * ecrit pour exactement ce probleme sur un autre ecran -- je ne l'avais
 * pas branche ici.
 */
async function messagePointage(error) {
  // Le helper renvoie « explication (code) » quand il trouve un code.
  const detaille = await messageErreurEdge(error, '')
  console.error('[pointage] create-pointage a echoue : ' + (detaille || error?.message || '-'))

  const code = extraireCode(detaille)
  if (code) return messageRefus({ error: code })
  if (detaille) return detaille

  return error?.message || 'Le service de pointage est injoignable.'
}

/** « Explication (module_inactive) » -> « module_inactive ». */
function extraireCode(texte) {
  const trouve = /\(([a-z_]+)\)\s*$/.exec(String(texte || ''))
  return trouve ? trouve[1] : null
}

/**
 * Tous les evenements d'un mois, pour l'export de paie.
 *
 * On lit LARGE : du 1er du mois moins deux jours au 1er du mois suivant
 * plus deux jours. Une nuit du 31 au 1er doit etre complete pour etre
 * appariee -- si on coupait pile aux bornes du mois, il manquerait
 * l'arrivee ou le depart, et la nuit deviendrait une anomalie au lieu
 * d'une journee payee. Le decoupage par mois se fait ensuite sur la
 * journee construite, pas sur les evenements.
 */
export async function getEvenementsMois(profile, periode) {
  if (!profile?.entreprise_id) return { evenements: [], noms: {} }

  const bouts = String(periode || '').split('-')
  const annee = Number(bouts[0])
  const mois = Number(bouts[1])
  if (!Number.isFinite(annee) || !Number.isFinite(mois)) {
    throw new Error('Periode illisible : ' + periode)
  }

  const debut = new Date(annee, mois - 1, 1)
  debut.setDate(debut.getDate() - 2)
  const fin = new Date(annee, mois, 1)
  fin.setDate(fin.getDate() + 2)

  const { data, error } = await supabase
    .from('pointages')
    .select('id, profile_id, site_id, action, statut, ip_address, horodatage_evenement')
    .eq('entreprise_id', profile.entreprise_id)
    .gte('horodatage_evenement', debut.toISOString())
    .lt('horodatage_evenement', fin.toISOString())
    .order('horodatage_evenement', { ascending: true })

  if (error) {
    console.error(
      '[pointage] evenements du mois illisibles. '
      + 'code=' + (error.code || '-')
      + ' message=' + (error.message || '-')
      + ' details=' + (error.details || '-')
      + ' hint=' + (error.hint || '-'),
    )
    throw new Error(error.message || 'Impossible de lire les pointages du mois.')
  }

  const evenements = data || []
  const profileIds = [...new Set(evenements.map(e => e.profile_id).filter(Boolean))]

  const { data: profils } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, prenom, nom').in('id', profileIds)
    : { data: [] }

  const noms = {}
  ;(profils || []).forEach(p => {
    noms[p.id] = [p.prenom, p.nom].filter(Boolean).join(' ').trim() || p.id
  })

  return { evenements, noms }
}
