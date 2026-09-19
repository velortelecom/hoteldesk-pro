// src/modules/geolocalisation/hooks.test.js
// =====================================================================
// LE PIEGE QUE CE FICHIER EVITE
//
// React remonte un composant a chaque changement d'etat. Sans
// precaution, « relever a la connexion » devient « relever a chaque
// fois que React en a envie » : des dizaines de positions pour une
// seule ouverture de l'application, toutes au meme endroit, et une
// duree de conservation qui devient ridicule a defendre.
// =====================================================================
const { connexionDejaRelevee, marquerConnexionRelevee } = require('./hooks')

function stockageFactice() {
  const donnees = new Map()
  return {
    getItem: (k) => (donnees.has(k) ? donnees.get(k) : null),
    setItem: (k, v) => donnees.set(k, String(v)),
  }
}
function stockageQuiExplose() {
  return {
    getItem: () => { throw new Error('acces refuse') },
    setItem: () => { throw new Error('acces refuse') },
  }
}

describe('un seul releve de connexion par session', () => {
  test('la premiere fois, rien n est marque', () => {
    expect(connexionDejaRelevee('p1', stockageFactice())).toBe(false)
  })

  test('apres la marque, on ne releve plus', () => {
    const s = stockageFactice()
    marquerConnexionRelevee('p1', s)
    expect(connexionDejaRelevee('p1', s)).toBe(true)
  })

  test('un AUTRE utilisateur dans le meme onglet releve bien', () => {
    // Deconnexion puis reconnexion avec un autre compte : la marque du
    // precedent ne doit pas faire sauter le releve du suivant.
    const s = stockageFactice()
    marquerConnexionRelevee('p1', s)
    expect(connexionDejaRelevee('p2', s)).toBe(false)
  })
})

describe('stockage indisponible', () => {
  test('on considere le releve comme deja fait, plutot que de boucler', () => {
    // Navigation privee, stockage bloque par une politique
    // d'entreprise : sans ce choix, chaque rendu relancerait une
    // demande de position, avec la fenetre du navigateur a chaque fois.
    expect(connexionDejaRelevee('p1', stockageQuiExplose())).toBe(true)
  })

  test('marquer ne fait pas tomber l application', () => {
    expect(() => marquerConnexionRelevee('p1', stockageQuiExplose())).not.toThrow()
  })
})

describe('le bandeau ne s affiche pas a tort', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, 'components', 'BandeauGeolocalisation.jsx'), 'utf8',
  )

  test('rien tant que l etat n est pas connu', () => {
    // Faire clignoter un bandeau de surveillance au chargement de
    // chaque page serait pire que de ne rien dire.
    expect(source).toMatch(/if \(!charge \|\| !inscrit\) return null/)
  })

  test('il annonce les quatre choses qui comptent', () => {
    expect(source).toMatch(/Quand/)
    expect(source).toMatch(/Quoi/)
    expect(source).toMatch(/Combien de temps/)
    expect(source).toMatch(/Qui y accède/)
  })

  test('la duree annoncee est celle de la base', () => {
    // 365 jours est ecrit dans duree_conservation_position_jours().
    // Un bandeau qui annonce une autre duree engage l'employeur sur
    // celle qu'il annonce, pas sur celle qu'il applique.
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'supabase', 'migrations',
        '20260919_0004_geoloc_connexion_et_purge.sql'), 'utf8',
    )
    const trouve = sql.match(/duree_conservation_position_jours\(\)[\s\S]{0,200}?select\s+(\d+)\s*;/)
    expect(trouve).not.toBeNull()
    expect(source).toMatch(new RegExp('CONSERVATION_JOURS = ' + trouve[1]))
  })

  test('il dit qu aucun suivi continu n est possible', () => {
    // C'est vrai, c'est rassurant, et c'est la premiere question que
    // pose un salarie.
    expect(source).toMatch(/Aucun suivi continu/)
  })
})

describe('le releve de connexion est branche dans l application', () => {
  const fs = require('fs')
  const path = require('path')
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'App.jsx'), 'utf8')

  test('le hook est appele avec le profil', () => {
    expect(app).toMatch(/useGeolocalisation\(profile\)/)
  })

  test('le bandeau est rendu au-dessus de l en-tete', () => {
    const iBandeau = app.indexOf('<BandeauGeolocalisation')
    const iHeader = app.indexOf('<header')
    expect(iBandeau).toBeGreaterThan(-1)
    expect(iBandeau).toBeLessThan(iHeader)
  })
})
