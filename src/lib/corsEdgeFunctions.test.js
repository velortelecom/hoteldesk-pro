// src/lib/corsEdgeFunctions.test.js
// =====================================================================
// Garde-fou : aucune Edge Function ne doit fabriquer son en-tete d'origine
// a partir de la valeur BRUTE d'ALLOWED_ORIGIN.
//
// Ce reglage contient une LISTE separee par des virgules (production +
// previews). Un navigateur n'accepte qu'UNE origine dans l'en-tete
// Access-Control-Allow-Origin. Lui renvoyer la liste entiere fait bloquer
// l'appel avant l'envoi : cote client, une erreur reseau, et une fonction
// jamais atteinte. C'est ce qui empechait de creer une entreprise pendant
// que la creation d'employe fonctionnait -- deux fonctions, deux facons de
// calculer cet en-tete.
//
// Le test relit les sources reelles plutot que de dupliquer une liste de
// fichiers : une fonction ajoutee demain avec le mauvais motif echouera
// ici, sans que personne ait pense a mettre ce test a jour.
// =====================================================================
const fs = require('fs')
const path = require('path')

const RACINE = path.join(__dirname, '..', '..', 'supabase', 'functions')

// Motifs interdits : l'en-tete construit directement depuis le reglage,
// sans passer par le choix d'une origine unique.
const MOTIFS_INTERDITS = [
  /['"]Access-Control-Allow-Origin['"]\s*:\s*Deno\.env\.get/,
  /['"]Access-Control-Allow-Origin['"]\s*:\s*ALLOWED_ORIGIN\b/,
]

function fichiersEdge() {
  if (!fs.existsSync(RACINE)) return []
  return fs.readdirSync(RACINE, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => path.join(RACINE, e.name, 'index.ts'))
    .filter(p => fs.existsSync(p))
}

describe('CORS des Edge Functions', () => {
  const fichiers = fichiersEdge()

  test('il y a bien des fonctions a verifier', () => {
    expect(fichiers.length).toBeGreaterThan(0)
  })

  fichiers.forEach((fichier) => {
    const nom = path.basename(path.dirname(fichier))
    const source = fs.readFileSync(fichier, 'utf8')

    // Les brouillons explicitement marques ne sont pas deployes.
    const brouillon = source.includes('DRAFT -- NON EXECUTE')

    const titre = brouillon
      ? nom + ' (brouillon, ignore)'
      : nom + ' : une seule origine, choisie selon la requete'

    test(titre, () => {
      if (brouillon) return
      MOTIFS_INTERDITS.forEach((motif) => {
        expect(source).not.toMatch(motif)
      })
    })
  })
})
