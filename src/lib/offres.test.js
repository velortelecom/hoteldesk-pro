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

  test('chaque module est SOIT dans une offre, SOIT a venir -- jamais les deux, jamais aucun', () => {
    // Depuis que l'effectif et les modules sont deux axes separes, les
    // bandes superieures ne portent plus de contenu. Un module est donc
    // soit disponible (dans une offre), soit pas encore livre (a venir).
    // Un module dans aucune des deux listes serait invisible partout ;
    // dans les deux, il serait annonce comme dispo ET comme a venir.
    const dansUneOffre = OFFRES.flatMap(o => o.modules)
    MODULES_REGISTRY.forEach(mod => {
      const offres = dansUneOffre.filter(id => id === mod.id).length
      const aVenir = MODULES_A_VENIR.includes(mod.id) ? 1 : 0
      expect(offres + aVenir).toBe(1)
    })
  })

  test('MODULES_A_VENIR vaut exactement le registre MOINS les offres', () => {
    // La liste n'est plus derivee (les bandes ne portent plus de contenu),
    // donc c'est ce test qui l'empeche de deriver. Livrer un module sans
    // le retirer d'ici le ferait annoncer "BIENTOT" alors qu'il existe.
    const dansUneOffre = OFFRES.flatMap(o => o.modules)
    const attendu = MODULES_REGISTRY.map(m => m.id).filter(id => !dansUneOffre.includes(id))
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
