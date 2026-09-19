// src/branding/config.test.js
// =====================================================================
// ON N'AFFICHE QUE DES ADRESSES QUI FONCTIONNENT.
//
// APP_URL a valu 'https://app.velorone.app' pendant des semaines, et
// SUPPORT_EMAIL 'support@velorone.app'. Aucun des deux domaines ne
// resolvait. Ce n'etait pas cosmetique : APP_URL est affiche sur la
// carte remise au client a la creation d'un compte, a cote de son mot
// de passe provisoire -- c'est la premiere chose sur laquelle un
// nouvel utilisateur clique.
//
// Ces tests ne peuvent pas interroger le DNS. Ils font l'autre moitie
// du travail : interdire nommement les adresses dont on SAIT qu'elles
// sont mortes, et verifier que le repli est celui qui marche.
// =====================================================================
const fs = require('fs')
const path = require('path')

// Les domaines achetes mais jamais branches. Si l'un d'eux revient dans
// le code, c'est qu'on a reintroduit le bug -- et pour le retirer de
// cette liste, il faudra qu'il resolve pour de vrai.
const DOMAINES_MORTS = ['app.velorone.app', 'velorone.app']

describe('les valeurs par defaut', () => {
  // Chargement isole : les variables d'environnement sont lues a
  // l'import, donc on remet le cache a zero entre les cas.
  function charger(env = {}) {
    jest.resetModules()
    const sauvegarde = { ...process.env }
    Object.keys(env).forEach((k) => { process.env[k] = env[k] })
    // eslint-disable-next-line global-require
    const mod = require('./config')
    process.env = sauvegarde
    return mod
  }

  test('sans variable, on retombe sur l adresse reellement en ligne', () => {
    const { APP_URL } = charger()
    expect(APP_URL).toBe('https://hoteldesk-pro.vercel.app')
  })

  test('sans variable, le support est une adresse qui recoit du courrier', () => {
    const { SUPPORT_EMAIL } = charger()
    expect(SUPPORT_EMAIL).toBe('velor.telecom@gmail.com')
  })

  test('une variable vide ne remplace pas le defaut par du vide', () => {
    // Le piege classique : REACT_APP_APP_URL declaree mais vide sur
    // Vercel. Sans le repli, la carte client afficherait une URL vide.
    const { APP_URL, SUPPORT_EMAIL } = charger({
      REACT_APP_APP_URL: '   ',
      REACT_APP_SUPPORT_EMAIL: '',
    })
    expect(APP_URL).toBe('https://hoteldesk-pro.vercel.app')
    expect(SUPPORT_EMAIL).toBe('velor.telecom@gmail.com')
  })

  test('une variable renseignee prend la main', () => {
    // C'est le chemin du jour ou le vrai domaine existera : une ligne
    // dans Vercel, aucun code a toucher.
    const { APP_URL, WEBSITE } = charger({ REACT_APP_APP_URL: 'https://app.exemple.fr' })
    expect(APP_URL).toBe('https://app.exemple.fr')
    // WEBSITE suit APP_URL tant qu'il n'a pas sa propre valeur.
    expect(WEBSITE).toBe('https://app.exemple.fr')
  })
})

describe('aucun domaine mort ne revient dans le code', () => {
  const RACINE = path.join(__dirname, '..')

  function fichiers(dossier, acc = []) {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach((e) => {
      const complet = path.join(dossier, e.name)
      if (e.isDirectory()) return fichiers(complet, acc)
      if (!/\.(js|jsx)$/.test(e.name)) return
      if (complet === __filename) return
      acc.push(complet)
      return acc
    })
    return acc
  }

  /**
   * Le code seul, sans les commentaires.
   *
   * Sans ca, le test se declencherait sur l'explication de ce bug ecrite
   * en tete de config.js -- et on se retrouverait a supprimer la trace
   * de l'incident pour faire passer le test qui le surveille.
   */
  function codeSeul(chemin) {
    return fs.readFileSync(chemin, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
  }

  test.each(DOMAINES_MORTS)('%s n apparait nulle part dans le code', (domaine) => {
    const coupables = fichiers(RACINE)
      .filter((f) => codeSeul(f).includes(domaine))
      .map((f) => path.relative(RACINE, f))
    expect(coupables).toEqual([])
  })
})

describe('la carte d identifiants montre bien cette adresse', () => {
  test('SuperAdmin.jsx affiche APP_URL, pas une URL ecrite en dur', () => {
    // Si quelqu'un recopiait l'adresse en dur dans l'ecran, corriger
    // config.js ne changerait plus rien -- et on ne le verrait qu'en
    // voyant un client se plaindre d'un lien mort.
    const ecran = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SuperAdmin.jsx'), 'utf8')
    expect(ecran).toMatch(/url: APP_URL/)
  })
})
