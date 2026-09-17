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
// Ils s'etaient deja contredits : le registre annoncait le pointage dans
// starter, les deux definitions serveur non. Personne ne s'en etait apercu
// parce que rien ne les comparait.
//
// Ces tests relisent les fichiers reels -- y compris le TypeScript et le
// SQL, que le front n'importe pas. Modifier un prix a un seul endroit fait
// donc echouer le build, ce qui est exactement le but.
// =====================================================================
const fs = require('fs')
const path = require('path')

const {
  OFFRES, ORDRE_OFFRES, OFFRE_INSCRIPTION, OFFRE_GRATUITE, PRIX_OPTION_MENSUEL,
  MODULES_OPTIONNELS, PLAFOND_FORFAIT,
  getOffre, modulesInclus, prixMensuel, meilleureOffre, necessiteDevis,
} = require('./offres')
const { MODULES_REGISTRY } = require('../modules/registry')

const RACINE = path.join(__dirname, '..', '..')
const PLAN1_TS = path.join(RACINE, 'supabase', 'functions', '_shared', 'plan1.ts')
const RPC_SQL = path.join(RACINE, 'supabase', 'migrations', '20260915_inscription_publique_plan1.sql')

function lire(fichier) {
  return fs.existsSync(fichier) ? fs.readFileSync(fichier, 'utf8') : null
}

// ---------------------------------------------------------------------
// Coherence interne de la grille
// ---------------------------------------------------------------------
describe('grille commerciale', () => {
  test('les offres sont classees du moins cher au plus cher', () => {
    const payantes = OFFRES.filter(o => o.prix != null)
    for (let i = 1; i < payantes.length; i++) {
      expect(payantes[i].prix).toBeGreaterThan(payantes[i - 1].prix)
    }
  })

  test('les plafonds d utilisateurs sont croissants', () => {
    const plafonnees = OFFRES.filter(o => o.maxUtilisateurs != null)
    for (let i = 1; i < plafonnees.length; i++) {
      expect(plafonnees[i].maxUtilisateurs).toBeGreaterThan(plafonnees[i - 1].maxUtilisateurs)
    }
  })

  test('aucun module n apparait dans deux offres', () => {
    const vus = []
    OFFRES.forEach(o => o.modules.forEach(id => {
      expect(vus).not.toContain(id)
      vus.push(id)
    }))
  })

  test('le plan gratuit est bien gratuit et existe', () => {
    const gratuit = getOffre(OFFRE_GRATUITE)
    expect(gratuit).not.toBeNull()
    expect(gratuit.prix).toBe(0)
    expect(gratuit.maxUtilisateurs).toBeGreaterThan(0)
    // Pas de debordement : on ne facture jamais un plan gratuit. Le plafond
    // est dur, c'est ce qui pousse a passer au Starter.
    expect(gratuit.debordement).toBeNull()
  })

  test('l inscription publique ne cree pas le plan gratuit', () => {
    // L'inscription cree un Starter avec 14 jours d'essai. Le plan Gratuit
    // est la sortie de l'essai, pas l'entree.
    expect(OFFRE_INSCRIPTION).not.toBe(OFFRE_GRATUITE)
  })
})

// ---------------------------------------------------------------------
// La regle des options : le 4e module doit rendre Premium moins cher
// ---------------------------------------------------------------------
describe('options a l unite', () => {
  test('les modules optionnels sont ceux du pack Premium', () => {
    expect(MODULES_OPTIONNELS).toEqual(getOffre('premium').modules)
  })

  test('a partir du 4e module, le pack Premium est moins cher que les options', () => {
    const business = getOffre('business').prix
    const premium = getOffre('premium').prix

    // 3 options : les options restent gagnantes.
    expect(business + 3 * PRIX_OPTION_MENSUEL).toBeLessThan(premium)
    // 4 options : Premium passe devant (ou egale), sinon il ne se vend plus.
    expect(business + 4 * PRIX_OPTION_MENSUEL).toBeGreaterThanOrEqual(premium)
  })

  test('meilleureOffre propose Business + option plutot que Premium pour un seul module', () => {
    const choix = meilleureOffre(8, ['pointage', 'gps'])
    expect(choix.offreId).toBe('business')
    expect(choix.options).toEqual(['gps'])
    expect(choix.prix).toBe(getOffre('business').prix + PRIX_OPTION_MENSUEL)
  })

  test('meilleureOffre bascule sur Premium quand quatre modules sont demandes', () => {
    const choix = meilleureOffre(8, ['pointage', 'gps', 'qualite', 'formations', 'securite'])
    expect(choix.offreId).toBe('premium')
    expect(choix.options).toEqual([])
  })
})

// ---------------------------------------------------------------------
// Debordement : plus de falaise entre deux packs
// ---------------------------------------------------------------------
describe('debordement', () => {
  test('le prix ne saute pas au franchissement du plafond', () => {
    OFFRES.filter(o => o.debordement != null).forEach(offre => {
      const auPlafond = prixMensuel(offre.id, offre.maxUtilisateurs)
      const unDePlus = prixMensuel(offre.id, offre.maxUtilisateurs + 1)
      expect(unDePlus - auPlafond).toBe(offre.debordement)
    })
  })

  test('le tarif par utilisateur supplementaire est degressif', () => {
    // Plus le pack est haut, moins l'utilisateur en plus coute cher. Un
    // debordement qui augmenterait avec le pack punirait le client qui
    // grandit -- exactement ce qu'on vient de supprimer avec les plafonds
    // durs.
    const debordements = OFFRES.filter(o => o.debordement != null).map(o => o.debordement)
    for (let i = 1; i < debordements.length; i++) {
      expect(debordements[i]).toBeLessThanOrEqual(debordements[i - 1])
    }
  })

  test('un plan sans debordement ne facture jamais au-dela de son forfait', () => {
    const gratuit = getOffre(OFFRE_GRATUITE)
    expect(prixMensuel(OFFRE_GRATUITE, gratuit.maxUtilisateurs + 50)).toBe(0)
  })
})

// ---------------------------------------------------------------------
// Au-dela du plus gros forfait : devis, jamais un prix invente
// ---------------------------------------------------------------------
describe('passage au devis', () => {
  test('le plafond du forfait est celui du plus gros pack facture', () => {
    expect(PLAFOND_FORFAIT).toBe(getOffre('premium').maxUtilisateurs)
  })

  test('au plafond exactement, on est encore au forfait', () => {
    expect(necessiteDevis(PLAFOND_FORFAIT, ['pointage'])).toBe(false)
    // A 100 utilisateurs, Business deborderait a 49 + 2 x 75 = 199 EUR alors
    // que le Premium est a 129 EUR : c'est Premium qu'il faut recommander.
    // Le debordement ne doit jamais couter plus cher que le pack du dessus.
    expect(meilleureOffre(PLAFOND_FORFAIT, ['pointage']).offreId).toBe('premium')
  })

  test('le debordement ne coute jamais plus cher que le pack au-dessus', () => {
    for (let n = 4; n <= PLAFOND_FORFAIT; n++) {
      const choix = meilleureOffre(n, ['pointage'])
      expect(choix).not.toBeNull()
      OFFRES.filter(o => o.prix != null).forEach(offre => {
        const forfait = prixMensuel(offre.id, n)
        if (forfait != null && modulesInclus(offre.id).includes('pointage')) {
          expect(choix.prix).toBeLessThanOrEqual(forfait)
        }
      })
    }
  })

  test('un utilisateur de plus que le plafond bascule sur devis', () => {
    expect(necessiteDevis(PLAFOND_FORFAIT + 1, ['pointage'])).toBe(true)
    expect(meilleureOffre(PLAFOND_FORFAIT + 1, ['pointage'])).toBeNull()
  })

  test('le Premium ne deborde plus : il s arrete a son plafond', () => {
    // Regression : le Premium debordait auparavant a 1,50 EUR/utilisateur,
    // ce qui produisait un tarif de 429 EUR a 300 salaries sans que
    // personne n'ait jamais parle au client.
    expect(getOffre('premium').debordement).toBeNull()
  })

  test('AUCUN pack ne facture au-dela du plafond global, meme ceux qui debordent', () => {
    // Le trou d'origine : Business deborde a 2 EUR/utilisateur sans limite.
    // Un client de 300 salaries serait reste sur Business a 599 EUR, tarife
    // par une formule, sans devis et sans conversation.
    OFFRES.filter(o => o.prix != null).forEach(offre => {
      expect(prixMensuel(offre.id, PLAFOND_FORFAIT + 1)).toBeNull()
      expect(prixMensuel(offre.id, 300)).toBeNull()
    })
  })

  test('un module reserve a Enterprise ne s achete pas en option', () => {
    expect(necessiteDevis(10, ['white_label'])).toBe(true)
  })
})

// ---------------------------------------------------------------------
// Le registre doit dire la meme chose que la grille
// ---------------------------------------------------------------------
describe('registry.js contre offres.js', () => {
  test('chaque module de la grille existe dans le registre', () => {
    const idsRegistre = MODULES_REGISTRY.map(m => m.id)
    OFFRES.forEach(offre => offre.modules.forEach(id => {
      expect(idsRegistre).toContain(id)
    }))
  })

  test('chaque module du registre appartient a exactement une offre', () => {
    const idsGrille = OFFRES.flatMap(o => o.modules)
    MODULES_REGISTRY.forEach(mod => {
      expect(idsGrille.filter(id => id === mod.id)).toHaveLength(1)
    })
  })

  test('le champ plans de chaque module correspond aux offres qui l incluent', () => {
    MODULES_REGISTRY.forEach(mod => {
      const attendu = ORDRE_OFFRES.filter(offreId => modulesInclus(offreId).includes(mod.id))
      expect([...mod.plans].sort()).toEqual([...attendu].sort())
    })
  })

  test('le pointage n est plus vendu dans le plan Starter', () => {
    // Regression explicite : c'etait la divergence d'origine entre le
    // registre et les deux definitions serveur.
    const pointage = MODULES_REGISTRY.find(m => m.id === 'pointage')
    expect(pointage).toBeDefined()
    expect(pointage.plans).not.toContain('starter')
    expect(pointage.plans).not.toContain('gratuit')
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

  test('plan1.ts annonce le meme prix et le meme plafond que la grille', () => {
    const starter = getOffre(OFFRE_INSCRIPTION)
    expect(ts).toMatch(new RegExp('PLAN_1_PRIX_MENSUEL\\s*=\\s*' + starter.prix + '\\b'))
    expect(ts).toMatch(new RegExp('PLAN_1_MAX_UTILISATEURS\\s*=\\s*' + starter.maxUtilisateurs + '\\b'))
    expect(ts).toMatch(new RegExp("PLAN_1_ID\\s*=\\s*'" + OFFRE_INSCRIPTION + "'"))
  })

  test('plan1.ts declare le plan gratuit avec les memes valeurs', () => {
    const gratuit = getOffre(OFFRE_GRATUITE)
    expect(ts).toMatch(new RegExp("PLAN_GRATUIT_ID\\s*=\\s*'" + OFFRE_GRATUITE + "'"))
    expect(ts).toMatch(new RegExp('PLAN_GRATUIT_PRIX_MENSUEL\\s*=\\s*' + gratuit.prix + '\\b'))
    expect(ts).toMatch(new RegExp('PLAN_GRATUIT_MAX_UTILISATEURS\\s*=\\s*' + gratuit.maxUtilisateurs + '\\b'))
  })

  test('plan1.ts annonce le meme prix d option', () => {
    expect(ts).toMatch(new RegExp('PRIX_OPTION_MENSUEL\\s*=\\s*' + PRIX_OPTION_MENSUEL + '\\b'))
  })

  test('la RPC SQL ecrit le meme prix et le meme plafond', () => {
    // C'est la valeur qui finit REELLEMENT dans la table entreprises.
    const starter = getOffre(OFFRE_INSCRIPTION)
    expect(sql).toMatch(new RegExp("c_plan\\s+constant\\s+text\\s*:=\\s*'" + OFFRE_INSCRIPTION + "'"))
    expect(sql).toMatch(new RegExp('c_prix_mensuel\\s+constant\\s+numeric\\s*:=\\s*' + starter.prix + '\\b'))
    expect(sql).toMatch(new RegExp('c_max_utilisateurs\\s+constant\\s+integer\\s*:=\\s*' + starter.maxUtilisateurs + '\\b'))
  })

  test('plan1.ts et la grille activent les memes modules a l inscription', () => {
    const attendus = modulesInclus(OFFRE_INSCRIPTION)
    const trouve = ts.match(/PLAN_1_MODULES:\s*readonly string\[\]\s*=\s*\[([^\]]*)\]/)
    expect(trouve).not.toBeNull()
    const declares = trouve[1].split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    expect(declares.sort()).toEqual([...attendus].sort())
  })
})
