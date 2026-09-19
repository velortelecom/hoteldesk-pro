// src/modules/pointage/permissions.test.js
// =====================================================================
// L'EXPORT DES HEURES NE DESCEND PAS JUSQU'AU SALARIE.
//
// Decision prise, pas oubli : s'il veut son releve par ecrit, il le
// demande a son responsable, qui l'exporte et le lui envoie. Une piece
// qui sert de preuve d'heures sort par une personne identifiee.
//
// Ce fichier existe parce que c'est exactement le genre de regle qu'on
// « ameliore » six mois plus tard en ajoutant un bouton pour rendre
// service, sans savoir qu'elle avait ete decidee.
// =====================================================================
const fs = require('fs')
const path = require('path')
const { ROLE_POINTAGE_PERMISSIONS, canAccessPointage, getPermissionsForRole } = require('./permissions')

describe('qui exporte les heures', () => {
  test('le salarie, non', () => {
    expect(getPermissionsForRole('employe').canExport).toBe(false)
    expect(canAccessPointage('employe', 'canExport')).toBe(false)
  })

  test('le responsable, l admin et le super admin, oui', () => {
    expect(getPermissionsForRole('responsable').canExport).toBe(true)
    expect(getPermissionsForRole('admin').canExport).toBe(true)
    expect(getPermissionsForRole('super_admin').canExport).toBe(true)
  })

  test('un role inconnu est traite en salarie', () => {
    // Le defaut d'un droit est de ne pas l'avoir.
    expect(getPermissionsForRole('directeur_general').canExport).toBe(false)
    expect(getPermissionsForRole(undefined).canExport).toBe(false)
  })
})

describe('personne ne corrige ses propres heures', () => {
  test('le salarie ne peut ni modifier ni supprimer', () => {
    // La base dit la meme chose : la politique pointages_update exclut
    // le salarie, et aucune politique DELETE n'existe. Une feuille
    // d'heures que l'interesse peut reecrire ne prouve rien.
    const employe = getPermissionsForRole('employe')
    expect(employe.canEdit).toBe(false)
    expect(employe.canDelete).toBe(false)
  })

  test('mais il peut pointer et consulter', () => {
    const employe = getPermissionsForRole('employe')
    expect(employe.canView).toBe(true)
    expect(employe.canCreate).toBe(true)
  })

  test('seul l admin supprime', () => {
    expect(getPermissionsForRole('responsable').canDelete).toBe(false)
    expect(getPermissionsForRole('admin').canDelete).toBe(true)
  })
})

describe('chaque role declare tous ses droits', () => {
  const droits = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canManageSettings', 'canExport']

  test.each(Object.keys(ROLE_POINTAGE_PERMISSIONS))('%s', (role) => {
    // Un droit oublie vaut undefined, donc faux par accident plutot que
    // par decision -- et personne ne sait lequel des deux c'etait.
    droits.forEach((droit) => {
      expect(typeof ROLE_POINTAGE_PERMISSIONS[role][droit]).toBe('boolean')
    })
  })
})

describe('l ecran Mes heures n exporte rien', () => {
  const source = fs.readFileSync(path.join(__dirname, 'components', 'MesHeures.jsx'), 'utf8')

  test('aucun bouton de telechargement ne s y est glisse', () => {
    expect(source).not.toMatch(/telechargerXlsx|construireXlsx|construireLignesPaie/)
    expect(source).not.toMatch(/download/i)
  })

  test('l ecran dit ou s adresser', () => {
    // Un bouton absent sans explication laisse croire que ca ne se fait
    // pas ; la personne cherche, ne trouve rien, et n'ose pas demander.
    expect(source).toMatch(/Demandez-le a votre responsable/)
  })
})
