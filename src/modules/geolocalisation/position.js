// src/modules/geolocalisation/position.js
// =====================================================================
// DEMANDER SA POSITION AU NAVIGATEUR.
//
// Une seule fonction, et beaucoup de precautions -- parce que
// navigator.geolocation rate de six facons differentes et qu'elles ne
// se soignent pas pareil.
//
// LA DISTINCTION QUI COMPTE : REFUS ou ABSENCE DE SIGNAL
//   « Permission refusee » et « pas de signal » ressemblent a la meme
//   chose a l'ecran : pas de position. Ce sont pourtant deux problemes
//   opposes.
//
//   Un refus ne se resoudra JAMAIS tout seul : le navigateur ne
//   redemandera plus rien, c'est bloque dans les reglages du site. La
//   personne peut attendre une heure devant l'immeuble, rien ne viendra.
//   Il faut lui dire ou cliquer.
//
//   Une absence de signal se resout en sortant, en attendant dix
//   secondes, en s'ecartant d'un mur. Il faut lui dire de reessayer.
//
//   Les confondre, c'est laisser quelqu'un attendre indefiniment un
//   signal qui ne viendra pas -- ou lui faire trifouiller des reglages
//   alors qu'il lui suffisait de sortir du parking.
//
// AUCUNE POSITION N'EST INVENTEE
//   Pas de derniere position connue, pas de valeur par defaut, pas de
//   position du reseau quand le GPS ne repond pas. Une position
//   approximative enregistree comme une vraie serait pire que pas de
//   position : elle a l'air valide et elle ne l'est pas. Quand on ne
//   sait pas, on le dit.
// =====================================================================

/** Ce qui a empeche le relevement. L'ecran affiche un message par cas. */
export const ECHECS = {
  NON_SUPPORTE: 'non_supporte',
  REFUSE: 'refuse',
  INDISPONIBLE: 'indisponible',
  DELAI_DEPASSE: 'delai_depasse',
  INCONNU: 'inconnu',
}

export const MESSAGES_ECHEC = {
  [ECHECS.NON_SUPPORTE]:
    'Cet appareil ne sait pas donner sa position.',
  [ECHECS.REFUSE]:
    'La localisation est bloquee pour ce site. Attendre ne servira a rien : '
    + 'ouvrez les reglages du navigateur (l’icone a gauche de l’adresse), '
    + 'autorisez la position, puis rechargez la page.',
  [ECHECS.INDISPONIBLE]:
    'Position introuvable pour l’instant. En interieur ou en sous-sol, '
    + 'ressortez et reessayez.',
  [ECHECS.DELAI_DEPASSE]:
    'La position met trop de temps a arriver. Reessayez, de preference '
    + 'dehors.',
  [ECHECS.INCONNU]:
    'La position n’a pas pu etre relevee.',
}

/** Codes de l'API navigateur. Nommes, parce que 1/2/3 ne dit rien. */
const CODE_PERMISSION_REFUSEE = 1
const CODE_POSITION_INDISPONIBLE = 2
const CODE_DELAI_DEPASSE = 3

export function motifDepuisErreur(erreur) {
  if (!erreur) return ECHECS.INCONNU
  switch (erreur.code) {
    case CODE_PERMISSION_REFUSEE: return ECHECS.REFUSE
    case CODE_POSITION_INDISPONIBLE: return ECHECS.INDISPONIBLE
    case CODE_DELAI_DEPASSE: return ECHECS.DELAI_DEPASSE
    default: return ECHECS.INCONNU
  }
}

export function messageEchec(motif) {
  return MESSAGES_ECHEC[motif] || MESSAGES_ECHEC[ECHECS.INCONNU]
}

/**
 * Le relevement est-il definitivement bloque ?
 *
 * Sert a l'ecran : sur un refus, proposer « reessayer » est une
 * promesse qu'on ne peut pas tenir.
 */
export function echecDefinitif(motif) {
  return motif === ECHECS.REFUSE || motif === ECHECS.NON_SUPPORTE
}

/**
 * Releve la position courante.
 *
 * @returns {Promise<{ok: true, latitude, longitude, precisionMetres, horodatageAppareil}
 *                  | {ok: false, motif, message, definitif}>}
 *
 * Ne rejette jamais : un appelant qui oublie un catch ne doit pas faire
 * tomber l'ecran pour une position manquante.
 */
export function relever(options = {}) {
  const {
    // 15 s : au-dela, la personne a range son telephone. Mieux vaut un
    // message clair qu'une attente qui ne finit pas.
    delaiMs = 15000,
    // On refuse une position mise en cache : elle daterait d'un autre
    // endroit, et serait enregistree comme celle d'ici.
    ageMaxMs = 0,
    hautePrecision = true,
    api = typeof navigator !== 'undefined' ? navigator.geolocation : null,
  } = options

  if (!api || typeof api.getCurrentPosition !== 'function') {
    return Promise.resolve(echec(ECHECS.NON_SUPPORTE))
  }

  return new Promise((resoudre) => {
    let termine = false
    const finir = (valeur) => {
      if (termine) return
      termine = true
      resoudre(valeur)
    }

    // Filet : certains navigateurs n'appellent NI succes NI erreur quand
    // l'onglet passe en arriere-plan pendant la demande. Sans ce
    // garde-fou, la promesse ne se resout jamais et le bouton reste
    // bloque sur « ... » pour toujours.
    const minuteur = setTimeout(() => finir(echec(ECHECS.DELAI_DEPASSE)), delaiMs + 2000)

    api.getCurrentPosition(
      (position) => {
        clearTimeout(minuteur)
        const c = (position && position.coords) || {}
        if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) {
          // Le navigateur a repondu « succes » sans coordonnees
          // exploitables. Ca arrive, et enregistrer NaN serait pire.
          return finir(echec(ECHECS.INDISPONIBLE))
        }
        finir({
          ok: true,
          latitude: c.latitude,
          longitude: c.longitude,
          precisionMetres: Number.isFinite(c.accuracy) ? c.accuracy : null,
          // L'heure de l'APPAREIL, gardee a titre indicatif seulement.
          // L'horodatage qui fait foi est pose par le serveur : changer
          // l'heure d'un telephone prend dix secondes.
          horodatageAppareil: position.timestamp || null,
        })
      },
      (erreur) => {
        clearTimeout(minuteur)
        finir(echec(motifDepuisErreur(erreur)))
      },
      { enableHighAccuracy: hautePrecision, timeout: delaiMs, maximumAge: ageMaxMs },
    )
  })
}

function echec(motif) {
  return {
    ok: false,
    motif,
    message: messageEchec(motif),
    definitif: echecDefinitif(motif),
  }
}

/**
 * Un descriptif court de l'appareil, pour retrouver d'ou vient un
 * releve. Volontairement grossier : on veut « iPhone » ou « Android »,
 * pas une empreinte qui permettrait de suivre quelqu'un ailleurs.
 */
export function appareilCourt(userAgent) {
  const ua = String(userAgent || '')
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Inconnu'
}
