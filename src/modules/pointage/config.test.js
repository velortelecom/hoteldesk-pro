// src/modules/pointage/config.test.js
// =====================================================================
// QUI VOIT QUELS ONGLETS.
//
// Le vrai verrou est dans la base : pointages_select n'autorise un
// salarie a lire que ses propres pointages. Ces tests ne remplacent pas
// cette regle -- ils garantissent qu'on ne propose pas a quelqu'un des
// ecrans qui ne le concernent pas, et surtout qu'un onglet ajoute plus
// tard ne s'affiche pas pour tout le monde parce qu'on a oublie d'y
// penser.
// =====================================================================
const fs = require('fs')
const path = require('path')
const {
  MODULE_TABS, ROLES_ENCADREMENT, ROLES_TOUS,
  ongletParDefaut, ongletsPourRole, roleConnu, rolePointage,
} = require('./config')

const ids = (role) => ongletsPourRole(role).map((t) => t.id)

describe('declaration des onglets', () => {
  test('chaque onglet dit qui y a droit', () => {
    // Sans cette assertion, un onglet ajoute demain sans liste de roles
    // planterait a l'affichage (roles.includes sur undefined) ou, pire,
    // s'afficherait pour tout le monde selon l'ecriture retenue.
    MODULE_TABS.forEach((tab) => {
      expect(Array.isArray(tab.roles)).toBe(true)
      expect(tab.roles.length).toBeGreaterThan(0)
      tab.roles.forEach((r) => expect(ROLES_TOUS).toContain(r))
    })
  })

  test('tout role connu a au moins un onglet', () => {
    // Un role sans aucun onglet donnerait un ecran vide sans message.
    ROLES_TOUS.forEach((role) => {
      expect(ids(role).length).toBeGreaterThan(0)
    })
  })
})

describe('un salarie ne voit que le pointage', () => {
  test('exactement un onglet', () => {
    expect(ids('employe')).toEqual(['pointage'])
  })

  test('il arrive directement dessus', () => {
    expect(ongletParDefaut('employe')).toBe('pointage')
  })

  test.each(['dashboard', 'historique', 'corrections', 'paie', 'sites', 'parametres'])(
    'l onglet %s lui est ferme',
    (onglet) => {
      expect(ids('employe')).not.toContain(onglet)
    },
  )
})

describe('encadrement', () => {
  test.each(ROLES_ENCADREMENT)('%s voit tous les onglets', (role) => {
    expect(ids(role)).toEqual(MODULE_TABS.map((t) => t.id))
  })

  test('l encadrement arrive sur le tableau de bord', () => {
    ROLES_ENCADREMENT.forEach((role) => {
      expect(ongletParDefaut(role)).toBe('dashboard')
    })
  })
})

describe('le super admin passe par is_super_admin, pas par role', () => {
  test('un super admin garde tous les onglets meme avec role employe', () => {
    // C'est le cas reel : il entre dans une entreprise par le contexte
    // Super Admin, ou sa colonne role vaut ce qu'elle vaut. En lisant
    // seulement `role`, il se retrouverait avec un seul onglet.
    expect(rolePointage({ role: 'employe', is_super_admin: true })).toBe('super_admin')
    expect(ids(rolePointage({ role: 'employe', is_super_admin: true })))
      .toEqual(MODULE_TABS.map((t) => t.id))
  })

  test('sans is_super_admin, le role fait foi', () => {
    expect(rolePointage({ role: 'employe' })).toBe('employe')
    expect(rolePointage({ role: 'admin' })).toBe('admin')
  })

  test('is_super_admin doit valoir exactement true', () => {
    // Une chaine 'false' ou un 1 ne doivent pas ouvrir l'administration.
    expect(rolePointage({ role: 'employe', is_super_admin: 'false' })).toBe('employe')
    expect(rolePointage({ role: 'employe', is_super_admin: 1 })).toBe('employe')
  })
})

describe('roles douteux', () => {
  test('un role inconnu est traite en salarie, jamais en admin', () => {
    expect(roleConnu('directeur_general')).toBe('employe')
    expect(ids('directeur_general')).toEqual(['pointage'])
    expect(ids(undefined)).toEqual(['pointage'])
    expect(ids(null)).toEqual(['pointage'])
  })

  test('un profil absent ne donne aucun droit', () => {
    expect(rolePointage(null)).toBe('employe')
    expect(rolePointage(undefined)).toBe('employe')
    expect(rolePointage({})).toBe('employe')
  })
})

describe('l ecran ne peut pas afficher un onglet interdit', () => {
  const source = fs.readFileSync(path.join(__dirname, 'index.jsx'), 'utf8')

  test('la barre d onglets est construite depuis ongletsPourRole', () => {
    // Si elle repartait de MODULE_TABS, tout le monde verrait tout.
    expect(source).toMatch(/onglets\.map\(/)
    expect(source).not.toMatch(/MODULE_TABS\.map\(/)
  })

  test('l onglet actif est revalide contre les onglets autorises', () => {
    // Le point clef : activeTab n'est pas un useState libre. Un etat
    // reste d'un profil precedent, ou arrive avant le profil, ne peut
    // pas laisser un onglet interdit actif.
    expect(source).toMatch(/onglets\.some\(\(tab\) => tab\.id === ongletDemande\)/)
    expect(source).toMatch(/:\s*ongletParDefaut\(role\)/)
  })

  test('le role vient de rolePointage, pas de profile.role', () => {
    expect(source).toMatch(/const role = rolePointage\(profile\)/)
    expect(source).not.toMatch(/profile\?\.role \|\| 'employe'/)
  })
})
