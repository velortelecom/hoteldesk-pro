// src/modules/pointage/journees.js
// =====================================================================
// DES EVENEMENTS AUX JOURNEES DE TRAVAIL.
//
// La table pointages stocke des EVENEMENTS : une arrivee, un debut de
// pause, une fin de pause, un depart. Chacun est une ligne, avec son
// horodatage. C'est la bonne facon de stocker -- un evenement est un
// fait, il ne se recalcule pas.
//
// Mais une feuille d'heures, une fiche de paie et l'article D.3171-8 du
// code du travail parlent de JOURNEES : le debut et la fin de chaque
// periode de travail, et le temps qui en resulte. Ce fichier fait la
// conversion, et c'est la seule chose qui la fait.
//
// CE QU'IL REMPLACE
//   getTodaySummary() calculait le temps total ainsi :
//       presentProfiles.size * 8 * 60
//   Autrement dit : « toute personne ayant pointe une arrivee a
//   travaille huit heures ». Le chiffre affiche n'etait pas une mesure,
//   c'etait une hypothese -- et c'est precisement ce qu'un decompte
//   d'heures ne doit jamais etre. Un employeur qui produit ce chiffre
//   devant un prud'homme ne prouve rien.
//
// LA REGLE QUI GOUVERNE TOUT CE FICHIER
//   Quand on ne sait pas, on ne devine pas : la journee est marquee
//   INCOMPLETE et son temps vaut null. Jamais zero (qui se lit « n'a pas
//   travaille »), jamais une estimation, jamais « jusqu'a maintenant ».
//   Une journee incomplete se corrige a la main -- c'est tout l'objet de
//   l'ecran Corrections.
// =====================================================================

/** Evenements possibles, tels que la contrainte SQL les autorise. */
export const ACTIONS = {
  ARRIVEE: 'arrivee',
  DEPART: 'depart',
  DEBUT_PAUSE: 'debut_pause',
  FIN_PAUSE: 'fin_pause',
}

/**
 * Seuls ces statuts comptent dans le temps de travail.
 *
 * Un pointage refuse ou en attente de correction n'est pas une mesure
 * fiable : l'inclure fausserait la paie. Mais il n'est pas ignore pour
 * autant -- il ressort en anomalie, parce qu'une journee qui raccourcit
 * sans explication est pire qu'une journee signalee comme douteuse.
 */
export const STATUTS_COMPTES = ['accepte', 'corrige']

export const ANOMALIES = {
  DEPART_MANQUANT: 'depart_manquant',
  ARRIVEE_MANQUANTE: 'arrivee_manquante',
  DOUBLE_ARRIVEE: 'double_arrivee',
  PAUSE_NON_FERMEE: 'pause_non_fermee',
  PAUSE_HORS_JOURNEE: 'pause_hors_journee',
  DUREE_INVRAISEMBLABLE: 'duree_invraisemblable',
  POINTAGE_NON_VALIDE: 'pointage_non_valide',
  RESEAU_INCONNU: 'reseau_inconnu',
}

export const LIBELLES_ANOMALIES = {
  [ANOMALIES.DEPART_MANQUANT]: 'Aucun depart enregistre',
  [ANOMALIES.ARRIVEE_MANQUANTE]: 'Depart sans arrivee',
  [ANOMALIES.DOUBLE_ARRIVEE]: 'Deux arrivees sans depart entre les deux',
  [ANOMALIES.PAUSE_NON_FERMEE]: 'Pause commencee et jamais terminee',
  [ANOMALIES.PAUSE_HORS_JOURNEE]: 'Pause en dehors d’une periode de travail',
  [ANOMALIES.DUREE_INVRAISEMBLABLE]: 'Duree anormalement longue',
  [ANOMALIES.POINTAGE_NON_VALIDE]: 'Contient un pointage refuse ou a verifier',
  [ANOMALIES.RESEAU_INCONNU]: 'Pointe depuis un autre reseau que l\u2019etablissement',
}

/**
 * Au-dela de cette duree, une journee est signalee. Ce n'est pas une
 * limite legale, c'est un detecteur d'oubli : le cas courant est un
 * depart jamais pointe le soir, ferme par l'arrivee du lendemain.
 *
 * LE MEME SEUIL VIT EN SQL -- duree_service_invraisemblable_heures(),
 * migration 20260919_0005. La geolocalisation s'en sert pour CESSER de
 * relever la position de quelqu'un qui a simplement oublie un bouton :
 * le suivre toute la nuit pour cette raison serait indefendable.
 *
 * Les deux doivent dire le meme nombre. Ils ont diverge une fois -- 16
 * ici, 15 en SQL -- le temps d'un commit, et journees.test.js relit
 * desormais le SQL pour casser le build si ca recommence.
 */
export const DUREE_INVRAISEMBLABLE_HEURES = 15
export const DUREE_INVRAISEMBLABLE_MINUTES = DUREE_INVRAISEMBLABLE_HEURES * 60

const MS_PAR_MINUTE = 60000

function horodatage(evenement) {
  const brut = evenement && (evenement.horodatage_evenement || evenement.horodatage)
  if (!brut) return null
  const d = brut instanceof Date ? brut : new Date(brut)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Cle de jour locale (AAAA-MM-JJ) -- surtout pas toISOString(). */
export function cleJour(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.getFullYear()
    + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0')
}

function minutesEntre(debut, fin) {
  if (!debut || !fin) return null
  return Math.max(0, Math.round((fin.getTime() - debut.getTime()) / MS_PAR_MINUTE))
}

function ajouterAnomalie(journee, code) {
  if (!journee.anomalies.includes(code)) journee.anomalies.push(code)
}

/**
 * Transforme une liste d'evenements en journees de travail.
 *
 * @param evenements  lignes de la table pointages (n'importe quel ordre)
 * @returns journees triees par profil puis par debut
 *
 * UNE JOURNEE EST ANCREE SUR L'ARRIVEE, pas sur la date de chaque
 * evenement. Une equipe de nuit qui arrive a 22h et part a 6h a
 * travaille UNE journee, celle du 22h. Decouper sur le calendrier
 * donnerait deux journees fausses, et un salarie de nuit ne serait
 * jamais paye correctement.
 */
export function construireJournees(evenements = []) {
  const valides = (evenements || [])
    .filter(e => e && e.profile_id && horodatage(e))
    .slice()
    .sort((a, b) => horodatage(a) - horodatage(b))

  const parProfil = new Map()
  valides.forEach(e => {
    if (!parProfil.has(e.profile_id)) parProfil.set(e.profile_id, [])
    parProfil.get(e.profile_id).push(e)
  })

  const journees = []

  parProfil.forEach((liste, profileId) => {
    let courante = null
    let pauseOuverte = null

    const cloturer = () => {
      if (!courante) return
      if (pauseOuverte) {
        ajouterAnomalie(courante, ANOMALIES.PAUSE_NON_FERMEE)
        pauseOuverte = null
      }
      finaliser(courante)
      journees.push(courante)
      courante = null
    }

    const ouvrir = (evenement, debut) => ({
      profileId,
      siteId: evenement.site_id || null,
      date: cleJour(debut),
      debut,
      fin: null,
      minutesPause: 0,
      minutesTravaillees: null,
      complete: false,
      anomalies: [],
      evenements: [evenement],
    })

    liste.forEach(evenement => {
      const t = horodatage(evenement)
      const compte = STATUTS_COMPTES.includes(String(evenement.statut || '').trim())

      switch (evenement.action) {
        case ACTIONS.ARRIVEE: {
          // Deux arrivees de suite : la premiere journee n'a jamais ete
          // fermee. On la cloture en anomalie plutot que d'ecraser -- une
          // journee perdue est une journee non payee.
          if (courante) {
            ajouterAnomalie(courante, ANOMALIES.DOUBLE_ARRIVEE)
            cloturer()
          }
          courante = ouvrir(evenement, t)
          if (!compte) ajouterAnomalie(courante, ANOMALIES.POINTAGE_NON_VALIDE)
          break
        }

        case ACTIONS.DEPART: {
          if (!courante) {
            // Un depart sans arrivee : on cree quand meme la journee, pour
            // qu'elle soit visible et corrigeable. L'ignorer reviendrait a
            // faire disparaitre une preuve de presence.
            courante = ouvrir(evenement, t)
            courante.debut = null
            ajouterAnomalie(courante, ANOMALIES.ARRIVEE_MANQUANTE)
          } else {
            courante.evenements.push(evenement)
          }
          courante.fin = t
          if (!compte) ajouterAnomalie(courante, ANOMALIES.POINTAGE_NON_VALIDE)
          cloturer()
          break
        }

        case ACTIONS.DEBUT_PAUSE: {
          if (!courante) {
            // Une pause hors journee ne se rattache a rien : on la garde
            // comme journee anomale plutot que de la jeter.
            courante = ouvrir(evenement, t)
            courante.debut = null
            ajouterAnomalie(courante, ANOMALIES.PAUSE_HORS_JOURNEE)
          } else {
            courante.evenements.push(evenement)
          }
          pauseOuverte = t
          if (!compte) ajouterAnomalie(courante, ANOMALIES.POINTAGE_NON_VALIDE)
          break
        }

        case ACTIONS.FIN_PAUSE: {
          if (!courante) {
            courante = ouvrir(evenement, t)
            courante.debut = null
            ajouterAnomalie(courante, ANOMALIES.PAUSE_HORS_JOURNEE)
          } else {
            courante.evenements.push(evenement)
          }
          if (pauseOuverte) {
            courante.minutesPause += minutesEntre(pauseOuverte, t) || 0
            pauseOuverte = null
          } else {
            ajouterAnomalie(courante, ANOMALIES.PAUSE_HORS_JOURNEE)
          }
          if (!compte) ajouterAnomalie(courante, ANOMALIES.POINTAGE_NON_VALIDE)
          break
        }

        default:
          // Action inconnue : on ne l'invente pas, on la rattache pour
          // qu'elle reste visible dans le detail de la journee.
          if (courante) courante.evenements.push(evenement)
          break
      }
    })

    // Journee restee ouverte en fin de liste : personne n'a pointe le
    // depart. Elle n'a PAS de temps travaille -- surtout pas « jusqu'a
    // maintenant », qui grossirait toute seule a chaque rafraichissement.
    if (courante) {
      ajouterAnomalie(courante, ANOMALIES.DEPART_MANQUANT)
      cloturer()
    }
  })

  return journees.sort((a, b) => {
    if (a.profileId !== b.profileId) return String(a.profileId).localeCompare(String(b.profileId))
    const da = a.debut || a.fin
    const db = b.debut || b.fin
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0)
  })
}

function finaliser(journee) {
  const brut = minutesEntre(journee.debut, journee.fin)

  if (brut == null) {
    journee.minutesTravaillees = null
    journee.complete = false
    return journee
  }

  if (brut > DUREE_INVRAISEMBLABLE_MINUTES) {
    ajouterAnomalie(journee, ANOMALIES.DUREE_INVRAISEMBLABLE)
  }

  journee.minutesTravaillees = Math.max(0, brut - journee.minutesPause)
  // Une journee n'est complete que si elle a un debut, une fin, et
  // aucune anomalie. Une journee a 26 heures a beau avoir ses deux
  // bornes, elle ne part pas en paie sans qu'un humain l'ait regardee.
  journee.complete = journee.anomalies.length === 0
  return journee
}

/**
 * Total des minutes REELLEMENT mesurees.
 *
 * Les journees incompletes sont exclues du total ET comptees a part :
 * un total qui les avale silencieusement est un total faux dont rien ne
 * dit qu'il est faux.
 */
export function totalMinutes(journees = []) {
  let minutes = 0
  let completes = 0
  let incompletes = 0

  journees.forEach(j => {
    if (j && j.complete && j.minutesTravaillees != null) {
      minutes += j.minutesTravaillees
      completes += 1
    } else if (j) {
      incompletes += 1
    }
  })

  return { minutes, completes, incompletes }
}

/** « 7h30 », « 0h05 », et un tiret quand il n'y a rien a afficher. */
export function formaterDuree(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—'
  const total = Math.max(0, Math.round(Number(minutes)))
  return Math.floor(total / 60) + 'h' + String(total % 60).padStart(2, '0')
}

/** Les journees qui demandent une intervention humaine. */
export function journeesAvecAnomalie(journees = []) {
  return journees.filter(j => j && j.anomalies && j.anomalies.length > 0)
}

// =====================================================================
// L'ETAT DE LA JOURNEE EN COURS
//
// Quatre pointages par jour : arrivee, debut de pause, fin de pause,
// depart. L'ecran doit donc savoir ou en est la personne AVANT qu'elle
// clique, sinon il propose n'importe quoi.
//
// CE QUI NE MARCHAIT PAS
//   L'ecran gardait l'etat dans une variable locale, remise a « arrivee »
//   a chaque rechargement de page. Quelqu'un deja pointe se voyait donc
//   proposer une deuxieme arrivee -- que le serveur refusait ensuite pour
//   double_arrivee, sans que personne comprenne pourquoi.
//
//   Et le serveur ne renvoyait qu'UNE action suivante. En service, il
//   proposait « depart » et rien d'autre : la pause etait structurellement
//   inatteignable, donc la deduction des pauses ne pouvait jamais se
//   produire. Tout le monde etait compte comme travaillant son dejeuner.
//
// LA MEME REGLE EXISTE DANS create-pointage (index.ts), qui refuse les
// enchainements impossibles. C'est volontaire : le serveur ne fait jamais
// confiance a l'ecran. services.test.js relit sa source pour verifier que
// les deux disent la meme chose.
// =====================================================================

export const ETATS = {
  HORS_SERVICE: 'hors_service',
  EN_SERVICE: 'en_service',
  EN_PAUSE: 'en_pause',
}

/**
 * Statuts qui comptent pour determiner l'etat courant.
 *
 * Volontairement plus large que STATUTS_COMPTES : un pointage a verifier
 * a bien eu lieu, il change donc l'etat de la personne, meme s'il ne
 * comptera pas dans les heures tant qu'il n'est pas corrige. Sans ca,
 * quelqu'un dont l'arrivee est en attente se verrait proposer une
 * seconde arrivee.
 */
export const STATUTS_ETAT = ['accepte', 'corrige', 'en_attente_correction']

/**
 * Ou en est la personne, et ce qu'elle peut faire maintenant.
 *
 * @param evenements  ses pointages (le dernier pertinent suffit, mais on
 *                    accepte une liste pour eviter un tri a l'appelant)
 */
export function etatJournee(evenements = []) {
  const pertinents = (evenements || [])
    .filter(e => e && horodatage(e) && STATUTS_ETAT.includes(String(e.statut || '').trim()))
    .slice()
    .sort((a, b) => horodatage(a) - horodatage(b))

  const dernier = pertinents[pertinents.length - 1] || null
  const action = dernier ? dernier.action : null

  // On regarde le DERNIER pointage, pas le dernier d'aujourd'hui : une
  // equipe de nuit arrivee a 22h part a 6h le lendemain. Filtrer sur la
  // date du jour la remettrait « hors service » a minuit, en pleine nuit
  // de travail.
  if (action === ACTIONS.ARRIVEE || action === ACTIONS.FIN_PAUSE) {
    return {
      etat: ETATS.EN_SERVICE,
      depuis: horodatage(dernier),
      // DEUX actions possibles, et c'est tout le sujet : on peut partir
      // en pause ou terminer sa journee.
      actionsAutorisees: [ACTIONS.DEBUT_PAUSE, ACTIONS.DEPART],
    }
  }

  if (action === ACTIONS.DEBUT_PAUSE) {
    return {
      etat: ETATS.EN_PAUSE,
      depuis: horodatage(dernier),
      actionsAutorisees: [ACTIONS.FIN_PAUSE],
    }
  }

  return {
    etat: ETATS.HORS_SERVICE,
    depuis: dernier ? horodatage(dernier) : null,
    actionsAutorisees: [ACTIONS.ARRIVEE],
  }
}

export const LIBELLES_ACTIONS = {
  [ACTIONS.ARRIVEE]: 'Arrivee',
  [ACTIONS.DEBUT_PAUSE]: 'Debut de pause',
  [ACTIONS.FIN_PAUSE]: 'Fin de pause',
  [ACTIONS.DEPART]: 'Depart',
}

/**
 * Temps travaille depuis le debut de la journee en cours.
 *
 * ATTENTION : ce compteur inclut la session ouverte, donc il AVANCE tant
 * que la personne n'a pas pointe son depart. C'est ce qu'on veut a
 * l'ecran -- un salarie veut voir son temps courir. Ce n'est PAS ce
 * qu'on paie : la paie lit construireJournees(), qui refuse de chiffrer
 * une journee non terminee.
 */
export function minutesEnCours(evenements = [], maintenant = new Date()) {
  const pertinents = (evenements || [])
    .filter(e => e && horodatage(e) && STATUTS_ETAT.includes(String(e.statut || '').trim()))
    .slice()
    .sort((a, b) => horodatage(a) - horodatage(b))

  let total = 0
  let debutSession = null

  pertinents.forEach(e => {
    const t = horodatage(e)
    if (e.action === ACTIONS.ARRIVEE || e.action === ACTIONS.FIN_PAUSE) {
      debutSession = t
    } else if ((e.action === ACTIONS.DEPART || e.action === ACTIONS.DEBUT_PAUSE) && debutSession) {
      total += minutesEntre(debutSession, t) || 0
      debutSession = null
    }
  })

  if (debutSession) total += minutesEntre(debutSession, maintenant) || 0
  return total
}
