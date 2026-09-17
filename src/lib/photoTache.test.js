import {
  cheminPhoto,
  nomFichierPhoto,
  fichierAcceptable,
  TAILLE_MAX_OCTETS,
  BUCKET_PHOTOS,
} from './photoTache'

const ENT = 'ent-1'
const TACHE = 'tache-9'

describe('cheminPhoto', () => {
  test("l'entreprise est TOUJOURS le premier dossier", () => {
    // Ce n'est pas du rangement : la regle d'acces du stockage compare ce
    // premier segment a l'entreprise de la personne connectee. Un chemin
    // qui ne commence pas par l'entreprise rend le fichier atteignable
    // par quelqu'un d'autre.
    const chemin = cheminPhoto(ENT, TACHE, 'photo-1.jpg')
    expect(chemin.split('/')[0]).toBe(ENT)
    expect(chemin).toBe('ent-1/tache-9/photo-1.jpg')
  })

  test('un element manquant ne produit jamais un chemin bancal', () => {
    // "undefined/tache/photo.jpg" serait accepte par le stockage et
    // rejete par la regle : autant ne rien produire du tout.
    expect(cheminPhoto(null, TACHE, 'p.jpg')).toBeNull()
    expect(cheminPhoto(ENT, null, 'p.jpg')).toBeNull()
    expect(cheminPhoto(ENT, TACHE, '')).toBeNull()
  })
})

describe('nomFichierPhoto', () => {
  test('deux photos de la meme tache ne s ecrasent pas', () => {
    expect(nomFichierPhoto(1000)).not.toBe(nomFichierPhoto(2000))
  })

  test('toujours en .jpg, puisqu on reencode', () => {
    expect(nomFichierPhoto(1000)).toMatch(/\.jpg$/)
  })
})

describe('fichierAcceptable', () => {
  const image = (type, taille) => ({ type, size: taille })

  test('accepte les formats photo courants', () => {
    expect(fichierAcceptable(image('image/jpeg', 500000)).ok).toBe(true)
    expect(fichierAcceptable(image('image/png', 500000)).ok).toBe(true)
    expect(fichierAcceptable(image('image/webp', 500000)).ok).toBe(true)
  })

  test('refuse un PDF, et dit pourquoi', () => {
    const verdict = fichierAcceptable(image('application/pdf', 1000))
    expect(verdict.ok).toBe(false)
    expect(verdict.motif).toMatch(/format/i)
  })

  test('laisse passer une photo de telephone : c est la compression qui la reduira', () => {
    // 4 Mo depasse la limite du bucket, mais sera compresse avant l'envoi.
    // Refuser ici obligerait l'utilisateur a redimensionner lui-meme.
    expect(fichierAcceptable(image('image/jpeg', 4 * 1024 * 1024)).ok).toBe(true)
  })

  test('refuse un fichier demesure', () => {
    const verdict = fichierAcceptable(image('image/jpeg', TAILLE_MAX_OCTETS * 11))
    expect(verdict.ok).toBe(false)
    expect(verdict.motif).toMatch(/lourde/i)
  })

  test('aucun fichier : un motif, pas un plantage', () => {
    expect(fichierAcceptable(null).ok).toBe(false)
    expect(fichierAcceptable(null).motif).toBeTruthy()
  })
})

describe('le bucket vise', () => {
  test('est bien l espace prive, pas l ancien bucket public', () => {
    expect(BUCKET_PHOTOS).toBe('taches-photos')
    expect(BUCKET_PHOTOS).not.toBe('photos')
  })
})
