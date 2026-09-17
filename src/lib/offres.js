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
    prixIndicatif: 59,
    maxUtilisateurs: UTILISATEURS_INCLUS,
    debordement: PRIX_UTILISATEUR_SUP,
    vendu: false,
    modules: ['documents', 'rapports', 'facturation', 'clients', 'vehicules', 'stocks', 'reservations'],
    resume: 'Facturation, CRM clients, documents, stocks, vehicules et rapports',
  },
  {
    id: 'premium',
    nom: 'Premium',
    couleur: '#8B5CF6',
    prix: null,
    prixIndicatif: 79,
    maxUtilisateurs: UTILISATEURS_INCLUS,
    debordement: PRIX_UTILISATEUR_SUP,
    vendu: false,
    modules: ['gps', 'qualite', 'formations', 'securite', 'planning_avance', 'multi_sites'],
    resume: 'Geolocalisation terrain, multi-sites, qualite, formations et securite',
  },
  {
    id: 'enterprise',
    nom: 'Sur mesure',
    couleur: '#F59E0B',
    prix: null,
    maxUtilisateurs: null,
    debordement: null,
    vendu: true,
    modules: ['api', 'white_label', 'ia'],
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
 * La liste est DERIVEE : tout ce qui n'est pas dans l'offre de souscription.
 * Le jour ou un module est livre, il entre dans OFFRES[starter].modules et
 * disparait d'ici tout seul -- il n'y a pas deux listes a tenir.
 */
export const MODULES_A_VENIR = OFFRES
  .filter(o => rangOffre(o.id) > rangOffre(OFFRE_INSCRIPTION))
  .flatMap(o => o.modules)

export function estModuleAVenir(id) {
  return MODULES_A_VENIR.includes(id)
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
 * Prix a la souscription, selon le nombre d'entreprises fondatrices deja
 * entrees. Retourne { prix, fondateur, restants }.
 *
 * Le comptage se fait cote SERVEUR (RPC d'inscription) : cette fonction
 * sert a l'affichage. Le navigateur ne decide jamais d'un prix.
 */
export function prixSouscription(nbFondateurs = 0) {
  const restants = Math.max(0, FONDATEURS_MAX - nbFondateurs)
  return restants > 0
    ? { prix: TARIF_FONDATEUR, fondateur: true, restants }
    : { prix: PRIX_STANDARD, fondateur: false, restants: 0 }
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

/** Vrai quand aucun tarif au forfait ne s'applique : il faut un devis. */
export function necessiteDevis(nbUtilisateurs) {
  return nbUtilisateurs > PLAFOND_FORFAIT
}
