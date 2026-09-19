// src/modules/geolocalisation/carte.js
// =====================================================================
// PREPARER LES RELEVES POUR LA CARTE.
//
// AUCUNE BIBLIOTHEQUE DE CARTOGRAPHIE
//   Leaflet ou Mapbox ajouteraient des centaines de kilo-octets, une
//   cle d'API a gerer, et un tiers qui verrait passer les positions des
//   salaries de nos clients. Pour repondre a « ou etait-il ? », un lien
//   vers une carte ouvert a la demande suffit -- et rien ne part chez
//   personne tant que l'utilisateur ne clique pas.
//
//   Le jour ou il faudra vraiment une carte dans la page, ce fichier
//   fournira deja les points groupes ; il n'y aura que l'affichage a
//   ajouter.
//
// CE QU'ON MONTRE, ET CE QU'ON NE MONTRE PAS
//   On groupe par personne et par jour. Une liste de trois cents points
//   bruts ne repond a aucune question ; « Paul, jeudi, six releves,
//   tous chez le client » y repond.
//
//   Et on separe les releves de CONNEXION des actes de travail. Les
//   premiers disent seulement « l'application a ete ouverte ici ». Les
//   confondre donnerait une carte ou une consultation depuis le
//   parking ressemble a une intervention.
// =====================================================================
import { ACTIONS_RELEVE } from './services.js'

export const LIBELLES_ACTIONS = {
  [ACTIONS_RELEVE.CONNEXION]: 'Connexion',
  [ACTIONS_RELEVE.TACHE_TERMINEE]: 'Tâche terminée',
  [ACTIONS_RELEVE.PHOTO]: 'Photo',
  [ACTIONS_RELEVE.VISITE]: 'Visite',
  [ACTIONS_RELEVE.INTERVENTION_DEBUT]: 'Début d’intervention',
}

/** Un releve de connexion n'est pas un acte de travail. */
export function estActeDeTravail(releve) {
  return !!releve && releve.action_type !== ACTIONS_RELEVE.CONNEXION
}

/** Cle de jour LOCALE (AAAA-MM-JJ) -- surtout pas toISOString(). */
export function jourLocal(valeur) {
  if (!valeur) return null
  const d = valeur instanceof Date ? valeur : new Date(valeur)
  if (Number.isNaN(d.getTime())) return null
  return d.getFullYear()
    + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0')
}

export function heureLocale(valeur) {
  if (!valeur) return ''
  const d = valeur instanceof Date ? valeur : new Date(valeur)
  if (Number.isNaN(d.getTime())) return ''
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/**
 * Une coordonnee est-elle reellement fournie ?
 *
 * Number(null) vaut 0, et Number.isFinite(0) vaut true. Une position
 * absente passait donc le controle et s'affichait « 0, 0 » -- un point
 * reel dans le golfe de Guinee. Le releve se serait lu « au large de
 * l'Afrique » au lieu de « inconnu », et personne n'aurait su que la
 * donnee manquait.
 *
 * On ecarte donc null, undefined et la chaine vide AVANT de convertir.
 */
function coordonneeFournie(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return false
  return Number.isFinite(Number(valeur))
}

/**
 * Un lien vers une carte, ouvert a la demande.
 *
 * Rien n'est charge tant que personne ne clique : aucune position de
 * salarie ne part chez un tiers pendant la simple consultation de la
 * liste.
 */
export function lienCarte(latitude, longitude) {
  if (!coordonneeFournie(latitude) || !coordonneeFournie(longitude)) return null
  return 'https://www.openstreetmap.org/?mlat=' + latitude + '&mlon=' + longitude + '#map=17/' + latitude + '/' + longitude
}

/** Coordonnees lisibles, arrondies : cinq decimales valent ~1 m. */
export function coordonneesLisibles(latitude, longitude) {
  if (!coordonneeFournie(latitude) || !coordonneeFournie(longitude)) return '—'
  return Number(latitude).toFixed(5) + ', ' + Number(longitude).toFixed(5)
}

/**
 * Groupe les releves par personne, puis par jour.
 *
 * @returns [{ profileId, nom, jours: [{ jour, releves, actes, connexions,
 *             horsZone, premier, dernier }] }]
 */
export function grouperParPersonneEtJour(releves = [], nomsParProfil = {}) {
  const parProfil = new Map()

  ;(releves || []).forEach((r) => {
    if (!r || !r.profile_id) return
    const jour = jourLocal(r.releve_le)
    if (!jour) return

    if (!parProfil.has(r.profile_id)) {
      parProfil.set(r.profile_id, {
        profileId: r.profile_id,
        nom: nomsParProfil[r.profile_id] || r.profile_id,
        parJour: new Map(),
      })
    }
    const personne = parProfil.get(r.profile_id)

    if (!personne.parJour.has(jour)) {
      personne.parJour.set(jour, { jour, releves: [] })
    }
    personne.parJour.get(jour).releves.push(r)
  })

  return [...parProfil.values()]
    .map((personne) => ({
      profileId: personne.profileId,
      nom: personne.nom,
      jours: [...personne.parJour.values()]
        .map((j) => {
          // Du plus ancien au plus recent DANS la journee : on lit une
          // journee dans l'ordre ou elle s'est passee.
          const triees = j.releves.slice().sort(
            (a, b) => new Date(a.releve_le) - new Date(b.releve_le),
          )
          const actes = triees.filter(estActeDeTravail)
          return {
            jour: j.jour,
            releves: triees,
            actes: actes.length,
            connexions: triees.length - actes.length,
            // dans_le_rayon vaut null quand aucun site n'etait fourni :
            // ce n'est PAS « hors zone », c'est « on ne comparait a
            // rien ». Seul false compte.
            horsZone: triees.filter((r) => r.dans_le_rayon === false).length,
            premier: triees[0] || null,
            dernier: triees[triees.length - 1] || null,
          }
        })
        .sort((a, b) => String(b.jour).localeCompare(String(a.jour))),
    }))
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'))
}

/** Le compte d'ensemble, pour l'en-tete de l'ecran. */
export function resumeReleves(releves = []) {
  const liste = releves || []
  const actes = liste.filter(estActeDeTravail)

  return {
    total: liste.length,
    actes: actes.length,
    connexions: liste.length - actes.length,
    horsZone: liste.filter((r) => r && r.dans_le_rayon === false).length,
    personnes: new Set(liste.map((r) => r && r.profile_id).filter(Boolean)).size,
  }
}
