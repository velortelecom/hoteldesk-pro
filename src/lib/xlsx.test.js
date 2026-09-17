// src/lib/xlsx.test.js
// =====================================================================
// On ecrit un .xlsx a la main (ZIP + XML) plutot que d'embarquer un
// megaoctet de bibliotheque. Ecrire un format binaire a la main sans le
// tester, c'est livrer un fichier qu'Excel refusera d'ouvrir chez le
// client et pas chez nous.
//
// Ces tests verifient la structure du ZIP, le CRC de chaque entree, et
// que les nombres restent des nombres. Le fichier produit a aussi ete
// relu avec openpyxl -- meme conclusion.
// =====================================================================
const zlib = require('zlib')
const { construireXlsx } = require('./xlsx')

const LIGNES = [
  ['Entreprise', 'Utilisateurs', 'Total'],
  ['Fondateur & Fils <SARL>', 12, 33],
  ['Sur devis', 31, ''],
]

/** Relit les entrees d'un ZIP « stored » et verifie leur CRC. */
function lireZip(octets) {
  const buf = Buffer.from(octets)
  const entrees = {}
  let i = 0

  while (i + 4 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const crcAttendu = buf.readUInt32LE(i + 14)
    const taille = buf.readUInt32LE(i + 18)
    const lgNom = buf.readUInt16LE(i + 26)
    const lgExtra = buf.readUInt16LE(i + 28)
    const nom = buf.slice(i + 30, i + 30 + lgNom).toString('utf8')
    const debut = i + 30 + lgNom + lgExtra
    const donnees = buf.slice(debut, debut + taille)

    entrees[nom] = {
      texte: donnees.toString('utf8'),
      crcOk: zlib.crc32
        ? zlib.crc32(donnees) === crcAttendu
        : crc32Local(donnees) === crcAttendu,
    }
    i = debut + taille
  }

  return { entrees, finTrouvee: buf.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) > 0 }
}

// Implementation independante de celle testee : si les deux tombent
// d'accord, l'erreur n'est pas dans la table.
function crc32Local(b) {
  let c = -1
  for (let n = 0; n < b.length; n++) {
    c ^= b[n]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1
  }
  return (c ^ -1) >>> 0
}

describe('ecriture xlsx', () => {
  const fichier = construireXlsx('Facturation', LIGNES, { largeurs: [28, 12, 12] })
  const { entrees, finTrouvee } = lireZip(fichier)

  test('le fichier est un ZIP complet', () => {
    expect(Buffer.from(fichier).slice(0, 2).toString()).toBe('PK')
    expect(finTrouvee).toBe(true)
  })

  test('les six parties obligatoires sont presentes', () => {
    // Il en manque une seule et Excel annonce un fichier corrompu.
    expect(Object.keys(entrees).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
  })

  test('[Content_Types].xml est la premiere entree', () => {
    // Exige par la specification OPC : une autre entree en tete et
    // certains lecteurs refusent l'archive.
    expect(Object.keys(entrees)[0]).toBe('[Content_Types].xml')
  })

  test('chaque entree porte un CRC correct', () => {
    Object.keys(entrees).forEach(nom => {
      expect(entrees[nom].crcOk).toBe(true)
    })
  })

  test('les nombres sont ecrits en nombres, les textes en chaines', () => {
    const feuille = entrees['xl/worksheets/sheet1.xml'].texte
    // Pas d'attribut s= hors entete : une cellule sans style prend le
    // style 0 par defaut, et l'omettre allege le fichier.
    expect(feuille).toContain('<c r="B2"><v>12</v></c>')
    expect(feuille).toContain('<c r="C2"><v>33</v></c>')
    expect(feuille).toContain('t="inlineStr"')
  })

  test('une cellule vide n est pas ecrite du tout', () => {
    // Une chaine vide donnerait une cellule texte ; Excel afficherait un
    // 0 la ou le montant est « a etablir ».
    expect(entrees['xl/worksheets/sheet1.xml'].texte).not.toContain('r="C3"')
  })

  test('l entete est en gras et le reste ne l est pas', () => {
    const feuille = entrees['xl/worksheets/sheet1.xml'].texte
    expect(feuille).toContain('<c r="A1" s="1"')
    expect(feuille).toContain('<c r="A2" t="inlineStr"')
    expect(feuille).not.toContain('<c r="A2" s="1"')
  })

  test('les caracteres XML dangereux sont echappes', () => {
    // Un nom d'entreprise contenant & ou < casserait le XML et Excel
    // refuserait le fichier entier.
    const feuille = entrees['xl/worksheets/sheet1.xml'].texte
    expect(feuille).toContain('Fondateur &amp; Fils &lt;SARL&gt;')
    expect(feuille).not.toContain('Fils <SARL>')
  })

  test('les caracteres de controle sont retires', () => {
    const f = construireXlsx('F', [['ab']])
    const { entrees: e } = lireZip(f)
    expect(e['xl/worksheets/sheet1.xml'].texte).toContain('>ab<')
  })

  test('les references de colonnes passent Z sans se tromper', () => {
    const large = construireXlsx('F', [Array.from({ length: 28 }, (_, i) => i + 1)])
    const feuille = lireZip(large).entrees['xl/worksheets/sheet1.xml'].texte
    expect(feuille).toContain('r="Z1"')
    expect(feuille).toContain('r="AA1"')
    expect(feuille).toContain('r="AB1"')
  })

  test('le nom d onglet est tronque a 31 caracteres', () => {
    // Au-dela, Excel refuse d'ouvrir le classeur.
    const f = construireXlsx('un nom d onglet vraiment beaucoup trop long', [['x']])
    const wb = lireZip(f).entrees['xl/workbook.xml'].texte
    const nom = wb.match(/name="([^"]*)"/)[1]
    expect(nom.length).toBeLessThanOrEqual(31)
  })

  test('les largeurs de colonnes sont posees', () => {
    expect(entrees['xl/worksheets/sheet1.xml'].texte).toContain('width="28"')
  })

  test('un classeur vide reste un fichier valide', () => {
    const f = construireXlsx('Vide', [])
    expect(Buffer.from(f).slice(0, 2).toString()).toBe('PK')
    expect(lireZip(f).entrees['xl/worksheets/sheet1.xml'].texte).toContain('<sheetData></sheetData>')
  })
})
