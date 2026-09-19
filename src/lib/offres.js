// src/lib/offres.js
// =====================================================================
// LA GRILLE COMMERCIALE DE VELOR ONE -- SOURCE UNIQUE.
//
// POURQUOI CE FICHIER EXISTE
//   Le contenu des packs etait ecrit a QUATRE endroits : registry.js,
//   plan1.js, plan1.ts et la RPC SQL d'inscription. Ils s'etaient deja
//   contredits : le registre annoncait le pointage dans starter, les trois
//   autres non. Desormais tout part d'ici, et offres.test.js relit les
//   quatre sources pour casser le build en cas d'ecart.
//
// UNE SEULE OFFRE PAYANTE, ET C'EST VOLONTAIRE
//   Le registre declare 18 modules ; DEUX sont livrables (organisation,
//   conges) et le pointage est en cours. Une grille a la carte affichant
//   18 modules a 10 EUR annoncerait quinze choses qui n'existent pas --
//   le meme mensonge que le badge "MODULE ACTIF" qu'on a retire et que
//   l'ecran de corrections qui inventait des demandes.
//   Donc : une offre, qui contient ce qui existe. La vente au module
//   reviendra quand il y aura des modules a vendre.
//
// L'IDENTIFIANT RESTE 'starter'
//   Le nom commercial est "Velor One", mais l'id ne change pas : il est
//   ecrit dans entreprises.plan, dans la RPC d'inscription et dans le
//   trigger d'essai 14 jours. Renommer l'id imposerait une migration de
//   donnees pour ne gagner qu'un mot.
// =====================================================================

/** Prix public de l'offre, par mois. */
export const PRIX_STANDARD = 39

/**
 * TARIF FONDATEUR
 *
 * Les premieres entreprises entrent a 29 EUR et gardent ce prix A VIE.
 *
 * Ce n'est pas une promotion : c'est ce qui rend honnete de vendre
 * aujourd'hui un produit dont le pointage n'est pas fini. Elles prennent
 * un risque, elles gardent le prix.
 *
 * Le blocage a vie ne demande aucun mecanisme : le prix est ecrit dans
 * entreprises.prix_mensuel a la souscription, et l'ecran Offres lit
 * TOUJOURS cette colonne en priorite sur la grille. Changer PRIX_STANDARD
 * demain ne touchera donc aucune entreprise existante -- un test le
 * verifie.
 */
export const TARIF_FONDATEUR = 29
export const FONDATEURS_MAX = 5

/** Utilisateurs compris dans le forfait, puis prix de l'utilisateur en plus. */
export const UTILISATEURS_INCLUS = 10
export const PRIX_UTILISATEUR_SUP = 2

/**
 * PLAFOND DU FORFAIT.
 * Au-dela, on ne facture plus au forfait : on etablit un devis. Le
 * debordement sert a absorber une embauche, pas a tarifer une ETI.
 */
export const PLAFOND_FORFAIT = 30

/**
 * Les offres.
 *
 *   prix           null = rien n'est facturable. C'est LE verrou : une
 *                  offre sans prix ne peut pas etre vendue, quoi qu'affiche
 *                  l'ecran.
 *   prixIndicatif  montant annonce a titre indicatif sur une offre pas
 *                  encore disponible. Sert UNIQUEMENT a l'affichage -- il
 *                  n'entre dans aucun calcul de facturation. Le jour de la
 *                  sortie, on le recopie dans prix et on passe vendu: true.
 *   vendu   false = pas (ou plus) commercialisee. Elle reste AFFICHEE a
 *           l'inscription, marquee BIENTOT et non selectionnable, pour que
 *           le visiteur voie la trajectoire du produit. Le jour ou ses
 *           modules sont livres : vendu: true + un prix, et la carte
 *           devient selectionnable. Rien d'autre a toucher, ni ici ni
 *           dans la page d'inscription.
 *           On la garde aussi parce qu'une entreprise peut encore la
 *           porter dans entreprises.plan et doit voir un nom, pas un
 *           identifiant brut.
 *   modules ce que l'offre AJOUTE aux offres inferieures, jamais la liste
 *           complete -- sinon on recree la duplication qu'on a supprimee.
 *           Vide sur les bandes superieures : voir ci-dessous.
 *
 * EFFECTIF ET MODULES SONT DEUX AXES SEPARES
 *   L'effectif decide du PRIX (39, 59, 79, puis devis).
 *   Les modules sont ceux qui EXISTENT, et tout le monde les a.
 *
 *   Les avoir melanges creait un trou : le CRM etait dans la bande 11-20,
 *   donc une boite de 6 personnes ne pouvait JAMAIS l'obtenir, quoi
 *   qu'elle paie -- et une boite de 25 se voyait imposer le GPS sans
 *   avoir un seul technicien sur la route.
 */
export const OFFRES = [
  {
    id: 'gratuit',
    nom: 'Gratuit',
    couleur: '#10B981',
    prix: 0,
    maxUtilisateurs: 3,
    debordement: null,
    vendu: true,
    modules: ['organisation'],
    resume: 'Organiser son equipe, sans carte bancaire et sans limite de duree',
  },
  {
    id: 'starter',
    nom: 'Velor One',
    couleur: '#185FA5',
    prix: PRIX_STANDARD,
    maxUtilisateurs: UTILISATEURS_INCLUS,
    debordement: PRIX_UTILISATEUR_SUP,
    vendu: true,
    // Uniquement ce qui est reellement developpe. Le jour ou un module
    // sort de l'etat de squelette, il se deplace ici -- et le test de
    // coherence avec le registre echouera tant que ce n'est pas fait
    // des deux cotes.
    modules: ['conges', 'pointage'],
    resume: 'Le decompte du temps de travail conforme, les conges et tout le socle',
  },
  // --- Anciens packs : conserves pour l'affichage, plus commercialises ---
  {
    id: 'business',
    nom: 'Business',
    couleur: '#3B82F6',
    // prix reste null : rien n'est facturable tant que les modules
    // n'existent pas. prixIndicatif ne sert qu'a AFFICHER la direction.
    prix: null,
    // 39 + 2 x 10 = 59 : le tarif indicatif EST la courbe du debordement
    // au plafond de la bande. Les bandes ne sont pas des paliers avec des
    // marches, ce sont des noms poses sur une progression continue.
    prixIndicatif: 59,
    maxUtilisateurs: 20,
    debordement: PRIX_UTILISATEUR_SUP,
    vendu: false,
    // VIDE, et c'est le coeur de la decision : une bande fixe un PRIX, pas
    // un contenu. Attacher les modules aux bandes interdisait a une boite
    // de 6 personnes d'acceder au CRM -- quoi qu'elle paie -- et imposait
    // le GPS a une boite de 25 sans technicien sur la route.
    modules: [],
    resume: 'Le meme produit, pour une equipe qui a grandi',
  },
  {
    id: 'premium',
    nom: 'Premium',
    couleur: '#8B5CF6',
    prix: null,
    // 59 + 2 x 10 = 79 : meme courbe, bande suivante.
    prixIndicatif: 79,
    maxUtilisateurs: PLAFOND_FORFAIT,
    debordement: PRIX_UTILISATEUR_SUP,
    vendu: false,
    modules: [],
    resume: 'Le meme produit, pour une equipe de 21 a 30 personnes',
  },
  {
    id: 'enterprise',
    nom: 'Sur mesure',
    couleur: '#F59E0B',
    prix: null,
    maxUtilisateurs: null,
    debordement: null,
    vendu: true,
    // RESERVE AU SUPER ADMIN.
    //
    // Un sur-mesure, ce sont des modules choisis a un prix negocie : ca
    // se decide dans une conversation, pas en cochant une case sur une
    // page d'inscription.
    //
    // Le serveur le refusait deja -- public-signup n'accepte que
    // 'gratuit' et 'starter', quoi qu'envoie le navigateur -- et l'ecran
    // ne le proposait pas, mais seulement parce que prix vaut null.
    // C'etait donc une regle par effet de bord : le jour ou quelqu'un
    // donne un prix indicatif a cette offre pour l'afficher joliment,
    // elle redevient selectionnable sans que personne l'ait voulu.
    //
    // On la DECLARE. Un test verifie qu'elle n'apparait jamais dans les
    // offres proposees a l'inscription.
    reserveSuperAdmin: true,
    modules: [],
    resume: 'Au-dela de ' + PLAFOND_FORFAIT + ' salaries, ou besoins specifiques : nous en parlons',
  },
]

/** Identifiants des offres, du moins cher au plus cher. */
export const ORDRE_OFFRES = OFFRES.map(o => o.id)

/** Rang de l'offre dans l'echelle. -1 si inconnue. */
export function rangOffre(id) {
  return ORDRE_OFFRES.indexOf(id)
}

/** Les offres reellement proposees a la vente aujourd'hui. */
export const OFFRES_VENDUES = OFFRES.filter(o => o.vendu)

/**
 * Les offres qu'un visiteur peut choisir LUI-MEME a l'inscription.
 *
 * Le sur-mesure en est exclu : ses modules et son prix se negocient,
 * puis le Super Admin l'applique a l'entreprise. Une offre reservee
 * reste AFFICHEE sur la page -- le visiteur doit savoir qu'elle existe
 * et qu'il faut nous appeler -- mais elle n'est pas selectionnable.
 */
export const OFFRES_PUBLIQUES = OFFRES.filter(
  o => o.vendu && o.prix != null && !o.reserveSuperAdmin,
)

/** Cette offre se choisit-elle seul, a l'inscription ? */
export function choisissableALInscription(id) {
  return OFFRES_PUBLIQUES.some(o => o.id === id)
}

/** L'offre creee par l'inscription publique. */
export const OFFRE_INSCRIPTION = 'starter'

/** L'offre vers laquelle on retombe quand rien n'est paye. */
export const OFFRE_GRATUITE = 'gratuit'

/**
 * MODULES A VENIR -- ceux qui n'existent pas encore.
 *
 * Un visiteur peut declarer qu'ils l'interesseraient. Cet interet cree une
 * DEMANDE (table demandes_pack), jamais une activation : c'est toute la
 * difference avec le badge "MODULE ACTIF" qu'on a retire, qui affirmait
 * qu'un module fonctionnait alors qu'il n'existait pas.
 *
 * LISTE EXPLICITE, ET NON DERIVEE
 *   Elle l'etait, tant que les modules etaient attaches aux bandes. Depuis
 *   que les bandes ne portent plus de contenu, il n'y a plus rien d'ou la
 *   deriver. Elle est donc ecrite ici -- mais offres.test.js verifie
 *   qu'elle vaut exactement "le registre MOINS ce que les offres
 *   contiennent". Oublier de retirer un module livre casse le build.
 *
 * LE JOUR OU UN MODULE SORT
 *   Il entre dans OFFRES[starter].modules et sort de cette liste. Deux
 *   lignes, un fichier, et tout le monde l'a -- du client de 4 personnes
 *   a celui de 30.
 */
/**
 * MODULES VENDUS A PART.
 *
 * Un module qui EXISTE mais qui n'est dans aucun pack. Ce n'est ni un
 * oubli ni un module a venir : c'est une decision commerciale.
 *
 * La geolocalisation en est le premier cas. Elle fonctionne, mais elle
 * n'est pas incluse dans Velor One : le Super Admin l'active entreprise
 * par entreprise, au prix convenu. Le pointage la rend plus exacte, et
 * elle donne une raison de plus de prendre le pointage -- les deux se
 * vendent mieux ensemble que l'un des deux offert.
 *
 * Sans cette liste, le module tombait entre deux chaises : plus « a
 * venir » puisqu'il existe, mais dans aucune offre -- donc invisible
 * partout, ou offert a 39 EUR selon le test qu'on relachait.
 */
export const MODULES_A_LA_CARTE = ['gps']

export const MODULES_A_VENIR = [
  'documents', 'rapports', 'facturation', 'clients', 'vehicules', 'stocks',
  'reservations', 'qualite', 'formations', 'securite',
  'planning_avance', 'multi_sites', 'api', 'white_label', 'ia',
]

/**
 * La bande d'effectif d'une offre, sous forme { min, max }.
 *
 * Le minimum est DERIVE du plafond de l'offre precedente : ecrire "11" en
 * dur a cote d'un plafond de 10 serait deux verites a maintenir, et elles
 * finiraient par se contredire -- c'est exactement le bug qu'on passe la
 * semaine a corriger ailleurs.
 */
export function bandeEffectif(offreId) {
  const rang = rangOffre(offreId)
  if (rang < 0) return null
  const precedente = rang > 0 ? OFFRES[rang - 1] : null
  const min = precedente && precedente.maxUtilisateurs != null ? precedente.maxUtilisateurs + 1 : 1
  return { min, max: OFFRES[rang].maxUtilisateurs }
}

export function getOffre(id) {
  return OFFRES.find(o => o.id === id) || null
}

/**
 * Tous les modules inclus d'office dans une offre : les siens PLUS ceux
 * des offres inferieures.
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
 * Ce que devient la selection de modules quand on change le pack.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *   Le formulaire du Super Admin remplacait la selection par celle du
 *   pack. Tant que tout module appartenait a un pack, c'etait sans
 *   consequence. Depuis que la geolocalisation se vend A LA CARTE, ca ne
 *   l'est plus : changer le pack d'un client qui paie la geoloc a part la
 *   lui RETIRAIT, en silence, comme effet de bord d'une modification de
 *   tarif. Personne n'aurait fait le lien.
 *
 *   Un module a la carte ne s'active pas avec un pack ; il ne se
 *   desactive donc pas avec un pack non plus. Pour le retirer, on le
 *   decoche -- c'est explicite, et l'apercu le montre avant d'ecrire.
 *
 * @param offreId           le pack vise
 * @param selectionActuelle les modules actuellement coches
 */
export function modulesApresChangementDePack(offreId, selectionActuelle = []) {
  const duPack = modulesInclus(offreId)
  const aLaCarteGardes = (selectionActuelle || [])
    .filter(id => MODULES_A_LA_CARTE.includes(id) && !duPack.includes(id))
  return [...duPack, ...aLaCarteGardes]
}

/**
 * Prix mensuel d'une offre pour un effectif donne.
 * Retourne null quand il n'y a pas de tarif au forfait : offre sur devis,
 * ancienne formule, ou effectif au-dela du plafond.
 *
 * prixBase permet de calculer avec le prix REEL de l'entreprise (celui
 * stocke dans entreprises.prix_mensuel) plutot qu'avec le prix public --
 * c'est ce qui fait tenir le tarif fondateur dans le temps.
 */
export function prixMensuel(offreId, nbUtilisateurs = 0, prixBase = null) {
  const offre = getOffre(offreId)
  if (!offre) return null

  const base = prixBase != null ? prixBase : offre.prix
  if (base == null) return null
  if (nbUtilisateurs > PLAFOND_FORFAIT) return null
  if (offre.maxUtilisateurs == null) return base

  const surplus = Math.max(0, nbUtilisateurs - offre.maxUtilisateurs)
  if (surplus === 0) return base
  // Plafond dur (le plan gratuit) : le prix ne bouge pas, c'est a
  // l'appelant de refuser l'utilisateur en trop.
  if (offre.debordement == null) return base
  return base + surplus * offre.debordement
}


// =====================================================================
// FACTURATION REELLE D'UNE ENTREPRISE
//
// prixMensuel() ci-dessus repond a « combien coute cette OFFRE pour cet
// effectif » : c'est ce qu'il faut pour une grille tarifaire. Ce qui suit
// repond a « combien doit CETTE entreprise ce mois-ci », ce qui n'est pas
// la meme question : la base de prix vient de sa ligne (donc le tarif
// fondateur a 29 EUR survit), et le forfait inclus vient de sa colonne
// max_utilisateurs (donc un forfait negocie par le Super Admin est
// respecte).
//
// LE MEME CALCUL EXISTE EN SQL -- etat_facturation(), migration 0007.
// C'est volontaire et c'est verrouille : le calcul JS sert a AVERTIR
// l'utilisateur avant qu'il cree un compte (instantane, sans aller-retour
// reseau), le calcul SQL sert a FACTURER (et lui seul est fige dans
// releves_facturation). offres.test.js relit le SQL et casse le build si
// les deux divergent -- c'est le meme verrou que pour la RPC
// d'inscription.
// =====================================================================

/**
 * LA LIMITE D'UTILISATEURS D'UNE ENTREPRISE.
 *
 * ELLE APPARTIENT AU PACK, PAS A UNE COLONNE LIBRE.
 *   entreprises.max_utilisateurs a ete rempli par six endroits
 *   differents, avec des replis qui se contredisent : 0 ici, 999 la, 10
 *   ailleurs. Un 0 facturerait CHAQUE utilisateur en supplement ; un 999
 *   n'en facturerait jamais aucun. C'est la meme entreprise, et deux
 *   factures opposees selon l'ecran par lequel elle a ete creee.
 *
 *   La limite vient donc d'abord de l'OFFRE : Gratuit 3, Velor One 10,
 *   Business 20, Premium 30, Sur mesure aucune. C'est ce que le client
 *   a achete, c'est ce qu'on lui facture.
 *
 * LA COLONNE RESTE UN AMENAGEMENT POSSIBLE
 *   Un forfait negocie par le Super Admin doit etre respecte. La colonne
 *   l'emporte donc -- mais seulement si elle est EXPLOITABLE (entre 1 et
 *   le plafond du forfait). Sinon on retombe sur le pack au lieu de
 *   renoncer a facturer, ce qui etait l'ancien comportement.
 *
 * ON NE BLOQUE JAMAIS
 *   Cette limite sert a CALCULER un supplement, jamais a refuser la
 *   creation d'un compte. Un plafond dur pousserait le client a ne pas
 *   creer le 11e compte -- et le 11e salarie pointerait sur le telephone
 *   d'un collegue, ce qui fausserait le decompte des heures, la seule
 *   chose qui ait ici une valeur legale.
 *
 * @returns {number|null} null = aucune limite facturable (Sur mesure, ou
 *          plan inconnu sans colonne exploitable). Aucun supplement.
 */
export function limiteUtilisateurs(plan, maxColonne = undefined) {
  const brut = Number(maxColonne)
  const colonneExploitable = maxColonne != null
    && Number.isFinite(brut)
    && brut > 0
    && brut <= PLAFOND_FORFAIT

  if (colonneExploitable) return Math.trunc(brut)

  const offre = OFFRES.find(o => o.id === plan)
  if (!offre) return null

  // Sur mesure : maxUtilisateurs vaut null, et c'est une reponse, pas un
  // trou -- le montant vient d'un devis.
  return offre.maxUtilisateurs == null ? null : offre.maxUtilisateurs
}

/** Le prix de l'utilisateur supplementaire, pour ce pack. */
export function supplementUtilisateur(plan) {
  const offre = OFFRES.find(o => o.id === plan)
  return offre ? (offre.debordement ?? 0) : PRIX_UTILISATEUR_SUP
}

/**
 * Detail de ce que doit une entreprise pour un effectif donne.
 *
 * @param entreprise  ligne « entreprises » : { plan, prix_mensuel, max_utilisateurs }
 * @param nbUtilisateurs  profils ACTIFS, super admin exclu
 */
export function detailFacture(entreprise, nbUtilisateurs = 0) {
  const ent = entreprise || {}
  const plan = ent.plan || null
  const utilisateurs = Math.max(0, Math.trunc(Number(nbUtilisateurs) || 0))
  const prixBase = ent.prix_mensuel != null ? Number(ent.prix_mensuel) : null

  // La limite vient du PACK, la colonne ne servant que d'amenagement
  // quand elle est exploitable. Voir limiteUtilisateurs().
  const inclus = limiteUtilisateurs(plan, ent.max_utilisateurs)

  const surplus = inclus == null ? 0 : Math.max(0, utilisateurs - inclus)
  const surDevis = utilisateurs > PLAFOND_FORFAIT

  // Le plan gratuit n'a pas de debordement : son plafond est un vrai
  // plafond. Depasser 3 utilisateurs n'ajoute pas 2 EUR, cela veut dire
  // qu'il faut passer a Velor One.
  const sansDebordement = plan === OFFRE_GRATUITE
  // Au-dela du plafond du forfait non plus : le montant vient d'un devis.
  // Annoncer 21 x 2 = 42 EUR laisserait croire que c'est ce qu'on facture.
  const supplement = sansDebordement || surDevis ? 0 : surplus * PRIX_UTILISATEUR_SUP

  let prixTotal = null
  if (!surDevis && prixBase != null) {
    prixTotal = sansDebordement ? prixBase : prixBase + supplement
  }

  return {
    plan,
    utilisateurs,
    inclus,
    surplus,
    prixBase,
    prixUtilisateurSup: PRIX_UTILISATEUR_SUP,
    supplement,
    prixTotal,
    surDevis,
    // Vrai quand l'effectif depasse un plafond qui ne se facture pas :
    // il faut changer de formule, pas payer 2 EUR de plus.
    passageRequis: sansDebordement && surplus > 0,
  }
}

/**
 * Ce que coute UN utilisateur de plus, pour l'annoncer avant de creer le
 * compte.
 *
 * On avertit, on ne bloque pas. Un plafond dur pousse le client a ne pas
 * creer le 11e compte : le 11e salarie pointera sur le telephone d'un
 * collegue, et le decompte des heures -- la seule chose qui ait une
 * valeur legale ici -- deviendra faux.
 */
export function impactUtilisateurEnPlus(entreprise, nbUtilisateursActuel = 0) {
  const avant = detailFacture(entreprise, nbUtilisateursActuel)
  const apres = detailFacture(entreprise, nbUtilisateursActuel + 1)

  const cout = avant.prixTotal != null && apres.prixTotal != null
    ? apres.prixTotal - avant.prixTotal
    : null

  return {
    avant,
    apres,
    /** Surcout mensuel, ou null si le montant n'est plus calculable. */
    cout,
    /** Ce compte fait franchir une limite : il faut le dire avant de le creer. */
    franchitUneLimite: (cout != null && cout > 0) || apres.surDevis || apres.passageRequis,
  }
}

