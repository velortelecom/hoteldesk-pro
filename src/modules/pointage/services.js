import { supabase } from '../../lib/supabase'
import { DEFAULT_POINTAGE_SETTINGS } from './config.js'

const EMPTY_STATS = {
  totalEmployes: 0,
  present: 0,
  absents: 0,
  retards: 0,
  tempsTotal: '0h',
}

function getDayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return { start: start.toISOString(), end: end.toISOString() }
}

function formatMinutes(minutes = 0) {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return `${hours}h ${mins.toString().padStart(2, '0')}m`
}

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

export async function getPointages(profile) {
  if (!profile?.entreprise_id) return []

  const { data: pointagesRaw, error } = await supabase
    .from('pointages')
    .select('*')
    .eq('entreprise_id', profile.entreprise_id)
    .order('horodatage_evenement', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Pointage: erreur lors du chargement de l’historique', error)
    return []
  }

  const profileIds = [...new Set((pointagesRaw || []).map((pointage) => pointage.profile_id).filter(Boolean))]
  const siteIds = [...new Set((pointagesRaw || []).map((pointage) => pointage.site_id).filter(Boolean))]

  const [{ data: profilesData = [] }, { data: sitesData = [] }] = await Promise.all([
    profileIds.length > 0
      ? supabase.from('profiles').select('id, prenom, nom').in('id', profileIds)
      : Promise.resolve({ data: [] }),
    siteIds.length > 0
      ? supabase.from('sites').select('id, nom').in('id', siteIds)
      : Promise.resolve({ data: [] }),
  ])

  const profilesById = new Map((profilesData || []).map((entry) => [entry.id, entry]))
  const sitesById = new Map((sitesData || []).map((entry) => [entry.id, entry]))

  return (pointagesRaw || []).map((pointage) => {
    const personnel = profilesById.get(pointage.profile_id) || {}
    const site = sitesById.get(pointage.site_id) || {}
    const employeLabel = [personnel.prenom, personnel.nom].filter(Boolean).join(' ').trim() || 'Employé'

    return {
      id: pointage.id,
      employe: employeLabel,
      site: site.nom || 'Site inconnu',
      date: formatDate(pointage.horodatage_evenement),
      entree: pointage.action === 'arrivee' || pointage.action === 'debut_pause' ? formatTime(pointage.horodatage_evenement) : '—',
      sortie: pointage.action === 'depart' || pointage.action === 'fin_pause' ? formatTime(pointage.horodatage_evenement) : '—',
      statut: formatStatut(pointage.statut),
      rawStatut: pointage.statut,
    }
  })
}

export async function getTodaySummary(profile) {
  if (!profile?.entreprise_id) return EMPTY_STATS

  const { start, end } = getDayRange()

  const [{ data: employees = [] }, { data: pointagesRaw = [] }] = await Promise.all([
    supabase.from('profiles').select('id').eq('entreprise_id', profile.entreprise_id).eq('actif', true),
    supabase
      .from('pointages')
      .select('profile_id, action, statut, horodatage_evenement')
      .eq('entreprise_id', profile.entreprise_id)
      .gte('horodatage_evenement', start)
      .lte('horodatage_evenement', end),
  ])

  const presentProfiles = new Set()
  const retards = new Set()

  for (const pointage of pointagesRaw || []) {
    if (pointage.statut === 'accepte' && pointage.action === 'arrivee') {
      presentProfiles.add(pointage.profile_id)
    }

    if (pointage.statut === 'en_attente_correction' || pointage.statut === 'refuse') {
      retards.add(pointage.profile_id)
    }
  }

  const totalMinutes = Math.max(0, presentProfiles.size) * 8 * 60

  return {
    totalEmployes: employees.length,
    present: presentProfiles.size,
    absents: Math.max(0, employees.length - presentProfiles.size),
    retards: retards.size,
    tempsTotal: formatMinutes(totalMinutes),
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
