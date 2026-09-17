// src/lib/photoTache.js
// =====================================================================
// Joindre une photo a une tache.
//
// LE CHEMIN PORTE L'ISOLATION
//   <entreprise_id>/<tache_id>/<nom>
//   Le premier dossier est ce que la regle d'acces du stockage verifie.
//   Se tromper de chemin, ce n'est pas mal ranger un fichier : c'est le
//   rendre atteignable par une autre entreprise. D'ou une fonction unique
//   qui le fabrique, plutot qu'une concatenation recopiee a chaque appel.
//
// ON COMPRESSE AVANT D'ENVOYER
//   Une photo de telephone pese 3 a 5 Mo. Reduite a 1200 pixels et
//   reencodee, elle tombe vers 200 Ko -- vingt fois moins. C'est ce qui
//   fait tenir dix clients pendant deux ans dans le gigaoctet gratuit, et
//   ce qui rend l'envoi supportable depuis le telephone d'une femme de
//   chambre, en 4G, dans un couloir.
// =====================================================================

export const BUCKET_PHOTOS = 'taches-photos'

// 2 Mo : la limite posee sur le bucket. On refuse AVANT l'envoi pour ne pas
// faire patienter quelqu'un devant un televersement condamne.
export const TAILLE_MAX_OCTETS = 2 * 1024 * 1024
export const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp']

export function cheminPhoto(entrepriseId, tacheId, nom) {
  if (!entrepriseId || !tacheId || !nom) return null
  return entrepriseId + '/' + tacheId + '/' + nom
}

export function nomFichierPhoto(maintenant = Date.now()) {
  return 'photo-' + maintenant + '.jpg'
}

// Rend { ok: true } ou { ok: false, motif: '...' } -- jamais un simple
// booleen : l'ecran doit pouvoir dire POURQUOI il refuse.
export function fichierAcceptable(fichier) {
  if (!fichier) return { ok: false, motif: 'Aucun fichier choisi.' }

  if (TYPES_ACCEPTES.indexOf(fichier.type) === -1) {
    return { ok: false, motif: 'Format non accepte. Utilisez une photo JPEG, PNG ou WEBP.' }
  }

  // La compression ramene presque tout sous la limite, mais un fichier
  // enorme ferait ramer le navigateur avant meme d'etre reduit.
  if (fichier.size > TAILLE_MAX_OCTETS * 10) {
    return { ok: false, motif: 'Photo trop lourde. Prenez-la depuis l application photo plutot qu un scan.' }
  }

  return { ok: true }
}

// Reduit et reencode en JPEG. Si le navigateur ne sait pas faire -- vieux
// appareil, canvas indisponible -- on rend le fichier d'origine plutot que
// d'echouer : mieux vaut une photo lourde que pas de photo.
export function compresserImage(fichier, options = {}) {
  const cote = options.cote || 1200
  const qualite = options.qualite || 0.7

  return new Promise((resolve) => {
    try {
      const lecteur = new FileReader()
      lecteur.onerror = () => resolve(fichier)
      lecteur.onload = () => {
        const image = new Image()
        image.onerror = () => resolve(fichier)
        image.onload = () => {
          try {
            const ratio = Math.min(1, cote / Math.max(image.width, image.height))
            const largeur = Math.round(image.width * ratio)
            const hauteur = Math.round(image.height * ratio)

            const toile = document.createElement('canvas')
            toile.width = largeur
            toile.height = hauteur
            toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur)

            toile.toBlob(
              (blob) => resolve(blob || fichier),
              'image/jpeg',
              qualite,
            )
          } catch (e) {
            resolve(fichier)
          }
        }
        image.src = lecteur.result
      }
      lecteur.readAsDataURL(fichier)
    } catch (e) {
      resolve(fichier)
    }
  })
}
