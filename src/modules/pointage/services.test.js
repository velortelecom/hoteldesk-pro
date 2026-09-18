import { formatStatut } from './services'

describe('Pointage formatting', () => {
  it('maps database statuses to user-facing french labels', () => {
    expect(formatStatut('accepte')).toBe('Validé')
    expect(formatStatut('en_attente_correction')).toBe('À vérifier')
    expect(formatStatut('refuse')).toBe('Refusé')
  })
})

// =====================================================================
// GARDE-FOUS CONTRE LE RETOUR DES CHIFFRES INVENTES
//
// Ce module a affiche pendant des semaines deux choses fausses avec
// aplomb : un temps de travail calcule comme « nombre de presents x 8h »,
// et un ecran de corrections rempli de trois phrases ecrites en dur.
// Aucune des deux ne se voyait a l'ecran -- c'est bien le probleme.
//
// Ces tests relisent les fichiers reels. Ils tombent si quelqu'un
// reintroduit une estimation a la place d'une mesure.
// =====================================================================
const fs = require('fs')
const path = require('path')

const lire = (...bouts) => fs.readFileSync(path.join(__dirname, ...bouts), 'utf8')

/**
 * Le CODE, sans les commentaires.
 *
 * Ces fichiers expliquent en tete ce qui etait faux, en citant l'ancien
 * code -- « presentProfiles.size * 8 * 60 », « Sophie Martin ». Un
 * garde-fou qui lirait le fichier entier tomberait sur sa propre
 * documentation. Il doit verifier ce qui s'execute, pas ce qui se lit.
 */
const codeSeul = (...bouts) => lire(...bouts)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n')
  .filter(ligne => !/^\s*(\/\/|\*)/.test(ligne))
  .join('\n')

describe('aucun temps de travail invente', () => {
  const services = codeSeul('services.js')

  test('le forfait de 8 heures par present a disparu', () => {
    // presentProfiles.size * 8 * 60 : une hypothese presentee comme une
    // mesure. Devant un prud'homme, ce chiffre ne prouve rien.
    expect(services).not.toMatch(/presentProfiles/)
    expect(services).not.toMatch(/\*\s*8\s*\*\s*60/)
  })

  test('le temps vient de journees.js, pas d un calcul local', () => {
    expect(services).toMatch(/from '\.\/journees\.js'/)
    expect(services).toMatch(/construireJournees\(/)
    expect(services).toMatch(/totalMinutes\(/)
  })

  test('il n existe qu un seul formateur de duree dans le module', () => {
    // Deux formateurs, c'est deux formats a l'ecran et, tot ou tard,
    // deux facons d'arrondir.
    expect(services).not.toMatch(/function formatMinutes/)
  })

  test('une lecture en echec ne se transforme pas en liste vide', () => {
    // Un historique vide se lit « personne n'a pointe ». C'est un
    // mensonge quand la requete a simplement echoue.
    expect(services).toMatch(/throw new Error\(error\.message \|\| 'Historique illisible\.'\)/)
    expect(services).toMatch(/throw new Error\(echec\.message \|\| 'Tableau de bord illisible\.'\)/)
  })
})

describe('l ecran de corrections ne raconte plus d histoires', () => {
  const corrections = codeSeul('components', 'CorrectionsPointage.jsx')

  test('les fausses corrections ont disparu', () => {
    expect(corrections).not.toMatch(/Sophie Martin/)
    expect(corrections).not.toMatch(/Residence Le Parc|Résidence Le Parc/)
  })

  test('il affiche les journees recues, sans en fabriquer', () => {
    expect(corrections).toMatch(/journees = \[\]/)
    expect(corrections).toMatch(/anomalies\.length > 0/)
  })

  test('il sait dire qu il n a rien a montrer', () => {
    // Un ecran vide sans phrase laisse croire a un bug d'affichage.
    expect(corrections).toMatch(/Aucune journee a corriger/)
  })
})

describe('l ecran de corrections est atteignable', () => {
  test('un onglet y mene', () => {
    // Il existait, mais ne s'affichait que si l'onglet actif n'etait
    // aucun des cinq -- ce qui n'arrivait jamais. Personne ne l'a jamais
    // vu, ni ses fausses donnees, ni les vraies anomalies.
    expect(codeSeul('config.js')).toMatch(/id: 'corrections'/)
    expect(codeSeul('index.jsx')).toMatch(/activeTab === 'corrections'/)
  })
})
