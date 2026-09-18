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

// =====================================================================
// POINTAGE ET GEOLOCALISATION : DEUX CHOSES DISTINCTES
//
// Compter le temps de travail et savoir ou se trouve un technicien sont
// deux finalites differentes. La CNIL interdit d'ailleurs de calculer le
// temps de travail a partir de la geolocalisation quand un autre moyen
// existe. Le code les melangeait, et le resultat etait qu'on ne pouvait
// pointer ni d'une facon ni de l'autre.
// =====================================================================
describe('le pointage d heures ne transporte aucune position', () => {
  const services = codeSeul('services.js')
  const ecran = codeSeul('components', 'PointageEmploye.jsx')

  test('la methode est un parametre, plus une constante', () => {
    // Tout partait en 'gps', y compris le pointage d'une receptionniste.
    expect(services).toMatch(/methode = METHODES\.NAVIGATEUR/)
    expect(services).not.toMatch(/methode: 'gps'/)
  })

  test('une methode navigateur force les coordonnees a null', () => {
    // Pas « on oublie de les mettre » : on les retire explicitement, pour
    // qu'un appelant distrait ne transforme pas le module d'heures en
    // module de localisation.
    expect(services).toMatch(/const sansPosition = methode === METHODES\.NAVIGATEUR/)
    expect(services).toMatch(/latitude: sansPosition \? null : latitude/)
  })

  test('l ecran employe pointe sans position', () => {
    expect(ecran).toMatch(/methode: METHODES\.NAVIGATEUR/)
  })

  test('le selecteur de site decoratif a ete retire', () => {
    // Le site enregistre vient de profiles.site_id : choisir « Site B »
    // et lire « Site A » dans l'historique est pire que ne pas choisir.
    expect(ecran).not.toMatch(/setSelectedSiteId\(event\.target\.value\)/)
  })
})

describe('les refus sont traduits', () => {
  const { messageRefus } = require('./services')

  test('un code technique devient une phrase utilisable', () => {
    // L'ecran affichait « Le pointage a ete refuse : gps_manquant ». Ni
    // l'employe ni son responsable ne savent quoi en faire.
    expect(messageRefus({ error: 'module_inactive' })).toMatch(/module Pointage n'est pas actif/)
    expect(messageRefus({ motif_refus: 'hors_zone' })).toMatch(/en dehors de la zone/)
    expect(messageRefus({ motif_refus: 'site_non_configure' })).toMatch(/coordonnees/)
  })

  test('un code inconnu reste visible plutot que d etre masque', () => {
    // Un message generique sans code rendrait le diagnostic impossible.
    expect(messageRefus({ error: 'quelque_chose_de_neuf' })).toContain('quelque_chose_de_neuf')
  })

  test('l absence de code ne produit pas un message vide', () => {
    expect(messageRefus({})).toMatch(/n'a pas pu etre enregistre/)
    expect(messageRefus(null)).toMatch(/n'a pas pu etre enregistre/)
  })
})

describe('la fonction serveur', () => {
  const edge = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'functions', 'create-pointage', 'index.ts'),
    'utf8',
  )

  test('le droit de pointer depend du module pointage, pas du module gps', () => {
    // C'est ce qui bloquait TOUT : la verification portait sur le module
    // 'gps', qui n'est vendu dans aucune offre. Chaque pointage recevait
    // 403 module_inactive avant meme toute logique de position.
    expect(edge).toMatch(/\.eq\("module_id", "pointage"\)/)
    expect(edge).not.toMatch(/\.eq\("module_id", "gps"\)/)
  })

  test('la methode navigateur est enregistree et acceptee sans position', () => {
    expect(edge).toMatch(/navigateur: \{ valider: validerNavigateur \}/)
    expect(edge).toMatch(/function validerNavigateur/)
  })

  test('une position envoyee sur un pointage d heures est refusee, pas ignoree', () => {
    expect(edge).toMatch(/motif_refus: "position_non_attendue"/)
  })

  test('la methode par defaut est le pointage sans position', () => {
    expect(edge).toMatch(/\?\? "navigateur"\)\.trim\(\)/)
    expect(edge).toMatch(/methodes_actives: \{ navigateur: true, gps: false \}/)
  })

  test('manuel n est pas expose : une regularisation passe par une correction', () => {
    // L'exposer ici laisserait un salarie declarer l'heure de son choix.
    expect(edge).not.toMatch(/manuel: \{ valider/)
  })
})

describe('la migration accompagne le code', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260918_0002_pointage_heures_sans_gps.sql'),
    'utf8',
  )

  test('les trois methodes sont autorisees en base', () => {
    expect(sql).toMatch(/check \(methode = any \(array\['gps'::text, 'navigateur'::text, 'manuel'::text\]\)\)/)
  })

  test('methodes_actives autorise navigateur, sinon rien ne change a l ecran', () => {
    // La contrainte elargie ne suffit pas : create-pointage refuse toute
    // methode absente de methodes_actives. Sans cette mise a jour, la
    // migration serait passee sans rien debloquer.
    expect(sql).toMatch(/methodes_actives \|\| '\{"navigateur": true\}'::jsonb/)
  })

  test('la policy UPDATE existe, sinon aucune correction n est enregistrable', () => {
    // Sans elle, PostgREST renvoie zero ligne SANS erreur : l'ecran
    // afficherait un succes imaginaire.
    expect(sql).toMatch(/create policy pointages_update on public\.pointages/)
    expect(sql).toMatch(/with check \(/)
  })

  test('aucune policy DELETE : un pointage ne s efface pas', () => {
    expect(sql).not.toMatch(/for delete/i)
  })
})

describe('les parametres affichent la base, pas une invention', () => {
  const services = codeSeul('services.js')
  const ecran = codeSeul('components', 'ParametresPointage.jsx')
  const config = codeSeul('config.js')

  test('les quatre reglages inventes ont disparu', () => {
    // toleranceRetardMinutes lisait precision_gps_max_metres : l'ecran
    // affichait « tolerance de retard : 50 minutes » pour une precision
    // GPS de 50 METRES. Quatre valeurs lues, quatre mensonges.
    ;['toleranceRetardMinutes', 'heuresParJour', 'autoriserPointageMobile', 'notificationRetards']
      .forEach(invente => {
        expect(services).not.toContain(invente)
        expect(ecran).not.toContain(invente)
        expect(config).not.toContain(invente)
      })
  })

  test('l ecran dit quand l entreprise n a jamais ete parametree', () => {
    // Afficher les valeurs par defaut sans le dire, c'est presenter des
    // reglages que personne n'a choisis comme des decisions.
    expect(ecran).toMatch(/settings\.parametree/)
  })
})

describe('le pointage se pilote par l etat reel de la journee', () => {
  const ecran = codeSeul('components', 'PointageEmploye.jsx')
  const services = codeSeul('services.js')

  test('l ecran lit l etat au lieu de le supposer', () => {
    // L'etat vivait dans un useState initialise a « arrivee » : apres un
    // rechargement, quelqu'un deja pointe se voyait proposer une seconde
    // arrivee, refusee ensuite sans explication.
    expect(ecran).not.toMatch(/useState\('arrivee'\)/)
    expect(ecran).toMatch(/etatJour/)
    expect(services).toMatch(/export async function getEtatJour/)
  })

  test('les quatre actions sont atteignables', () => {
    expect(ecran).toMatch(/actionsAutorisees/)
    expect(ecran).toMatch(/LIBELLES_ACTIONS\[action\]/)
  })

  test('l ecran se recharge apres chaque pointage, meme refuse', () => {
    // Sinon il continue d'afficher ce qu'il croyait, pas ce que la base
    // sait.
    expect(ecran).toMatch(/finally \{[\s\S]{0,200}onPointage/)
  })
})

describe('le temoin reseau', () => {
  const services = codeSeul('services.js')

  test('la provenance est calculee et remontee a l ecran', () => {
    expect(services).toMatch(/reseauDeReference\(evenements\)/)
    expect(services).toMatch(/marquerProvenance\(/)
    expect(services).toMatch(/provenanceLisible/)
  })

  test('aucun reglage manuel du reseau n est demande', () => {
    // Un reglage qu'il faut penser a faire est un reglage jamais fait.
    expect(services).not.toMatch(/ip_reference|enregistrerIpSite|declarerReseau/)
  })
})

describe('l export de paie', () => {
  const ecran = codeSeul('components', 'ExportPaie.jsx')
  const permissions = codeSeul('permissions.js')

  test('un salarie ne peut pas exporter les heures de ses collegues', () => {
    expect(permissions).toMatch(/canExport: false/)
    expect(ecran).toMatch(/permissions\?\.canExport === true/)
  })

  test('l ecran previent avant d exporter un total incomplet', () => {
    // Decouvrir apres coup qu'il manquait trois journees, c'est le
    // decouvrir apres avoir paye.
    expect(ecran).toMatch(/totalNonCalcule > 0/)
    expect(ecran).toMatch(/n&apos;entre/)
  })
})
