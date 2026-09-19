// src/lib/offres.test.js
// =====================================================================
// Garde-fou : la grille commerciale est definie a QUATRE endroits qui
// doivent dire la meme chose.
//
//   src/lib/offres.js                        -> la source unique
//   src/modules/registry.js                  -> le champ plans de chaque module
//   supabase/functions/_shared/plan1.ts      -> ce que valide l'Edge Function
//   supabase/migrations/...plan1.sql         -> ce que la RPC ECRIT vraiment
//
// Ils s'etaient deja contredits sans que personne s'en apercoive, parce
// que rien ne les comparait. Ces tests relisent les fichiers reels -- y
// compris le TypeScript et le SQL, que le front n'importe jamais.
// =====================================================================
const fs = require('fs')
const path = require('path')

const {
  OFFRES, OFFRES_VENDUES, ORDRE_OFFRES, OFFRE_INSCRIPTION, OFFRE_GRATUITE,
  MODULES_A_LA_CARTE,
  PRIX_STANDARD, TARIF_FONDATEUR, FONDATEURS_MAX, PLAFOND_FORFAIT,
  UTILISATEURS_INCLUS, PRIX_UTILISATEUR_SUP, MODULES_A_VENIR,
  getOffre, rangOffre, modulesInclus, prixMensuel, bandeEffectif,
} = require('./offres')
const { MODULES_REGISTRY } = require('../modules/registry')
const { MODULES_DEVELOPPES } = require('./modulesDeveloppes')

const RACINE = path.join(__dirname, '..', '..')
const PLAN1_TS = path.join(RACINE, 'supabase', 'functions', '_shared', 'plan1.ts')
const RPC_SQL = path.join(RACINE, 'supabase', 'migrations', '20260915_inscription_publique_plan1.sql')
// Le tarif fondateur est pose par un trigger, pas par la RPC : la reecrire
// entierement pour trois constantes aurait risque de casser l'inscription.
const FONDATEUR_SQL = path.join(RACINE, 'supabase', 'migrations', '20260917_0005_tarif_fondateur.sql')

const lire = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)

// ---------------------------------------------------------------------
// L'offre ne doit annoncer que ce qui existe
// ---------------------------------------------------------------------
describe('honnetete de l offre', () => {
  test('l offre payante ne contient que des modules reellement developpes', () => {
    // C'est LE test de ce fichier. Une grille qui annonce des modules
    // squelettes, c'est le meme mensonge que le badge "MODULE ACTIF"
    // qu'on a retire et que l'ecran de corrections qui inventait des
    // demandes. Ajouter un module a l'offre sans l'avoir ecrit casse ici.
    modulesInclus(OFFRE_INSCRIPTION).forEach(id => {
      expect(MODULES_DEVELOPPES).toContain(id)
    })
  })

  test('le plan gratuit aussi', () => {
    modulesInclus(OFFRE_GRATUITE).forEach(id => {
      expect(MODULES_DEVELOPPES).toContain(id)
    })
  })

  test('les anciens packs ne sont plus proposes a la vente', () => {
    const vendus = OFFRES_VENDUES.map(o => o.id)
    expect(vendus).not.toContain('business')
    expect(vendus).not.toContain('premium')
    // ... mais ils restent DEFINIS : une entreprise peut encore les porter
    // dans entreprises.plan et doit voir un nom, pas un identifiant brut.
    expect(getOffre('business')).not.toBeNull()
    expect(getOffre('premium')).not.toBeNull()
  })

  test('les tarifs indicatifs tombent PILE sur la courbe du debordement', () => {
    // C'est ce qui fait que les bandes ne sont pas des paliers avec des
    // marches : 39 EUR a 10 utilisateurs, +2 EUR par utilisateur, donc
    // 59 EUR a 20 et 79 EUR a 30. Si quelqu'un change un tarif indicatif
    // sans recalculer, on recree la falaise qui pousse le client a ne pas
    // declarer son 11e salarie -- et un salarie non declare fausse le
    // decompte legal qu'on lui vend.
    OFFRES.filter(o => o.prixIndicatif != null && o.maxUtilisateurs != null).forEach(offre => {
      const surLaCourbe = PRIX_STANDARD
        + (offre.maxUtilisateurs - UTILISATEURS_INCLUS) * PRIX_UTILISATEUR_SUP
      expect(offre.prixIndicatif).toBe(surLaCourbe)
    })
  })

  test('les bandes d effectif se suivent sans trou ni chevauchement', () => {
    let attenduMin = 1
    OFFRES.forEach(offre => {
      const bande = bandeEffectif(offre.id)
      expect(bande.min).toBe(attenduMin)
      if (bande.max == null) return          // la derniere bande est ouverte
      expect(bande.max).toBeGreaterThanOrEqual(bande.min)
      attenduMin = bande.max + 1
    })
  })

  test('un tarif INDICATIF n est jamais facturable', () => {
    // C'est le verrou qui permet d'afficher un prix sur une formule qui
    // n'existe pas encore sans risquer de la facturer. prixIndicatif ne
    // doit apparaitre dans AUCUN calcul : seul prix compte, et il est null.
    OFFRES.filter(o => o.prixIndicatif != null).forEach(offre => {
      expect(offre.vendu).toBe(false)
      expect(offre.prix).toBeNull()
      // prixMensuel ignore totalement prixIndicatif.
      expect(prixMensuel(offre.id, 5)).toBeNull()
      expect(prixMensuel(offre.id, offre.maxUtilisateurs + 10)).toBeNull()
    })
  })

  test('aucune formule affichee ne peut montrer un prix vide', () => {
    // Regression : les cartes Business et Premium affichaient "null EUR"
    // parce que le cas "pas vendu ET sans prix facturable" n'existait pas
    // dans la condition d'affichage.
    OFFRES.forEach(offre => {
      const affichable = offre.prix != null || offre.prixIndicatif != null
        || (offre.vendu && offre.prix == null)   // sur devis
      expect(affichable).toBe(true)
    })
  })

  test('il n y a qu une seule offre payante au forfait', () => {
    const payantes = OFFRES_VENDUES.filter(o => o.prix != null && o.prix > 0)
    expect(payantes).toHaveLength(1)
    expect(payantes[0].id).toBe(OFFRE_INSCRIPTION)
  })
})

// ---------------------------------------------------------------------
// Tarif fondateur
// ---------------------------------------------------------------------
describe('tarif fondateur', () => {
  test('il est moins cher que le tarif standard', () => {
    expect(TARIF_FONDATEUR).toBeLessThan(PRIX_STANDARD)
  })

  test('le nombre de places est un entier positif', () => {
    // La regle d'attribution elle-meme n'est PLUS en JavaScript : elle vit
    // dans le trigger SQL, qui compte les places et pose le prix. Une copie
    // JS de cette regle etait une deuxieme verite a maintenir -- exactement
    // ce qu'on passe la semaine a supprimer. Ici on ne verifie donc que la
    // coherence des constantes ; la concordance avec le SQL est verifiee
    // plus bas, en relisant la migration.
    expect(Number.isInteger(FONDATEURS_MAX)).toBe(true)
    expect(FONDATEURS_MAX).toBeGreaterThan(0)
  })

  test('LE PRIX EST BLOQUE A VIE : la grille ne peut pas le rattraper', () => {
    // Le mecanisme du blocage tient en une ligne : prixMensuel accepte un
    // prixBase, qui vient de entreprises.prix_mensuel. Si demain
    // PRIX_STANDARD passe a 59 EUR, une entreprise fondatrice continue de
    // payer son tarif -- le debordement compris.
    const nb = UTILISATEURS_INCLUS + 5
    const supplement = 5 * PRIX_UTILISATEUR_SUP

    expect(prixMensuel(OFFRE_INSCRIPTION, nb, TARIF_FONDATEUR)).toBe(TARIF_FONDATEUR + supplement)
    expect(prixMensuel(OFFRE_INSCRIPTION, nb)).toBe(PRIX_STANDARD + supplement)
    // Et l'ecart reste exactement la remise consentie, jamais plus.
    expect(prixMensuel(OFFRE_INSCRIPTION, nb) - prixMensuel(OFFRE_INSCRIPTION, nb, TARIF_FONDATEUR))
      .toBe(PRIX_STANDARD - TARIF_FONDATEUR)
  })
})

// ---------------------------------------------------------------------
// Debordement et plafond
// ---------------------------------------------------------------------
describe('debordement et plafond', () => {
  test('le prix ne saute pas au franchissement du forfait', () => {
    const offre = getOffre(OFFRE_INSCRIPTION)
    const auPlafond = prixMensuel(offre.id, offre.maxUtilisateurs)
    const unDePlus = prixMensuel(offre.id, offre.maxUtilisateurs + 1)
    expect(unDePlus - auPlafond).toBe(PRIX_UTILISATEUR_SUP)
  })

  test('le plan gratuit ne facture jamais, meme au-dela de son plafond', () => {
    const gratuit = getOffre(OFFRE_GRATUITE)
    expect(gratuit.debordement).toBeNull()
    expect(prixMensuel(OFFRE_GRATUITE, gratuit.maxUtilisateurs + 5)).toBe(0)
  })

  test('au-dela du plafond global, plus aucun tarif au forfait', () => {
    // Au plafond exactement, l'offre de souscription facture encore.
    expect(prixMensuel(OFFRE_INSCRIPTION, PLAFOND_FORFAIT)).not.toBeNull()
    // Un utilisateur de plus : plus aucune offre ne facture, meme celles
    // qui debordent, et meme avec un tarif fondateur.
    OFFRES.forEach(offre => {
      expect(prixMensuel(offre.id, PLAFOND_FORFAIT + 1)).toBeNull()
      expect(prixMensuel(offre.id, 300, TARIF_FONDATEUR)).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------
// Le registre doit dire la meme chose que la grille
// ---------------------------------------------------------------------
describe('registry.js contre offres.js', () => {
  test('chaque module de la grille existe dans le registre', () => {
    const ids = MODULES_REGISTRY.map(m => m.id)
    OFFRES.forEach(o => o.modules.forEach(id => expect(ids).toContain(id)))
  })

  test('chaque module est dans EXACTEMENT une categorie', () => {
    // Depuis que l'effectif et les modules sont deux axes separes, les
    // bandes superieures ne portent plus de contenu. Un module est donc
    // soit disponible (dans une offre), soit pas encore livre (a venir).
    // Un module dans aucune des deux listes serait invisible partout ;
    // dans les deux, il serait annonce comme dispo ET comme a venir.
    // Trois categories depuis la geolocalisation : dans une offre,
    // a venir, ou vendu a la carte. Un module dans aucune serait
    // invisible partout ; dans deux, il serait annonce deux fois.
    const dansUneOffre = OFFRES.flatMap(o => o.modules)
    MODULES_REGISTRY.forEach(mod => {
      const offres = dansUneOffre.filter(id => id === mod.id).length
      const aVenir = MODULES_A_VENIR.includes(mod.id) ? 1 : 0
      const aLaCarte = MODULES_A_LA_CARTE.includes(mod.id) ? 1 : 0
      expect(offres + aVenir + aLaCarte).toBe(1)
    })
  })

  test('un module a la carte EXISTE vraiment', () => {
    // Vendre a part quelque chose qui n'est pas ecrit serait pire que
    // de l'annoncer « bientot » : le client paierait pour un squelette.
    MODULES_A_LA_CARTE.forEach(id => {
      expect(MODULES_DEVELOPPES).toContain(id)
    })
  })

  test('MODULES_A_VENIR vaut exactement le registre MOINS les offres', () => {
    // La liste n'est plus derivee (les bandes ne portent plus de contenu),
    // donc c'est ce test qui l'empeche de deriver. Livrer un module sans
    // le retirer d'ici le ferait annoncer "BIENTOT" alors qu'il existe.
    const dansUneOffre = OFFRES.flatMap(o => o.modules)
    const attendu = MODULES_REGISTRY.map(m => m.id)
      .filter(id => !dansUneOffre.includes(id) && !MODULES_A_LA_CARTE.includes(id))
    expect([...MODULES_A_VENIR].sort()).toEqual([...attendu].sort())
  })

  test('les bandes superieures ne portent aucun contenu propre', () => {
    // C'est la decision : une bande fixe un PRIX, pas un contenu. Y
    // remettre un module rouvrirait le trou -- une boite de 6 personnes
    // ne pourrait jamais l'obtenir, quoi qu'elle paie.
    OFFRES.filter(o => rangOffre(o.id) > rangOffre(OFFRE_INSCRIPTION)).forEach(offre => {
      expect(offre.modules).toEqual([])
    })
  })

  test('le champ plans de chaque module correspond aux offres qui l incluent', () => {
    MODULES_REGISTRY.forEach(mod => {
      const attendu = ORDRE_OFFRES.filter(id => modulesInclus(id).includes(mod.id))
      expect([...mod.plans].sort()).toEqual([...attendu].sort())
    })
  })

  test('aucun module n apparait dans deux offres', () => {
    const vus = []
    OFFRES.forEach(o => o.modules.forEach(id => {
      expect(vus).not.toContain(id)
      vus.push(id)
    }))
  })
})

// ---------------------------------------------------------------------
// Les definitions serveur doivent dire la meme chose
// ---------------------------------------------------------------------
describe('definitions serveur contre offres.js', () => {
  const ts = lire(PLAN1_TS)
  const sql = lire(RPC_SQL)

  test('les fichiers serveur sont lisibles', () => {
    expect(ts).not.toBeNull()
    expect(sql).not.toBeNull()
  })

  test('plan1.ts annonce le meme prix, plafond et identifiant', () => {
    const o = getOffre(OFFRE_INSCRIPTION)
    expect(ts).toMatch(new RegExp("PLAN_1_ID\\s*=\\s*'" + OFFRE_INSCRIPTION + "'"))
    expect(ts).toMatch(new RegExp('PLAN_1_PRIX_MENSUEL\\s*=\\s*' + o.prix + '\\b'))
    expect(ts).toMatch(new RegExp('PLAN_1_MAX_UTILISATEURS\\s*=\\s*' + o.maxUtilisateurs + '\\b'))
    expect(ts).toMatch(new RegExp('PRIX_UTILISATEUR_SUP\\s*=\\s*' + PRIX_UTILISATEUR_SUP + '\\b'))
    expect(ts).toMatch(new RegExp('PLAFOND_FORFAIT\\s*=\\s*' + PLAFOND_FORFAIT + '\\b'))
  })

  test('plan1.ts annonce le meme tarif fondateur', () => {
    expect(ts).toMatch(new RegExp('TARIF_FONDATEUR\\s*=\\s*' + TARIF_FONDATEUR + '\\b'))
    expect(ts).toMatch(new RegExp('FONDATEURS_MAX\\s*=\\s*' + FONDATEURS_MAX + '\\b'))
  })

  test('plan1.ts declare le plan gratuit avec les memes valeurs', () => {
    const g = getOffre(OFFRE_GRATUITE)
    expect(ts).toMatch(new RegExp("PLAN_GRATUIT_ID\\s*=\\s*'" + OFFRE_GRATUITE + "'"))
    expect(ts).toMatch(new RegExp('PLAN_GRATUIT_PRIX_MENSUEL\\s*=\\s*' + g.prix + '\\b'))
    expect(ts).toMatch(new RegExp('PLAN_GRATUIT_MAX_UTILISATEURS\\s*=\\s*' + g.maxUtilisateurs + '\\b'))
  })

  test('plan1.ts active exactement les modules de l offre', () => {
    const attendus = modulesInclus(OFFRE_INSCRIPTION)
    const trouve = ts.match(/PLAN_1_MODULES:\s*readonly string\[\]\s*=\s*\[([^\]]*)\]/)
    expect(trouve).not.toBeNull()
    const declares = trouve[1].split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    expect(declares.sort()).toEqual([...attendus].sort())
  })

  test('la RPC SQL ecrit le bon plan et le bon plafond', () => {
    // C'est la valeur qui finit REELLEMENT dans la table entreprises.
    const o = getOffre(OFFRE_INSCRIPTION)
    expect(sql).toMatch(new RegExp("c_plan\\s+constant\\s+text\\s*:=\\s*'" + OFFRE_INSCRIPTION + "'"))
    expect(sql).toMatch(new RegExp('c_max_utilisateurs\\s+constant\\s+integer\\s*:=\\s*' + o.maxUtilisateurs + '\\b'))
  })

  test('le trigger SQL applique le meme tarif fondateur que la grille', () => {
    // Le comptage des fondateurs se fait en SQL : le navigateur ne decide
    // jamais d'un prix. Si quelqu'un change le tarif dans offres.js sans
    // toucher a la migration, un client entrerait au mauvais prix -- et
    // ce prix est bloque a vie, donc l'erreur serait definitive.
    const fondateur = lire(FONDATEUR_SQL)
    expect(fondateur).not.toBeNull()
    expect(fondateur).toMatch(new RegExp('c_tarif_fondateur\\s+constant\\s+numeric\\s*:=\\s*' + TARIF_FONDATEUR + '\\b'))
    expect(fondateur).toMatch(new RegExp('c_fondateurs_max\\s+constant\\s+integer\\s*:=\\s*' + FONDATEURS_MAX + '\\b'))
    expect(fondateur).toMatch(new RegExp('c_prix_standard\\s+constant\\s+numeric\\s*:=\\s*' + PRIX_STANDARD + '\\b'))
  })

  test('la page d inscription annonce le prix qui sera REELLEMENT facture', () => {
    // Elle affichait le tarif public pendant que le trigger facturait le
    // tarif fondateur. Un ecran qui ment sur un prix bloque a vie, c'est
    // une erreur qu'on ne peut plus rattraper ensuite.
    const page = lire(path.join(__dirname, '..', 'pages', 'Inscription.jsx'))
    expect(page).not.toBeNull()
    expect(page).toMatch(/places_fondateur_restantes/)
    expect(page).toMatch(/TARIF_FONDATEUR/)
  })

  test('la fonction de comptage est lisible sans etre connecte', () => {
    // Un prospect n'a pas de compte : sans droit pour anon, la page
    // retomberait silencieusement sur le tarif public.
    const fondateur = lire(FONDATEUR_SQL)
    expect(fondateur).toMatch(/create or replace function public\.places_fondateur_restantes/)
    expect(fondateur).toMatch(/grant execute on function public\.places_fondateur_restantes\(\) to anon/)
  })

  test('un INTERET declare n est jamais une ACTIVATION', () => {
    // C'est la propriete qui rend honnete d'afficher des modules "BIENTOT"
    // a l'inscription. Le badge "MODULE ACTIF" qu'on a retire affirmait
    // qu'un module fonctionnait alors qu'il n'existait pas ; ici on dit
    // clairement qu'il n'existe pas encore, et on ecrit une DEMANDE.
    const edge = lire(path.join(RACINE, 'supabase', 'functions', 'public-signup', 'index.ts'))
    expect(edge).not.toBeNull()
    // Les interets partent dans demandes_pack...
    expect(edge).toMatch(/modules_demandes: modulesInteresses/)
    // ... et JAMAIS dans entreprise_modules.
    const insertsModulesEntreprise = edge.match(/from\('entreprise_modules'\)\s*\n?\s*\.insert/g) || []
    expect(insertsModulesEntreprise).toHaveLength(0)
    // La liste est filtree contre les modules A VENIR, donc un module
    // developpe ne peut pas s'y glisser.
    expect(edge).toMatch(/filter\(\(m\) => MODULES_A_VENIR\.includes\(m\)\)/)
  })

  test('les modules a venir sont exactement ceux qui ne sont pas developpes', () => {
    MODULES_A_VENIR.forEach(id => {
      expect(MODULES_DEVELOPPES).not.toContain(id)
    })
    // Et reciproquement : rien de developpe ne doit figurer comme "a venir".
    MODULES_DEVELOPPES.forEach(id => {
      expect(MODULES_A_VENIR).not.toContain(id)
    })
  })

  test('les deux definitions des modules a venir concordent', () => {
    const ts = lire(PLAN1_TS)
    const trouve = ts.match(/MODULES_A_VENIR: readonly string\[\] = \[([\s\S]*?)\]/)
    expect(trouve).not.toBeNull()
    const declares = trouve[1].split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    expect(declares.sort()).toEqual([...MODULES_A_VENIR].sort())
  })

  test('le navigateur ne choisit QUE la formule, jamais le prix', () => {
    // Le champ formule voyage depuis le navigateur. S'il servait aussi a
    // transmettre un prix, un plafond ou une liste de modules, n'importe
    // qui pourrait s'offrir un plan en bricolant la requete.
    const edge = lire(path.join(RACINE, 'supabase', 'functions', 'public-signup', 'index.ts'))
    expect(edge).not.toBeNull()
    // La valeur est validee contre une liste fermee...
    expect(edge).toMatch(/formuleBrute === PLAN_GRATUIT_ID \|\| formuleBrute === PLAN_1_ID/)
    // ... et tout le reste reste interdit.
    expect(edge).toMatch(/CHAMPS_INTERDITS[\s\S]*'prix_mensuel'/)
    expect(edge).toMatch(/CHAMPS_INTERDITS[\s\S]*'max_utilisateurs'/)
    expect(edge).toMatch(/CHAMPS_INTERDITS[\s\S]*'modules'/)
  })

  test('la RPC retombe sur l offre payante pour toute formule inconnue', () => {
    // Une valeur vide, nulle ou inventee ne doit jamais donner le gratuit.
    const formule = lire(path.join(RACINE, 'supabase', 'migrations', '20260917_0006_formule_au_choix.sql'))
    expect(formule).not.toBeNull()
    expect(formule).toMatch(/IF coalesce\(trim\(p_formule\), ''\) = c_formule_gratuite THEN/)
    expect(formule).toMatch(/ELSE\s+c_plan\s+:= c_formule_payante;/)
  })

  test('l ancienne signature de la RPC est supprimee', () => {
    // Avec un parametre DEFAULT, Postgres garderait DEUX fonctions et un
    // appel a dix arguments deviendrait ambigu : l'inscription tomberait.
    const formule = lire(path.join(RACINE, 'supabase', 'migrations', '20260917_0006_formule_au_choix.sql'))
    expect(formule).toMatch(/DROP FUNCTION IF EXISTS public\.public_signup_create_entreprise_atomic\(/)
  })

  test('le trigger ne s applique qu aux inscriptions publiques', () => {
    // Une entreprise creee a la main par le Super Admin doit garder le
    // prix qu'il lui a donne : ce n'est pas au code de decider a sa place.
    const fondateur = lire(FONDATEUR_SQL)
    expect(fondateur).toMatch(/origine[^\n]*inscription_autonome/)
    expect(fondateur).toMatch(/pg_advisory_xact_lock/)   // pas de 11e place
  })
})

// ---------------------------------------------------------------------
// FACTURATION DU DEBORDEMENT
//
// max_utilisateurs existait depuis le premier jour et n'etait lu par
// personne : une entreprise a 39 EUR pouvait compter vingt-cinq comptes
// actifs sans que rien ne le dise. Ces tests verrouillent le calcul, et
// surtout son accord avec le calcul SQL -- parce que c'est le SQL qui
// facture.
// ---------------------------------------------------------------------
const {
  detailFacture, impactUtilisateurEnPlus, limiteUtilisateurs, supplementUtilisateur,
} = require('./offres')

const FACTURATION_SQL = path.join(
  RACINE, 'supabase', 'migrations', '20260917_0007_facturation_debordement.sql',
)

// Une entreprise telle qu'elle existe en base.
const ENT_PAYANTE = { plan: OFFRE_INSCRIPTION, prix_mensuel: PRIX_STANDARD, max_utilisateurs: UTILISATEURS_INCLUS }
const ENT_FONDATEUR = { plan: OFFRE_INSCRIPTION, prix_mensuel: TARIF_FONDATEUR, max_utilisateurs: UTILISATEURS_INCLUS }

describe('facturation du debordement', () => {
  test('dans le forfait, on paie le forfait', () => {
    const d = detailFacture(ENT_PAYANTE, UTILISATEURS_INCLUS)
    expect(d.surplus).toBe(0)
    expect(d.supplement).toBe(0)
    expect(d.prixTotal).toBe(PRIX_STANDARD)
    expect(d.surDevis).toBe(false)
  })

  test('chaque utilisateur au-dela du forfait coute PRIX_UTILISATEUR_SUP', () => {
    const d = detailFacture(ENT_PAYANTE, UTILISATEURS_INCLUS + 3)
    expect(d.surplus).toBe(3)
    expect(d.supplement).toBe(3 * PRIX_UTILISATEUR_SUP)
    expect(d.prixTotal).toBe(PRIX_STANDARD + 3 * PRIX_UTILISATEUR_SUP)
  })

  test('le tarif fondateur sert de base au debordement, pas le tarif public', () => {
    // C'est tout l'interet du blocage a vie : le fondateur qui embauche
    // paie 29 + 2 x N, jamais 39 + 2 x N. Si ce test tombe, le « bloque a
    // vie » affiche sur la page Offres est un mensonge.
    const d = detailFacture(ENT_FONDATEUR, UTILISATEURS_INCLUS + 2)
    expect(d.prixBase).toBe(TARIF_FONDATEUR)
    expect(d.prixTotal).toBe(TARIF_FONDATEUR + 2 * PRIX_UTILISATEUR_SUP)
  })

  test('au-dela du plafond du forfait, il n y a plus de prix', () => {
    const d = detailFacture(ENT_PAYANTE, PLAFOND_FORFAIT + 1)
    expect(d.surDevis).toBe(true)
    expect(d.prixTotal).toBeNull()
  })

  test('hors forfait, le supplement est remis a zero plutot que d annoncer un faux montant', () => {
    // A 31 utilisateurs, 21 x 2 = 42 EUR n'est PAS ce qu'on facture : le
    // montant vient d'un devis. Afficher 42 laisserait croire le contraire.
    // Le surplus, lui, reste renseigne : c'est lui qui explique pourquoi.
    const d = detailFacture(ENT_PAYANTE, PLAFOND_FORFAIT + 1)
    expect(d.surplus).toBe(PLAFOND_FORFAIT + 1 - UTILISATEURS_INCLUS)
    expect(d.supplement).toBe(0)
    expect(d.prixTotal).toBeNull()
  })

  test('le plafond lui-meme est encore facture au forfait', () => {
    // Le devis commence STRICTEMENT au-dela : a PLAFOND_FORFAIT pile, le
    // client a un prix. Un test parce qu'une inegalite large ici enverrait
    // une entreprise de 30 salaries chez le commercial sans raison.
    const d = detailFacture(ENT_PAYANTE, PLAFOND_FORFAIT)
    expect(d.surDevis).toBe(false)
    expect(d.prixTotal).toBe(PRIX_STANDARD + (PLAFOND_FORFAIT - UTILISATEURS_INCLUS) * PRIX_UTILISATEUR_SUP)
  })

  test('le plan gratuit ne facture aucun debordement : il demande un changement de formule', () => {
    const g = getOffre(OFFRE_GRATUITE)
    const ent = { plan: OFFRE_GRATUITE, prix_mensuel: g.prix, max_utilisateurs: g.maxUtilisateurs }
    const d = detailFacture(ent, g.maxUtilisateurs + 2)
    expect(d.surplus).toBe(2)
    expect(d.supplement).toBe(0)
    expect(d.prixTotal).toBe(0)
    expect(d.passageRequis).toBe(true)
  })

  test('un max_utilisateurs inutilisable retombe sur la limite du PACK', () => {
    // D'anciens ecrans du Super Admin ont ecrit 0, 999 et rien du tout,
    // selon l'ecran par lequel l'entreprise avait ete creee. Un 0
    // facturerait CHAQUE utilisateur en supplement ; un 999 n'en
    // facturerait jamais aucun. C'est la meme entreprise et deux factures
    // opposees.
    //
    // On ne renonce plus a facturer : on retombe sur ce que le client a
    // achete. Velor One, c'est 10 inclus, quelle que soit la valeur que
    // l'ecran a ecrite dans la colonne.
    const base = { plan: OFFRE_INSCRIPTION, prix_mensuel: PRIX_STANDARD }
    const attendu = getOffre(OFFRE_INSCRIPTION).maxUtilisateurs

    ;[0, 999, null, undefined, -3, 'douze'].forEach(valeur => {
      expect(detailFacture({ ...base, max_utilisateurs: valeur }, 8).inclus).toBe(attendu)
    })
  })

  test('la limite vient du pack, pour chaque pack', () => {
    OFFRES.forEach(offre => {
      expect(limiteUtilisateurs(offre.id)).toBe(offre.maxUtilisateurs ?? null)
    })
  })

  test('un forfait negocie par le Super Admin l emporte, s il est exploitable', () => {
    // Un client a qui on a accorde 15 inclus garde ses 15.
    expect(limiteUtilisateurs(OFFRE_INSCRIPTION, 15)).toBe(15)
    expect(detailFacture(
      { plan: OFFRE_INSCRIPTION, prix_mensuel: PRIX_STANDARD, max_utilisateurs: 15 }, 17,
    ).surplus).toBe(2)
  })

  test('« Sur mesure » n a pas de limite facturable', () => {
    // Ce n'est pas un trou dans les donnees : le montant vient d'un devis.
    expect(limiteUtilisateurs('enterprise')).toBeNull()
  })

  test('un plan inconnu ne facture pas de supplement au hasard', () => {
    expect(limiteUtilisateurs('pack_legacy')).toBeNull()
    expect(detailFacture({ plan: 'pack_legacy', prix_mensuel: 39 }, 50).supplement).toBe(0)
  })

  test('le supplement annonce est celui du pack', () => {
    expect(supplementUtilisateur(OFFRE_INSCRIPTION)).toBe(PRIX_UTILISATEUR_SUP)
    // Le gratuit n'a pas de debordement : son plafond est un vrai plafond.
    expect(supplementUtilisateur(OFFRE_GRATUITE)).toBe(0)
  })

  test('depasser la limite ne bloque jamais, ca ajoute au montant', () => {
    // C'est la regle commerciale : on ne refuse pas la creation d'un
    // compte, on facture le supplement. Un plafond dur pousserait le 11e
    // salarie a pointer sur le telephone d'un collegue.
    const ent = { plan: OFFRE_INSCRIPTION, prix_mensuel: PRIX_STANDARD, max_utilisateurs: 10 }
    const d = detailFacture(ent, 13)
    expect(d.surplus).toBe(3)
    expect(d.supplement).toBe(3 * PRIX_UTILISATEUR_SUP)
    expect(d.prixTotal).toBe(PRIX_STANDARD + 3 * PRIX_UTILISATEUR_SUP)
    expect(d.passageRequis).toBe(false)
  })

  test('un compte desactive ne se facture pas : c est l appelant qui compte les actifs', () => {
    // La regle du comptage est ailleurs (utilisateurs_factures en base,
    // employes actifs dans la liste). Ici on verifie seulement que la
    // fonction prend le nombre qu'on lui donne, sans le recalculer.
    expect(detailFacture(ENT_PAYANTE, 0).prixTotal).toBe(PRIX_STANDARD)
    expect(detailFacture(ENT_PAYANTE, -5).utilisateurs).toBe(0)
  })

  test('l impact d un utilisateur en plus est annonce avant la creation', () => {
    const sousLeForfait = impactUtilisateurEnPlus(ENT_PAYANTE, UTILISATEURS_INCLUS - 2)
    expect(sousLeForfait.cout).toBe(0)
    expect(sousLeForfait.franchitUneLimite).toBe(false)

    const auFranchissement = impactUtilisateurEnPlus(ENT_PAYANTE, UTILISATEURS_INCLUS)
    expect(auFranchissement.cout).toBe(PRIX_UTILISATEUR_SUP)
    expect(auFranchissement.franchitUneLimite).toBe(true)
    expect(auFranchissement.apres.prixTotal).toBe(PRIX_STANDARD + PRIX_UTILISATEUR_SUP)
  })

  test('franchir le plafond du forfait est signale meme si le surcout n est plus calculable', () => {
    const i = impactUtilisateurEnPlus(ENT_PAYANTE, PLAFOND_FORFAIT)
    expect(i.cout).toBeNull()          // plus de prix au forfait
    expect(i.franchitUneLimite).toBe(true)  // ... mais il faut le dire
  })

  // -------------------------------------------------------------------
  // Accord avec le SQL : c'est le SQL qui facture.
  // -------------------------------------------------------------------
  test('le SQL facture le meme supplement et le meme plafond que la grille', () => {
    const f = lire(FACTURATION_SQL)
    expect(f).not.toBeNull()
    expect(f).toMatch(new RegExp('c_prix_utilisateur_sup\\s+constant\\s+numeric\\s*:=\\s*' + PRIX_UTILISATEUR_SUP + '\\b'))
    expect(f).toMatch(new RegExp('c_plafond_forfait\\s+constant\\s+integer\\s*:=\\s*' + PLAFOND_FORFAIT + '\\b'))
  })

  test('le SQL compte les profils actifs et exclut le super admin', () => {
    // Le compte de supervision de Velor Telecom n'a rien a faire sur la
    // facture d'un client, et un salarie parti n'est plus facture -- c'est
    // exactement pour ca que la desactivation existe.
    const f = lire(FACTURATION_SQL)
    expect(f).toMatch(/COALESCE\(p\.actif, true\) = true/)
    expect(f).toMatch(/COALESCE\(p\.is_super_admin, false\) = false/)
  })

  test('le SQL prend la base de prix sur la ligne entreprise, pas sur la grille', () => {
    // Si un jour quelqu'un ecrit 39 en dur dans cette fonction, tous les
    // fondateurs perdent leur tarif le mois suivant, sans un mot.
    const f = lire(FACTURATION_SQL)
    expect(f).toMatch(/e\.prix_mensuel/)
    expect(f).not.toMatch(new RegExp(':=\\s*' + PRIX_STANDARD + '\\s*;'))
  })

  test('une periode deja figee ne peut pas etre reecrite', () => {
    // C'est la seule garantie qui compte pour une facture : le montant
    // qu'on a envoye le 5 doit etre le meme le 20.
    const f = lire(FACTURATION_SQL)
    expect(f).toMatch(/UNIQUE \(entreprise_id, periode\)/)
    expect(f).toMatch(/ON CONFLICT \(entreprise_id, periode\) DO NOTHING/)
  })

  test('le SQL remet lui aussi le supplement a zero hors forfait', () => {
    const f = lire(FACTURATION_SQL)
    expect(f).toMatch(/WHEN v_nb > c_plafond_forfait THEN 0::numeric/)
  })

  test('les releves ne sont jamais ecrits depuis le navigateur', () => {
    const f = lire(FACTURATION_SQL)
    expect(f).toMatch(/GRANT SELECT ON public\.releves_facturation TO authenticated;/)
    expect(f).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^\n]*releves_facturation[^\n]*authenticated/)
  })

  test('figer un releve est reserve au super admin', () => {
    const f = lire(FACTURATION_SQL)
    expect(f).toMatch(/IF NOT public\.is_super_admin\(\) THEN[\s\S]{0,200}ACCES_REFUSE/)
  })
})

// ---------------------------------------------------------------------
// LA BASE DOIT ACCEPTER TOUTES LES FORMULES DE LA GRILLE
//
// entreprises_plan_check datait d'avant l'offre gratuite. La grille
// annoncait cinq formules, la base en acceptait quatre : toute
// inscription en formule gratuite etait refusee, et le visiteur ne lisait
// qu'un message generique. Meme famille que les quatre definitions de
// packs divergentes -- sauf qu'ici la divergence etait entre le code et
// une CONTRAINTE, que rien ne relisait.
// ---------------------------------------------------------------------
describe('accord entre la grille et la contrainte de la base', () => {
  const PLAN_SQL = path.join(
    RACINE, 'supabase', 'migrations', '20260917_0009_plan_gratuit_autorise.sql',
  )

  test('la migration autorise chaque identifiant de la grille', () => {
    const sqlPlan = lire(PLAN_SQL)
    expect(sqlPlan).not.toBeNull()

    const trouve = sqlPlan.match(/c_formules\s+constant\s+text\[\]\s*:=\s*ARRAY\[([^\]]*)\]/)
    expect(trouve).not.toBeNull()

    const autorises = trouve[1].split(',')
      .map(s => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)

    expect(autorises.sort()).toEqual([...ORDRE_OFFRES].sort())
  })

  test('la migration ne retrecit jamais la liste existante', () => {
    // Elle prend l'UNION de la grille et des plans deja en base. Ecrire
    // la liste en dur ferait passer la contrainte sans erreur, puis
    // casserait la premiere mise a jour d'une entreprise au plan oublie,
    // des mois plus tard et sans rapport visible.
    const sqlPlan = lire(PLAN_SQL)
    expect(sqlPlan).toMatch(/UNION\s+SELECT DISTINCT e\.plan FROM public\.entreprises e/)
  })
})

// ---------------------------------------------------------------------
// LE GRATUIT N'EST PAS UN ESSAI
//
// set_essai_14j posait 14 jours sur toute inscription publique. Depuis
// que la formule gratuite passe par la meme porte, elle recevait elle
// aussi une date de fin, puis basculait en lecture seule. La page
// d'inscription annonce « gratuit » : sa limite est le nombre
// d'utilisateurs, pas le temps.
// ---------------------------------------------------------------------
describe('le plan gratuit n expire pas', () => {
  const ESSAI_SQL = path.join(
    RACINE, 'supabase', 'migrations', '20260918_0001_gratuit_sans_essai.sql',
  )

  test('le trigger d essai exclut la formule gratuite', () => {
    const essai = lire(ESSAI_SQL)
    expect(essai).not.toBeNull()
    expect(essai).toMatch(new RegExp("c_formule_gratuite\\s+constant\\s+text\\s*:=\\s*'" + OFFRE_GRATUITE + "'"))
    expect(essai).toMatch(/coalesce\(new\.plan, ''\) <> c_formule_gratuite/)
  })

  test('le rattrapage ne touche QUE les entreprises gratuites', () => {
    // Retirer sa date de fin a un client payant lui offrirait un
    // abonnement illimite : la symetrie exacte du bug qu'on corrige.
    const essai = lire(ESSAI_SQL)
    expect(essai).toMatch(/UPDATE public\.entreprises[\s\S]{0,200}WHERE plan = 'gratuit'/)
  })

  test('la grille confirme que le gratuit se limite en utilisateurs, pas en duree', () => {
    const g = getOffre(OFFRE_GRATUITE)
    expect(g.prix).toBe(0)
    expect(g.maxUtilisateurs).toBeGreaterThan(0)
    expect(g.debordement).toBeNull()
  })
})

// =====================================================================
// LA LIMITE SE FACTURE, ELLE NE BLOQUE PAS
//
// Regle commerciale : on cree les limites pour calculer le supplement,
// on n'interdit jamais au client de creer un compte de plus.
//
// Un plafond dur aurait un effet pervers mesurable : le client ne
// creerait pas le 11e compte, et le 11e salarie pointerait sur le
// telephone d'un collegue. Le decompte des heures -- la seule chose qui
// ait ici une valeur legale -- deviendrait faux pour economiser 2 EUR.
// =====================================================================
describe('aucun ecran ne bloque la creation au-dela de la limite', () => {
  const fs = require('fs')
  const path = require('path')
  const RACINE = path.join(__dirname, '..')

  function fichiers(dossier, acc = []) {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach((e) => {
      const complet = path.join(dossier, e.name)
      if (e.isDirectory()) return fichiers(complet, acc)
      if (!/\.(js|jsx)$/.test(e.name)) return
      if (/\.test\.(js|jsx)$/.test(e.name)) return
      acc.push(complet)
      return acc
    })
    return acc
  }

  /** Le code seul : nos propres commentaires ne doivent pas declencher. */
  function codeSeul(chemin) {
    return fs.readFileSync(chemin, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
  }

  // Les formes qu'aurait un blocage : une comparaison de l'effectif a la
  // limite, suivie d'un refus. On cherche la comparaison ; s'il y en a
  // une, c'est a un humain de dire si elle bloque.
  const SUSPECTES = [
    /utilisateurs\s*>=?\s*(max_utilisateurs|maxUtilisateurs|limite)/,
    /(max_utilisateurs|maxUtilisateurs)\s*<=?\s*(utilisateurs|nbUtilisateurs)/,
    /limite_atteinte|limiteAtteinte|quota_depasse|quotaDepasse/,
  ]

  test('aucune comparaison effectif / limite ne sert de refus', () => {
    const coupables = []
    fichiers(RACINE).forEach((f) => {
      const code = codeSeul(f)
      SUSPECTES.forEach((motif) => {
        if (motif.test(code)) coupables.push(path.relative(RACINE, f) + ' : ' + motif)
      })
    })
    expect(coupables).toEqual([])
  })

  test('depasser reste possible et se facture', () => {
    const ent = { plan: OFFRE_INSCRIPTION, prix_mensuel: PRIX_STANDARD, max_utilisateurs: 10 }
    // 50 utilisateurs : au-dela du plafond du forfait, donc sur devis --
    // mais toujours aucune notion de refus.
    expect(detailFacture(ent, 50).surDevis).toBe(true)
    // Juste au-dessus de la limite : ca passe, et ca coute 2 EUR.
    expect(detailFacture(ent, 11).supplement).toBe(PRIX_UTILISATEUR_SUP)
    expect(impactUtilisateurEnPlus(ent, 10).cout).toBe(PRIX_UTILISATEUR_SUP)
  })
})

// =====================================================================
// LA GRILLE ET LE SQL DISENT LA MEME CHOSE
//
// utilisateurs_inclus() porte une copie SQL des limites de chaque pack.
// Une copie est une divergence en attente : ce test la relit et casse le
// build si elle s'ecarte de OFFRES. Meme verrou que pour la RPC
// d'inscription et pour etat_facturation.
// =====================================================================
describe('les limites de packs sont identiques en JS et en SQL', () => {
  const fs = require('fs')
  const path = require('path')

  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'supabase', 'migrations',
      '20260919_0002_facturation_client_prorata.sql'),
    'utf8',
  )

  /** Les couples ('plan', limite) declares dans la fonction SQL. */
  function limitesSql() {
    const bloc = sql.match(/from \(values([\s\S]*?)\) as o\(plan, limite\)/)
    if (!bloc) return null
    const out = {}
    const motif = /\('([a-z_]+)',\s*(\d+|null::integer)\)/g
    let m
    while ((m = motif.exec(bloc[1])) !== null) {
      out[m[1]] = m[2] === 'null::integer' ? null : Number(m[2])
    }
    return out
  }

  test('le bloc de limites est bien trouve dans le SQL', () => {
    // Sans ce garde-fou, une fonction renommee ferait passer les tests
    // suivants sur un objet vide -- ils reussiraient sans rien verifier.
    const l = limitesSql()
    expect(l).not.toBeNull()
    expect(Object.keys(l).length).toBe(OFFRES.length)
  })

  test.each(OFFRES.map(o => [o.id, o.maxUtilisateurs ?? null]))(
    'pack %s : la limite SQL vaut %s',
    (id, attendu) => {
      expect(limitesSql()[id]).toBe(attendu)
    },
  )

  test('le prix de l utilisateur supplementaire est le meme des deux cotes', () => {
    // 2 EUR est passe en dur a prorata_utilisateurs_sup.
    expect(sql).toMatch(new RegExp(String(PRIX_UTILISATEUR_SUP) + '::numeric, v_debut, p_jusqu_au'))
  })

  test('le plafond du forfait est le meme des deux cotes', () => {
    expect(sql).toMatch(new RegExp('p_max_utilisateurs <= ' + PLAFOND_FORFAIT))
  })
})

// =====================================================================
// LE SUR-MESURE NE SE CHOISIT PAS TOUT SEUL
//
// Des modules choisis a un prix negocie, ca se decide dans une
// conversation. Le Super Admin l'applique ensuite a l'entreprise.
//
// La regle existait deja, mais par effet de bord : l'ecran ne proposait
// pas l'offre parce que son prix valait null. Le jour ou quelqu'un lui
// donne un prix indicatif pour l'afficher joliment, elle redeviendrait
// selectionnable sans que personne l'ait voulu.
// =====================================================================
describe('offres reservees au Super Admin', () => {
  const { OFFRES_PUBLIQUES, choisissableALInscription } = require('./offres')
  const fs = require('fs')
  const path = require('path')

  test('le sur-mesure n est pas choisissable a l inscription', () => {
    expect(choisissableALInscription('enterprise')).toBe(false)
    expect(OFFRES_PUBLIQUES.map(o => o.id)).not.toContain('enterprise')
  })

  test('mais il reste affiche : le visiteur doit savoir qu il existe', () => {
    // L'exclure de la page entierement reviendrait a cacher une offre
    // qu'on vend vraiment.
    expect(OFFRES.map(o => o.id)).toContain('enterprise')
  })

  test('toute offre reservee est exclue, pas seulement celle-la', () => {
    OFFRES.filter(o => o.reserveSuperAdmin).forEach(o => {
      expect(choisissableALInscription(o.id)).toBe(false)
    })
  })

  test('les offres publiques ont toutes un prix', () => {
    // Sans prix, l'inscription creerait une entreprise a facturer zero.
    OFFRES_PUBLIQUES.forEach(o => {
      expect(typeof o.prix).toBe('number')
    })
  })

  test('l ecran d inscription passe par la regle, pas par le prix', () => {
    const ecran = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Inscription.jsx'), 'utf8')
    expect(ecran).toMatch(/choisissableALInscription\(offre\.id\)/)
    expect(ecran).not.toMatch(/const choisissable = offre\.vendu && offre\.prix != null/)
  })

  test('le serveur refuse de lui-meme toute autre formule', () => {
    // La vraie barriere est la : un navigateur bricole n'obtient pas un
    // pack qu'il n'a pas le droit de choisir.
    const fonction = fs.readFileSync(
      path.join(__dirname, '..', '..', 'supabase', 'functions', 'public-signup', 'index.ts'),
      'utf8',
    )
    expect(fonction).toMatch(/formuleBrute === PLAN_GRATUIT_ID \|\| formuleBrute === PLAN_1_ID/)
  })
})
