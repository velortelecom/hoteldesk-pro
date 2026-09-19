// src/lib/droitsExport.test.js
// =====================================================================
// UN SALARIE N'EXPORTE RIEN, QUELLE QUE SOIT L'OFFRE.
//
// Deux choses sont verifiees ici, et la seconde compte autant que la
// premiere :
//
//   1. la regle elle-meme, et son indifference totale a l'offre ;
//   2. qu'AUCUN point d'export de l'application ne l'ignore -- y
//      compris celui que quelqu'un ajoutera dans six mois sans avoir lu
//      ce fichier. Le test balaie src/ et refuse tout code qui declenche
//      un telechargement sans passer par peutExporter.
// =====================================================================
const fs = require('fs')
const path = require('path')
const { MESSAGE_EXPORT_REFUSE, ROLES_EXPORT, peutExporter } = require('./droitsExport')
const { OFFRES } = require('./offres')

describe('la regle', () => {
  test('un salarie ne peut pas exporter', () => {
    expect(peutExporter({ role: 'employe' })).toBe(false)
  })

  test('le responsable et l admin le peuvent', () => {
    expect(peutExporter({ role: 'responsable' })).toBe(true)
    expect(peutExporter({ role: 'admin' })).toBe(true)
    expect(ROLES_EXPORT).toEqual(['responsable', 'admin'])
  })

  test('le super admin passe par is_super_admin, meme avec role employe', () => {
    // Le cas reel : il entre dans une entreprise par le contexte Super
    // Admin, ou sa colonne role vaut celle de cette entreprise.
    expect(peutExporter({ role: 'employe', is_super_admin: true })).toBe(true)
  })

  test('is_super_admin doit valoir exactement true', () => {
    expect(peutExporter({ role: 'employe', is_super_admin: 'true' })).toBe(false)
    expect(peutExporter({ role: 'employe', is_super_admin: 1 })).toBe(false)
  })

  test('pas de profil, pas de droit', () => {
    expect(peutExporter(null)).toBe(false)
    expect(peutExporter(undefined)).toBe(false)
    expect(peutExporter({})).toBe(false)
  })

  test('un role inconnu n exporte pas', () => {
    // Le defaut d'un droit est de ne pas l'avoir.
    expect(peutExporter({ role: 'directeur_general' })).toBe(false)
    expect(peutExporter({ role: 'RESPONSABLE' })).toBe(false)
  })
})

describe('l offre ne change rien -- c est tout l objet de cette regle', () => {
  const offres = OFFRES.map((o) => o.id)

  test('toutes les offres existent bien dans le test', () => {
    // Si une offre est ajoutee, elle passe par la boucle ci-dessous.
    expect(offres.length).toBeGreaterThanOrEqual(5)
  })

  test.each(offres)('offre %s : un salarie n exporte toujours pas', (plan) => {
    expect(peutExporter({ role: 'employe', plan })).toBe(false)
    expect(peutExporter({ role: 'employe', plan, tarif_fondateur: true })).toBe(false)
    expect(peutExporter({ role: 'employe', plan, modules: ['pointage', 'gps'] })).toBe(false)
  })

  test.each(offres)('offre %s : un responsable exporte toujours', (plan) => {
    expect(peutExporter({ role: 'responsable', plan })).toBe(true)
  })

  test('un champ qui ressemble a un droit ne donne pas le droit', () => {
    // Le piege : un objet `permissions` fabrique ailleurs, colle sur le
    // profil, et qui deciderait a la place de la regle.
    expect(peutExporter({ role: 'employe', canExport: true })).toBe(false)
    expect(peutExporter({ role: 'employe', permissions: { canExport: true } })).toBe(false)
  })

  test('le message de refus dit quoi faire', () => {
    expect(MESSAGE_EXPORT_REFUSE).toMatch(/responsables/i)
  })
})

// ---------------------------------------------------------------------
// LE BALAYAGE
// ---------------------------------------------------------------------
const RACINE = __dirname.replace(/[/\\]lib$/, '')

function fichiersSources(dossier, acc = []) {
  fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
    const complet = path.join(dossier, entree.name)
    if (entree.isDirectory()) return fichiersSources(complet, acc)
    if (!/\.(js|jsx)$/.test(entree.name)) return
    if (/\.test\.(js|jsx)$/.test(entree.name)) return
    acc.push(complet)
    return acc
  })
  return acc
}

/**
 * Un fichier qui DECLENCHE un telechargement.
 *
 * createObjectURL seul ne suffit pas : Planning et Taches s'en servent
 * pour afficher l'apercu d'une photo, ce qui n'a rien d'un export. C'est
 * l'attribut download, ou l'appel a notre fabrique de classeur, qui fait
 * sortir un fichier de l'application.
 */
function declencheUnTelechargement(code) {
  if (/telechargerXlsx\s*\(/.test(code)) return true
  if (/createObjectURL/.test(code) && /\.download\s*=/.test(code)) return true
  return false
}

describe('aucun point d export n echappe a la regle', () => {
  // xlsx.js est la FABRIQUE du fichier, pas un point d'export : il ne
  // sait pas qui le demande, et c'est tres bien ainsi. Ce sont ses
  // appelants qui doivent decider.
  const FABRIQUES = ['xlsx.js', 'droitsExport.js']

  const points = fichiersSources(RACINE)
    .filter((f) => !FABRIQUES.includes(path.basename(f)))
    .filter((f) => declencheUnTelechargement(fs.readFileSync(f, 'utf8')))

  test('il y a bien des points d export a surveiller', () => {
    // Si ce test tombe a zero, c'est que le detecteur ne detecte plus
    // rien -- et le test suivant passerait alors pour de mauvaises
    // raisons, en silence.
    expect(points.length).toBeGreaterThan(0)
  })

  test.each(points.map((f) => path.relative(RACINE, f)))(
    '%s consulte peutExporter',
    (relatif) => {
      const code = fs.readFileSync(path.join(RACINE, relatif), 'utf8')
      expect(code).toMatch(/peutExporter/)
    },
  )

  test.each(points.map((f) => path.relative(RACINE, f)))(
    '%s refuse dans la fonction, pas seulement sur le bouton',
    (relatif) => {
      // Un bouton `disabled` s'enleve en trois secondes avec la console
      // du navigateur. Le refus doit etre une sortie anticipee dans le
      // code qui exporte.
      const code = fs.readFileSync(path.join(RACINE, relatif), 'utf8')
      expect(code).toMatch(/if\s*\(\s*!peutExporter\s*\([^)]*\)\s*\)\s*return/)
    },
  )
})
