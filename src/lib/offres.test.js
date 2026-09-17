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
  UTILISATEURS_INCLUS, PRIX_UTILISATEUR_SUP,
  getOffre, modulesInclus, prixMensuel, prixSouscription, necessiteDevis,
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

  test('les premieres entreprises l obtiennent, les suivantes non', () => {
    expect(prixSouscription(0)).toEqual({ prix: TARIF_FONDATEUR, fondateur: true, restants: FONDATEURS_MAX })
    expect(prixSouscription(FONDATEURS_MAX - 1).fondateur).toBe(true)
    expect(prixSouscription(FONDATEURS_MAX)).toEqual({ prix: PRIX_STANDARD, fondateur: false, restants: 0 })
    expect(prixSouscription(FONDATEURS_MAX + 50).prix).toBe(PRIX_STANDARD)
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
    expect(necessiteDevis(PLAFOND_FORFAIT)).toBe(false)
    expect(necessiteDevis(PLAFOND_FORFAIT + 1)).toBe(true)
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

  test('chaque module du registre appartient a exactement une offre', () => {
    const grille = OFFRES.flatMap(o => o.modules)
    MODULES_REGISTRY.forEach(mod => {
      expect(grille.filter(id => id === mod.id)).toHaveLength(1)
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

  test('le trigger ne s applique qu aux inscriptions publiques', () => {
    // Une entreprise creee a la main par le Super Admin doit garder le
    // prix qu'il lui a donne : ce n'est pas au code de decider a sa place.
    const fondateur = lire(FONDATEUR_SQL)
    expect(fondateur).toMatch(/origine[^\n]*inscription_autonome/)
    expect(fondateur).toMatch(/pg_advisory_xact_lock/)   // pas de 11e place
  })
})
