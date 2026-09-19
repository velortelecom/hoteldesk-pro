// src/modules/geolocalisation/carte.test.js
const {
  LIBELLES_ACTIONS, coordonneesLisibles, estActeDeTravail,
  grouperParPersonneEtJour, heureLocale, jourLocal, lienCarte, resumeReleves,
} = require('./carte')
const { ACTIONS_RELEVE } = require('./services')

function releve(profileId, quand, sur = {}) {
  return {
    id: profileId + quand,
    profile_id: profileId,
    action_type: ACTIONS_RELEVE.TACHE_TERMINEE,
    latitude: 43.7,
    longitude: 7.26,
    dans_le_rayon: true,
    releve_le: quand,
    ...sur,
  }
}

describe('un releve de connexion n est pas un acte de travail', () => {
  test('la distinction est faite', () => {
    // Les confondre donnerait une carte ou une consultation depuis le
    // parking ressemble a une intervention.
    expect(estActeDeTravail(releve('p1', '2026-09-19T09:00:00'))).toBe(true)
    expect(estActeDeTravail(releve('p1', '2026-09-19T09:00:00', { action_type: ACTIONS_RELEVE.CONNEXION }))).toBe(false)
    expect(estActeDeTravail(null)).toBe(false)
  })

  test('chaque action a un libelle lisible', () => {
    Object.values(ACTIONS_RELEVE).forEach((a) => {
      expect(LIBELLES_ACTIONS[a]).toBeTruthy()
    })
  })
})

describe('le jour est LOCAL, pas UTC', () => {
  test('un releve a 23h30 reste le meme jour', () => {
    // toISOString() sur un 19/09 23h30 en France donne le 19 a 21h30
    // UTC -- mais un 01/01 00h30 donnerait le 31/12. On groupe sur la
    // date que le responsable voit a l'ecran.
    expect(jourLocal(new Date(2026, 8, 19, 23, 30))).toBe('2026-09-19')
    expect(jourLocal(new Date(2027, 0, 1, 0, 30))).toBe('2027-01-01')
  })

  test('une date illisible ne devient pas un jour bidon', () => {
    expect(jourLocal('nawak')).toBeNull()
    expect(jourLocal(null)).toBeNull()
  })

  test('l heure est locale aussi', () => {
    expect(heureLocale(new Date(2026, 8, 19, 9, 5))).toBe('09:05')
    expect(heureLocale('nawak')).toBe('')
  })
})

describe('groupement par personne et par jour', () => {
  const noms = { p1: 'Alice Bertin', p2: 'Bob Carre' }
  const releves = [
    releve('p1', new Date(2026, 8, 19, 9, 0).toISOString()),
    releve('p1', new Date(2026, 8, 19, 14, 0).toISOString(), { dans_le_rayon: false }),
    releve('p1', new Date(2026, 8, 19, 8, 0).toISOString(), { action_type: ACTIONS_RELEVE.CONNEXION, dans_le_rayon: null }),
    releve('p1', new Date(2026, 8, 18, 10, 0).toISOString()),
    releve('p2', new Date(2026, 8, 19, 11, 0).toISOString()),
  ]
  const groupes = grouperParPersonneEtJour(releves, noms)

  test('les personnes sortent par ordre alphabetique', () => {
    expect(groupes.map((g) => g.nom)).toEqual(['Alice Bertin', 'Bob Carre'])
  })

  test('les jours sortent du plus recent au plus ancien', () => {
    expect(groupes[0].jours.map((j) => j.jour)).toEqual(['2026-09-19', '2026-09-18'])
  })

  test('mais DANS une journee, l ordre est chronologique', () => {
    // On lit une journee dans l'ordre ou elle s'est passee.
    const j = groupes[0].jours[0]
    expect(j.releves.map((r) => heureLocale(r.releve_le))).toEqual(['08:00', '09:00', '14:00'])
    expect(heureLocale(j.premier.releve_le)).toBe('08:00')
    expect(heureLocale(j.dernier.releve_le)).toBe('14:00')
  })

  test('actes de travail et connexions sont comptes a part', () => {
    const j = groupes[0].jours[0]
    expect(j.actes).toBe(2)
    expect(j.connexions).toBe(1)
  })

  test('« hors zone » ne compte QUE les false, jamais les null', () => {
    // dans_le_rayon vaut null quand aucun site n'etait fourni : ce
    // n'est pas « hors zone », c'est « on ne comparait a rien ».
    // Confondre les deux accuserait quelqu'un sur une absence de
    // donnee.
    const j = groupes[0].jours[0]
    expect(j.horsZone).toBe(1)
  })

  test('un profil sans nom connu garde son identifiant', () => {
    const g = grouperParPersonneEtJour([releve('inconnu', new Date().toISOString())], {})
    expect(g[0].nom).toBe('inconnu')
  })

  test('les donnees abimees sont ignorees, pas fatales', () => {
    expect(grouperParPersonneEtJour([null, {}, { profile_id: 'p', releve_le: 'nawak' }], {})).toEqual([])
    expect(grouperParPersonneEtJour()).toEqual([])
  })
})

describe('resume d ensemble', () => {
  test('compte les personnes distinctes, pas les releves', () => {
    const r = resumeReleves([
      releve('p1', new Date().toISOString()),
      releve('p1', new Date().toISOString()),
      releve('p2', new Date().toISOString(), { action_type: ACTIONS_RELEVE.CONNEXION }),
      releve('p2', new Date().toISOString(), { dans_le_rayon: false }),
    ])
    expect(r.total).toBe(4)
    expect(r.personnes).toBe(2)
    expect(r.actes).toBe(3)
    expect(r.connexions).toBe(1)
    expect(r.horsZone).toBe(1)
  })

  test('une liste vide ne casse rien', () => {
    expect(resumeReleves().total).toBe(0)
    expect(resumeReleves([]).personnes).toBe(0)
  })
})

describe('lien vers une carte', () => {
  test('rien ne part chez un tiers avant le clic', () => {
    // C'est tout l'interet d'un lien plutot qu'une carte integree :
    // aucune position de salarie ne transite pendant la simple
    // consultation de la liste.
    const lien = lienCarte(43.7, 7.26)
    expect(lien).toMatch(/^https:\/\/www\.openstreetmap\.org\//)
    expect(lien).toContain('43.7')
    expect(lien).toContain('7.26')
  })

  test('des coordonnees absentes ne donnent pas un lien casse', () => {
    expect(lienCarte(null, 7.26)).toBeNull()
    expect(lienCarte('nord', 'est')).toBeNull()
  })

  test('les coordonnees affichees restent lisibles', () => {
    expect(coordonneesLisibles(43.697123456, 7.270612345)).toBe('43.69712, 7.27061')
    expect(coordonneesLisibles(null, null)).toBe('—')
  })
})

describe('le piege du zero', () => {
  test('une coordonnee absente n est PAS le point (0, 0)', () => {
    // Number(null) vaut 0, et 0 est un nombre fini : sans garde-fou,
    // une position manquante s'affichait au large de l'Afrique avec
    // l'aplomb d'une vraie position.
    expect(lienCarte(null, null)).toBeNull()
    expect(lienCarte(undefined, undefined)).toBeNull()
    expect(lienCarte('', '')).toBeNull()
    expect(coordonneesLisibles(null, null)).toBe('—')
    expect(coordonneesLisibles(undefined, 7.26)).toBe('—')
    expect(coordonneesLisibles('', '')).toBe('—')
  })

  test('mais un VRAI zero reste un vrai zero', () => {
    // Le point (0, 0) existe. S'il est reellement releve, on l'affiche.
    expect(coordonneesLisibles(0, 0)).toBe('0.00000, 0.00000')
    expect(lienCarte(0, 0)).not.toBeNull()
  })
})

// =====================================================================
// LES ONGLETS DU MODULE
// =====================================================================
describe('qui voit quoi dans le module', () => {
  const { ONGLETS, ongletsPourRole, roleGeo } = require('./index.jsx')

  test('un salarie n a AUCUN onglet', () => {
    // Il n'a pas a consulter les positions de ses collegues, ni meme
    // savoir lesquels sont suivis. Ce qui le concerne lui est dit par
    // le bandeau, en permanence.
    expect(ongletsPourRole('employe')).toEqual([])
  })

  test('le responsable voit les releves, pas les inscriptions', () => {
    // Inscrire quelqu'un est une decision d'employeur.
    expect(ongletsPourRole('responsable').map(o => o.id)).toEqual(['releves'])
  })

  test('l admin voit les deux', () => {
    expect(ongletsPourRole('admin').map(o => o.id)).toEqual(['releves', 'inscriptions'])
  })

  test('le super admin passe par is_super_admin, pas par role', () => {
    // Le profil de Rayan porte role = 'employe' et is_super_admin =
    // true. En lisant la seule colonne role, il n'aurait aucun onglet
    // dans son propre module.
    expect(roleGeo({ role: 'employe', is_super_admin: true })).toBe('super_admin')
    expect(ongletsPourRole(roleGeo({ role: 'employe', is_super_admin: true })))
      .toHaveLength(ONGLETS.length)
  })

  test('is_super_admin doit valoir exactement true', () => {
    expect(roleGeo({ role: 'employe', is_super_admin: 'true' })).toBe('employe')
    expect(roleGeo({ role: 'employe', is_super_admin: 1 })).toBe('employe')
  })

  test('un role inconnu est traite en salarie', () => {
    expect(roleGeo({ role: 'directeur_general' })).toBe('employe')
    expect(roleGeo(null)).toBe('employe')
    expect(ongletsPourRole(roleGeo(null))).toEqual([])
  })

  test('chaque onglet declare qui y a droit', () => {
    ONGLETS.forEach(o => {
      expect(Array.isArray(o.roles)).toBe(true)
      expect(o.roles.length).toBeGreaterThan(0)
    })
  })
})

describe('le releve est branche sur les actions metier', () => {
  const fs = require('fs')
  const path = require('path')
  const taches = fs.readFileSync(path.join(__dirname, '..', '..', 'pages', 'Taches.jsx'), 'utf8')

  test('une tache TERMINEE declenche un releve', () => {
    expect(taches).toMatch(/statut === 'terminee'/)
    expect(taches).toMatch(/enregistrerReleve\(ACTIONS_RELEVE\.TACHE_TERMINEE/)
  })

  test('une photo aussi', () => {
    expect(taches).toMatch(/enregistrerReleve\(ACTIONS_RELEVE\.PHOTO/)
  })

  test('le releve n est jamais attendu', () => {
    // `await enregistrerReleve(...)` ferait patienter l'utilisateur
    // apres un GPS avant de voir sa tache changer d'etat.
    expect(taches).not.toMatch(/await enregistrerReleve/)
  })
})
