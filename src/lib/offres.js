// src/lib/offres.js
// =====================================================================
// LA GRILLE COMMERCIALE DE VELOR ONE -- SOURCE UNIQUE.
//
// POURQUOI CE FICHIER EXISTE
//   Le contenu des packs etait ecrit a QUATRE endroits : registry.js,
//   plan1.js, plan1.ts et la RPC SQL d'inscription. Ils s'etaient deja
//   contredits : le registre annoncait le pointage dans starter, les trois
//   autres non. C'est la meme famille de bug que les departements
//   code/nom et les deux chemins de suppression -- une regle ecrite en
//   plusieurs endroits finit toujours par diverger.
//
//   Desormais tout part d'ici. Les autres fichiers s'y referent ou sont
//   verifies contre lui par offres.test.js, qui casse le build en cas
//   d'ecart.
//
// CHANGER UN PRIX
//   Une seule ligne a modifier dans OFFRES. Rien d'autre.
//
// LA REGLE DES OPTIONS (pourquoi 20 EUR et pas 15)
//   Un module Premium s'achete a l'unite depuis n'importe quel pack. Le
//   prix de l'option doit valoir environ le quart de l'ecart entre
//   Business et Premium, pour que le 4e module rende Premium moins cher
//   TOUT SEUL. Le client calcule et monte de lui-meme : il n'y a rien a
//   vendre.
//     ecart Business -> Premium = 129 - 49 = 80 EUR
//     option = 20 EUR  ->  4 options = 80 EUR  ->  bascule au 4e module
//   A 15 EUR il aurait fallu SIX modules pour justifier Premium : le pack
//   Premium ne se serait plus jamais vendu.
// =====================================================================

/** Prix mensuel d'un module Premium achete a l'unite, hors pack. */
export const PRIX_OPTION_MENSUEL = 20

/**
 * Les offres, de la moins chere a la plus chere.
 *
 *   prix            null = tarif sur devis
 *   maxUtilisateurs null = illimite
 *   debordement     prix par utilisateur AU-DELA du plafond, null = pas de
 *                   debordement (on ne peut pas depasser)
 *   modules         ce qui est INCLUS D'OFFICE dans ce pack, en plus de
 *                   tout ce que contiennent les packs inferieurs
 *
 * Le debordement remplace les plafonds durs. Avant, embaucher le 11e
 * salarie faisait passer la facture de 29 a 79 EUR : le client ne montait
 * pas de pack, il ne creait pas de compte pour le 11e. Un salarie sans
 * compte n'a pas de pointage, donc le decompte legal devient faux -- la
 * grille tarifaire sabotait la conformite qu'elle vendait.
 */
export const OFFRES = [
  {
    id: 'gratuit',
    nom: 'Gratuit',
    couleur: '#10B981',
    prix: 0,
    maxUtilisateurs: 3,
    debordement: null,
    modules: ['organisation'],
    resume: 'Pour demarrer : organiser son equipe, sans carte bancaire',
  },
  {
    id: 'starter',
    nom: 'Starter',
    couleur: '#6B7280',
    prix: 29,
    maxUtilisateurs: 10,
    debordement: 2,
    modules: ['conges'],
    resume: 'Organisation et conges pour une petite structure',
  },
  {
    id: 'business',
    nom: 'Business',
    couleur: '#3B82F6',
    prix: 49,
    maxUtilisateurs: 25,
    debordement: 2,
    modules: ['pointage', 'documents', 'rapports', 'facturation', 'clients', 'vehicules', 'stocks', 'reservations'],
    resume: 'Le decompte du temps de travail conforme, et la gestion complete',
  },
  {
    id: 'premium',
    nom: 'Premium',
    couleur: '#8B5CF6',
    prix: 129,
    maxUtilisateurs: 100,
    debordement: 1.5,
    modules: ['gps', 'qualite', 'formations', 'securite', 'planning_avance', 'multi_sites'],
    resume: 'Equipes sur le terrain, multi-sites et qualite',
  },
  {
    id: 'enterprise',
    nom: 'Enterprise',
    couleur: '#F59E0B',
    prix: null,
    maxUtilisateurs: null,
    debordement: null,
    modules: ['api', 'white_label', 'ia'],
    resume: 'Sur mesure : integrations, marque blanche, assistant IA',
  },
]

/** Identifiants des offres, du moins cher au plus cher. */
export const ORDRE_OFFRES = OFFRES.map(o => o.id)

/** L'offre creee par l'inscription publique. */
export const OFFRE_INSCRIPTION = 'starter'

/** L'offre vers laquelle on retombe quand rien n'est paye. */
export const OFFRE_GRATUITE = 'gratuit'

/**
 * Les modules achetables a l'unite : ceux du pack Premium.
 *
 * Volontairement PAS ceux de Business. L'ecart Starter -> Business n'est
 * que de 20 EUR pour huit modules : une option a 20 EUR couterait le prix
 * du pack entier. Donc Starter -> Business est une decision de pack,
 * Business -> Premium s'achete au detail.
 */
export const MODULES_OPTIONNELS = (OFFRES.find(o => o.id === 'premium') || {}).modules || []

export function getOffre(id) {
  return OFFRES.find(o => o.id === id) || null
}

/** Rang de l'offre dans l'echelle. -1 si inconnue. */
export function rangOffre(id) {
  return ORDRE_OFFRES.indexOf(id)
}

/**
 * Tous les modules inclus d'office dans une offre : les siens PLUS ceux
 * de toutes les offres inferieures. Un pack ne reprend jamais la liste
 * de celui d'en dessous, sinon on recree la duplication qu'on vient de
 * supprimer.
 */
export function modulesInclus(offreId) {
  const rang = rangOffre(offreId)
  if (rang < 0) return []
  const vus = []
  for (let i = 0; i <= rang; i++) {
    OFFRES[i].modules.forEach(id => { if (!vus.includes(id)) vus.push(id) })
  }
  return vus
}

/**
 * Prix mensuel reel, debordement compris.
 * Retourne null pour une offre sur devis.
 */
export function prixMensuel(offreId, nbUtilisateurs = 0) {
  const offre = getOffre(offreId)
  if (!offre || offre.prix == null) return null
  if (offre.maxUtilisateurs == null) return offre.prix

  const surplus = Math.max(0, nbUtilisateurs - offre.maxUtilisateurs)
  if (surplus === 0) return offre.prix
  // Pas de debordement prevu : le plafond est dur, le prix ne bouge pas.
  // C'est a l'appelant de refuser l'utilisateur en trop.
  if (offre.debordement == null) return offre.prix
  return offre.prix + surplus * offre.debordement
}

/**
 * L'offre la moins chere qui accepte cet effectif et contient ces
 * modules. Sert a proposer au client ce qu'il a interet a prendre --
 * y compris a lui dire de redescendre.
 * Retourne { offreId, prix, options } ou null si rien ne convient.
 */
export function meilleureOffre(nbUtilisateurs, modulesVoulus = []) {
  let meilleure = null

  for (const offre of OFFRES) {
    if (offre.prix == null) continue
    // Plafond dur : cette offre ne peut pas accueillir l'effectif.
    if (offre.debordement == null && offre.maxUtilisateurs != null && nbUtilisateurs > offre.maxUtilisateurs) continue

    const inclus = modulesInclus(offre.id)
    const manquants = modulesVoulus.filter(id => !inclus.includes(id))
    // Un module manquant ne s'achete en option que s'il est optionnel.
    if (manquants.some(id => !MODULES_OPTIONNELS.includes(id))) continue

    const prix = prixMensuel(offre.id, nbUtilisateurs) + manquants.length * PRIX_OPTION_MENSUEL

    // A PRIX EGAL, on recommande le pack qui demande le MOINS d'options.
    // Le 4e module coute exactement l'ecart Business -> Premium : les deux
    // chemins reviennent au meme prix, mais le pack inclut le module au
    // lieu de le facturer a cote. Sans cette regle, on conseillerait au
    // client de payer quatre options plutot que de monter de pack -- et le
    // pack Premium ne se vendrait jamais.
    const mieux = !meilleure
      || prix < meilleure.prix
      || (prix === meilleure.prix && manquants.length < meilleure.options.length)

    if (mieux) {
      meilleure = { offreId: offre.id, prix, options: manquants }
    }
  }

  return meilleure
}
