// src/modules/squelette.test.js
// =====================================================================
// Un ecran vide ne doit jamais se presenter comme une fonctionnalite
// disponible.
//
// Le squelette affichait une pastille verte "MODULE ACTIF -- v0.1.0"
// au-dessus d'un encadre expliquant que le module n'existait pas encore.
// Les deux se contredisaient sur le meme ecran, et c'est la pastille que
// l'oeil attrape. Resultat : meme le fondateur croyait que les modules
// Facturation, CRM et Stocks etaient faits.
//
// Ce test lit le fichier source plutot que de rendre le composant : le
// projet n'a pas de bibliotheque de rendu, et l'affirmation qu'on
// surveille est textuelle.
// =====================================================================
const fs = require('fs')
const path = require('path')

const SQUELETTE = path.join(__dirname, '_squelette.jsx')

describe('ecran des modules non developpes', () => {
  const source = fs.readFileSync(SQUELETTE, 'utf8')

  // On ne regarde que ce qui est affiche, pas les commentaires qui
  // expliquent justement pourquoi cette formulation a ete retiree.
  const affiche = source
    .replace(/\/\*[\s\S]*?\*\//g, '')          // blocs /* */ et {/* */}
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))   // lignes //
    .join('\n')

  test('ne se declare pas actif', () => {
    expect(affiche).not.toMatch(/MODULE ACTIF/i)
    expect(affiche).not.toMatch(/est active dans votre abonnement/i)
  })

  test('dit clairement que ce n est pas disponible', () => {
    expect(affiche).toMatch(/pas encore disponible/i)
  })

  test('reste rassurant sur l abonnement', () => {
    // Le client paie : on lui dit que ce n'est pas perdu, sans pretendre
    // que la fonctionnalite existe.
    expect(affiche).toMatch(/incluse dans votre abonnement/i)
  })
})
