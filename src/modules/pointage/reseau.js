// src/modules/pointage/reseau.js
// =====================================================================
// LE TEMOIN RESEAU.
//
// Au sens du temoin lumineux d'un tableau de bord : il ne bloque rien,
// il s'allume. Un pointage venu d'ailleurs que du reseau de
// l'etablissement passe quand meme -- mais il se voit.
//
// POURQUOI PAS UN REGLAGE
//   La premiere idee etait un bouton « cette connexion est celle du
//   site », clique une fois par le responsable. Mauvaise idee : un
//   reglage qu'il faut penser a faire est un reglage qui n'est jamais
//   fait, et la fonction meurt sans bruit.
//
// POURQUOI PAS « LE PREMIER QUI POINTE »
//   Mauvaise idee aussi, et pour une raison mecanique : si le premier
//   pointage du jour definit la reference, le salarie qui pointe de chez
//   lui DEVIENT la reference. Tous les autres, pointant correctement
//   depuis l'hotel, ressortiraient en anomalie. Le temoin s'allumerait a
//   l'envers -- et quiconque le comprend pointe premier, de chez lui,
//   tous les matins.
//
// DONC : LA MAJORITE
//   On observe. Le reseau que la PLUPART DES GENS utilisent la plupart du
//   temps est celui de l'etablissement. C'est un vote, pas une
//   declaration. Aucun reglage, personne a former, et quand la box change
//   d'adresse la majorite migre toute seule.
//
// TROIS PRECAUTIONS, SANS QUOI CA SE RETOURNE
//   - on compte les PERSONNES, pas les pointages : sinon quelqu'un qui
//     pointe six fois par jour gagne l'election a lui seul ;
//   - on se TAIT sous le seuil : avec trois pointages on ne sait rien, et
//     accuser quelqu'un sur trois pointages serait pire que se taire ;
//   - on juge un pointage contre la reference des semaines PRECEDENTES,
//     que l'appelant fournit -- pas contre celle du jour meme, sinon un
//     lundi ferie ou trois personnes pointent de chez elles redefinit
//     tout.
// =====================================================================

/** En dessous, le systeme n'a pas d'avis et le dit. */
export const SEUIL_POINTAGES = 10
export const SEUIL_PERSONNES = 3

export const PROVENANCES = {
  ETABLISSEMENT: 'etablissement',
  AUTRE: 'autre',
  INCONNUE: 'inconnue',
}

export const LIBELLES_PROVENANCE = {
  [PROVENANCES.ETABLISSEMENT]: 'Etablissement',
  [PROVENANCES.AUTRE]: 'Autre reseau',
  [PROVENANCES.INCONNUE]: 'Inconnue',
}

/**
 * Ramene une adresse a ce qui identifie le RESEAU, pas l'appareil.
 *
 * En IPv4, l'adresse publique est deja celle de la box : tout le monde
 * sort avec la meme. En IPv6 c'est l'inverse -- chaque telephone a sa
 * propre adresse, et seul le PREFIXE est commun a l'etablissement. Sans
 * cette distinction, le temoin dirait « autre reseau » pour tout le
 * monde, tout le temps, sans qu'on comprenne pourquoi.
 */
export function empreinteReseau(adresse) {
  const brut = String(adresse == null ? '' : adresse).trim()
  if (!brut) return null

  // inet PostgreSQL peut arriver avec un masque : 82.65.1.2/32
  const sansMasque = brut.split('/')[0]

  if (sansMasque.indexOf(':') === -1) {
    // IPv4 : l'adresse entiere identifie le reseau.
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(sansMasque) ? sansMasque : null
  }

  // IPv6 : on garde les quatre premiers groupes (/64), la partie stable
  // pour un meme abonnement.
  const groupes = sansMasque.split(':')
  if (groupes.length < 3) return null
  return groupes.slice(0, 4).join(':').toLowerCase()
}

/**
 * Le reseau de l'etablissement, deduit des pointages passes.
 *
 * @returns { empreinte, personnes, pointages, etabli } -- etabli vaut
 *          false tant qu'on est sous le seuil, et l'appelant ne doit
 *          alors accuser personne.
 */
export function reseauDeReference(pointages = []) {
  const parEmpreinte = new Map()
  let retenus = 0

  ;(pointages || []).forEach(p => {
    if (!p || !p.profile_id) return
    const empreinte = empreinteReseau(p.ip_address)
    if (!empreinte) return

    if (!parEmpreinte.has(empreinte)) parEmpreinte.set(empreinte, new Set())
    parEmpreinte.get(empreinte).add(p.profile_id)
    retenus += 1
  })

  let meilleure = null
  let meilleurNombre = 0

  parEmpreinte.forEach((personnes, empreinte) => {
    // On compte les PERSONNES distinctes, pas les pointages.
    if (personnes.size > meilleurNombre) {
      meilleurNombre = personnes.size
      meilleure = empreinte
    } else if (personnes.size === meilleurNombre && meilleure != null) {
      // Egalite parfaite : on ne tranche pas au hasard, on ne sait pas.
      meilleure = null
    }
  })

  const etabli = meilleure != null
    && retenus >= SEUIL_POINTAGES
    && meilleurNombre >= SEUIL_PERSONNES

  return {
    empreinte: etabli ? meilleure : null,
    personnes: meilleurNombre,
    pointages: retenus,
    etabli,
  }
}

/** D'ou vient ce pointage, au regard de la reference fournie. */
export function provenance(pointage, reference) {
  if (!reference || !reference.etabli) return PROVENANCES.INCONNUE
  const empreinte = empreinteReseau(pointage && pointage.ip_address)
  if (!empreinte) return PROVENANCES.INCONNUE
  return empreinte === reference.empreinte ? PROVENANCES.ETABLISSEMENT : PROVENANCES.AUTRE
}

/**
 * Marque les journees selon la provenance de leurs evenements.
 *
 * Une journee dont AU MOINS UN pointage vient d'ailleurs est signalee.
 * On ne retire aucune heure, on ne refuse rien : la journee reste
 * calculee, elle porte juste une remarque de plus.
 */
export function marquerProvenance(journees = [], reference, codeAnomalie) {
  if (!reference || !reference.etabli) return journees

  return journees.map(journee => {
    if (!journee) return journee

    const provenances = (journee.evenements || []).map(e => provenance(e, reference))
    const horsEtablissement = provenances.filter(p => p === PROVENANCES.AUTRE).length

    if (horsEtablissement === 0) return { ...journee, provenance: PROVENANCES.ETABLISSEMENT }

    const anomalies = (journee.anomalies || []).slice()
    if (codeAnomalie && !anomalies.includes(codeAnomalie)) anomalies.push(codeAnomalie)

    return {
      ...journee,
      provenance: PROVENANCES.AUTRE,
      pointagesHorsEtablissement: horsEtablissement,
      anomalies,
      // La journee reste calculee : le temoin s'allume, il ne coupe pas
      // le moteur. « complete » decrit le calcul des heures, pas la
      // confiance qu'on accorde au lieu.
    }
  })
}

/** Compte par salarie, pour la phrase « 21 sur 22 depuis l'etablissement ». */
export function comptesParSalarie(pointages = [], reference) {
  const parProfil = new Map()

  ;(pointages || []).forEach(p => {
    if (!p || !p.profile_id) return
    if (!parProfil.has(p.profile_id)) {
      parProfil.set(p.profile_id, { profileId: p.profile_id, total: 0, etablissement: 0, autre: 0, inconnue: 0 })
    }
    const c = parProfil.get(p.profile_id)
    c.total += 1
    c[provenance(p, reference)] += 1
  })

  return [...parProfil.values()]
}
