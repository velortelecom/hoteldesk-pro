// src/lib/modulesALaCarte.test.js
// =====================================================================
// DEUX DECISIONS PRISES LE 19/09/2026, ET CE QUI LES PROTEGE.
//
//   1. La geolocalisation se vend A LA CARTE. Elle n'est dans aucun
//      pack, et un changement de pack ne doit ni la donner ni la
//      reprendre.
//   2. Un salarie n'accede PAS a ses propres positions dans l'appli.
//      Il est informe qu'il est suivi (le bandeau), mais la consultation
//      passe par l'employeur.
//
// Ces deux regles ne se voient pas en lisant un ecran : elles vivent
// dans une liste, une politique RLS et un tableau d'onglets. C'est
// exactement le genre de decision qu'un commit distrait annule sans que
// personne ne s'en apercoive avant la facture ou le controle.
// =====================================================================
const fs = require('fs')
const path = require('path')
const {
  MODULES_A_LA_CARTE,
  modulesApresChangementDePack,
  modulesInclus,
  ORDRE_OFFRES,
} = require('./offres')

// =====================================================================
// 1. LA GEOLOC N'EST DANS AUCUN PACK
// =====================================================================
describe('la geolocalisation se vend a la carte', () => {
  test('elle est declaree a la carte', () => {
    expect(MODULES_A_LA_CARTE).toContain('gps')
  })

  test('et elle n est incluse dans AUCUNE offre, pas meme Sur mesure', () => {
    // Le piege : « enterprise » signifiait « tous les modules ». Un
    // client Sur mesure recevait donc la geoloc sans la payer.
    ORDRE_OFFRES.forEach((offreId) => {
      expect(modulesInclus(offreId)).not.toContain('gps')
    })
  })
})

describe('un changement de pack ne touche pas a ce qui se vend a part', () => {
  test('changer de pack GARDE la geoloc deja achetee', () => {
    // Sans cette regle, monter un client de Velor One a Business lui
    // retirait la geolocalisation qu'il paie -- en silence, comme effet
    // de bord d'un changement de tarif.
    const apres = modulesApresChangementDePack('business', ['organisation', 'conges', 'pointage', 'gps'])
    expect(apres).toContain('gps')
    modulesInclus('business').forEach((id) => expect(apres).toContain(id))
  })

  test('changer de pack ne DONNE pas la geoloc a qui ne l a pas', () => {
    const apres = modulesApresChangementDePack('enterprise', ['organisation'])
    expect(apres).not.toContain('gps')
  })

  test('le pack de destination fait foi pour tout le reste', () => {
    // Un module d'un pack superieur ne se garde pas en descendant :
    // seuls les modules a la carte echappent au pack.
    const apres = modulesApresChangementDePack('gratuit', ['organisation', 'conges', 'pointage'])
    expect(apres).toEqual(modulesInclus('gratuit'))
    expect(apres).not.toContain('pointage')
  })

  test('une selection absente ou abimee ne casse rien', () => {
    expect(modulesApresChangementDePack('starter')).toEqual(modulesInclus('starter'))
    expect(modulesApresChangementDePack('starter', null)).toEqual(modulesInclus('starter'))
    expect(modulesApresChangementDePack('pack-inconnu', ['gps'])).toEqual(['gps'])
  })

  test('aucun doublon, meme si le module a la carte entrait un jour dans un pack', () => {
    const apres = modulesApresChangementDePack('starter', ['organisation', 'organisation'])
    expect(apres).toEqual([...new Set(apres)])
  })
})

describe('il ne reste qu UNE table de ce que contient un pack', () => {
  const superAdmin = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SuperAdmin.jsx'), 'utf8')

  test('PLAN_MODULES a disparu du Super Admin', () => {
    // C'etait une cinquieme copie, ecrite en dur, et elle avait DEJA
    // diverge : starter n'y contenait pas 'pointage', donc toucher au
    // pack d'un client Velor One lui retirait le pointage.
    expect(superAdmin).not.toMatch(/const PLAN_MODULES\s*=/)
  })

  test('le formulaire passe par la grille, pas par une liste locale', () => {
    expect(superAdmin).toMatch(/modulesApresChangementDePack\(plan, f\.modules_selectionnes\)/)
  })
})

// =====================================================================
// 2. LE SALARIE N ACCEDE PAS A SES PROPRES POSITIONS
// =====================================================================
describe('le salarie ne consulte pas ses positions dans l appli', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260919_0003_geolocalisation.sql'),
    'utf8',
  )

  function politique(nom) {
    const depart = sql.indexOf('create policy ' + nom)
    expect(depart).toBeGreaterThan(-1)
    return sql.slice(depart, sql.indexOf(');', depart))
  }

  test('la politique de lecture des releves n ouvre pas au salarie', () => {
    // Decision explicite : la consultation passe par l'employeur. Le
    // droit d'acces RGPD s'exerce par demande, pas par un ecran.
    //
    // On cherche la clause d'auto-acces, PAS toute mention de
    // auth.uid() : la politique en contient une legitime, celle qui
    // identifie le responsable pour comparer son departement a celui du
    // salarie. Un test qui confondrait les deux serait rouge a tort, et
    // on le desactiverait -- c'est comme ca qu'un garde-fou meurt.
    const p = politique('releves_position_select')
    expect(p).not.toMatch(/or\s+profile_id\s*=\s*auth\.uid\(\)/)
    expect(p).not.toMatch(/or\s+releves_position\.profile_id\s*=\s*auth\.uid\(\)/)
    // La clause du responsable, elle, doit toujours etre la.
    expect(p).toMatch(/ed_responsable\.profile_id\s*=\s*auth\.uid\(\)/)
  })

  test('mais il voit qu il EST suivi -- sa propre inscription', () => {
    // Savoir qu'on est geolocalise n'est pas une faveur : c'est la
    // condition pour que le dispositif soit opposable.
    expect(politique('geoloc_inscriptions_select')).toMatch(/profile_id\s*=\s*auth\.uid\(\)/)
  })

  test('et le module ne lui ouvre aucun onglet', () => {
    const { ongletsPourRole } = require('../modules/geolocalisation/index.jsx')
    expect(ongletsPourRole('employe')).toEqual([])
  })
})

// =====================================================================
// 3. LA CASE « SUIT SON POINTAGE » DOIT RESTER COCHABLE
// =====================================================================
describe('le mode se compare a ce qui est STOCKE, pas a l effectif', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'supabase', 'migrations',
      '20260919_0008_geoloc_mode_reellement_modifiable.sql'),
    'utf8',
  )

  test('inscrire_geolocalisation lit la valeur stockee', () => {
    // Comparer au mode EFFECTIF rendait le premier clic impossible :
    // pour quelqu'un sans choix enregistre, l'effectif valait deja
    // true, donc cocher « true » n'etait « pas un changement ». La case
    // revenait decochee indefiniment.
    const i = sql.indexOf('create function public.inscrire_geolocalisation')
    expect(i).toBeGreaterThan(-1)
    const corps = sql.slice(i, sql.indexOf('$$;', i))
    expect(corps).toMatch(/mode_geolocalisation_stocke\(p_profile_id\)/)
    expect(corps).not.toMatch(/mode_geolocalisation\(p_profile_id\)\s*;/)
  })

  test('la fonction du stocke ne fait AUCUN repli', () => {
    // C'est tout son interet : mode_geolocalisation() repond « ce qui
    // va s'appliquer », celle-ci « ce qu'on a decide ». Les confondre
    // est exactement ce qui a produit le bug.
    const i = sql.indexOf('create function public.mode_geolocalisation_stocke')
    const corps = sql.slice(i, sql.indexOf('$$;', i))
    expect(corps).not.toMatch(/geolocalisation_parametres/)
    expect(corps).not.toMatch(/coalesce/i)
  })

  test('l ecran lit le mode effectif depuis la base, sans le recalculer', () => {
    const ecran = fs.readFileSync(
      path.join(__dirname, '..', 'modules', 'geolocalisation',
        'components', 'InscriptionsGeo.jsx'),
      'utf8',
    )
    expect(ecran).toMatch(/getModes\(profile\)/)
    // Refaire la cascade des replis cote ecran, c'etait la seconde regle
    // a maintenir -- et c'est toujours celle qu'on oublie.
    expect(ecran).not.toMatch(/geolocalisation_parametres/)
  })
})
