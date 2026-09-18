import { supabase } from '../../lib/supabase'
import { DEFAULT_POINTAGE_SETTINGS } from './config.js'
import {
  construireJournees, formaterDuree, journeesAvecAnomalie,
  LIBELLES_ANOMALIES, totalMinutes,
} from './journees.js'

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
  const journees = construireJournees(evenements)

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
        entree: formatTime(journee.debut),
        sortie: formatTime(journee.fin),
        pause: journee.minutesPause > 0 ? formaterDuree(journee.minutesPause) : '\u2014',
        duree: formaterDuree(journee.minutesTravaillees),
        minutesTravaillees: journee.minutesTravaillees,
        complete: journee.complete,
        anomalies: journee.anomalies,
        // Libelles lisibles : l'ecran n'a pas a connaitre les codes.
        anomaliesLisibles: journee.anomalies.map(code => LIBELLES_ANOMALIES[code] || code),
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

export async function getPointageSettings(profile) {
  if (!profile?.entreprise_id) return DEFAULT_POINTAGE_SETTINGS

  const { data, error } = await supabase
    .from('entreprise_parametres_pointage')
    .select('precision_gps_max_metres, gps_obligatoire, autoriser_hors_zone_avec_validation, duree_max_entre_pointages_minutes, methodes_actives')
    .eq('entreprise_id', profile.entreprise_id)
    .maybeSingle()

  if (error) {
    console.error('Pointage: impossible de lire les paramètres', error)
    return DEFAULT_POINTAGE_SETTINGS
  }

  return {
    ...DEFAULT_POINTAGE_SETTINGS,
    toleranceRetardMinutes: data?.precision_gps_max_metres ?? DEFAULT_POINTAGE_SETTINGS.toleranceRetardMinutes,
    heuresParJour: data?.duree_max_entre_pointages_minutes ?? DEFAULT_POINTAGE_SETTINGS.heuresParJour,
    autoriserPointageMobile: data?.gps_obligatoire ?? DEFAULT_POINTAGE_SETTINGS.autoriserPointageMobile,
    notificationRetards: data?.autoriser_hors_zone_avec_validation ?? DEFAULT_POINTAGE_SETTINGS.notificationRetards,
  }
}

export async function createPointageEntry({
  profile,
  action,
  latitude = null,
  longitude = null,
  precisionMetres = null,
  appareil = null,
  timezone = null,
  commentaire = null,
}) {
  if (!profile?.id || !profile?.entreprise_id) {
    throw new Error('Impossible de lancer un pointage sans utilisateur connecté.')
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown-agent'
  const resolvedTimezone = timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null)

  const { data, error } = await supabase.functions.invoke('create-pointage', {
    body: {
      action,
      latitude,
      longitude,
      precision_metres: precisionMetres,
      appareil,
      user_agent: userAgent,
      timezone: resolvedTimezone,
      commentaire,
      methode: 'gps',
    },
  })

  if (error) {
    throw new Error(error.message || 'Erreur de pointage côté Supabase.')
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Le pointage n’a pas pu être enregistré.')
  }

  return data
}
