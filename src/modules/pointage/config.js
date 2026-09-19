// =====================================================================
// QUI VOIT QUOI
//
// Un salarie vient pointer. Il n'a rien a faire dans le tableau de bord
// de l'equipe, dans l'export de paie ni dans les parametres. Chaque
// onglet declare donc les roles qui y ont droit -- et il DOIT le
// declarer : un onglet ajoute demain sans liste de roles fait echouer le
// test, au lieu de s'afficher discretement pour tout le monde.
//
// Ce n'est pas la securite : la securite est dans la base. La politique
// pointages_select n'autorise un salarie a lire QUE ses propres
// pointages (profile_id = auth.uid()). Meme en forcant un onglet, il ne
// verrait pas les heures de ses collegues -- PostgreSQL ne les lui
// enverrait pas. Ce qui suit sert a ne pas montrer a quelqu'un des
// ecrans qui ne le concernent pas.
// =====================================================================
export const ROLES_TOUS = ['employe', 'responsable', 'admin', 'super_admin']
export const ROLES_ENCADREMENT = ['responsable', 'admin', 'super_admin']

export const MODULE_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊', roles: ROLES_ENCADREMENT },
  // Ouvert a tous : c'est la raison d'etre du module.
  { id: 'pointage', label: 'Pointage', icon: '⏱️', roles: ROLES_TOUS },
  // Ouvert a tous aussi, et il le faut : un decompte d'heures que
  // l'interesse ne peut pas verifier n'est pas un decompte (art.
  // D.3171-8). L'ecran ne montre que les journees de celui qui regarde.
  { id: 'mes-heures', label: 'Mes heures', icon: '🕒', roles: ROLES_TOUS },
  // Historique montre les journees de TOUTE l'equipe. C'est pour ca
  // qu'il n'est pas l'ecran « mes heures » : on ne donne pas a chacun
  // les horaires de ses collegues pour qu'il puisse lire les siens.
  { id: 'historique', label: 'Historique', icon: '🗂️', roles: ROLES_ENCADREMENT },
  // L'ecran Corrections existait mais n'etait atteignable par aucun
  // onglet : il ne s'affichait que si activeTab n'etait aucun des cinq,
  // ce qui n'arrivait jamais. Personne n'a donc jamais vu -- ni ses
  // fausses donnees, ni les vraies anomalies qu'il aurait du montrer.
  { id: 'corrections', label: 'A corriger', icon: '⚠️', roles: ROLES_ENCADREMENT },
  { id: 'paie', label: 'Heures & paie', icon: '💶', roles: ROLES_ENCADREMENT },
  { id: 'sites', label: 'Sites', icon: '📍', roles: ROLES_ENCADREMENT },
  { id: 'parametres', label: 'Paramètres', icon: '⚙️', roles: ROLES_ENCADREMENT },
]

/** Un role inconnu est traite comme un salarie, jamais comme un admin. */
export function roleConnu(role) {
  return ROLES_TOUS.includes(role) ? role : 'employe'
}

/**
 * Le role qui compte ici -- celui du PROFIL, pas la seule colonne `role`.
 *
 * Un super administrateur n'a pas role = 'super_admin' : il porte
 * is_super_admin = true, et sa colonne role vaut ce qu'elle vaut dans
 * l'entreprise qu'il consulte (souvent 'employe', parfois rien). En ne
 * lisant que `role`, il serait donc traite en salarie et n'aurait qu'un
 * onglet quand il entre dans une entreprise par le contexte Super Admin.
 *
 * C'est aussi ce qui rendait l'entree `super_admin` de permissions.js
 * inatteignable : un jeu de permissions ecrit pour personne. Il sert
 * enfin.
 */
export function rolePointage(profile) {
  if (profile?.is_super_admin === true) return 'super_admin'
  return roleConnu(profile?.role)
}

/** Les onglets auxquels ce role a droit, dans l'ordre d'affichage. */
export function ongletsPourRole(role) {
  const r = roleConnu(role)
  return MODULE_TABS.filter((tab) => tab.roles.includes(r))
}

/**
 * L'onglet ouvert a l'arrivee.
 *
 * Un salarie tombe sur « Pointage » : c'est ce qu'il vient faire, et
 * c'est le seul onglet qu'il a. L'encadrement garde le tableau de bord.
 */
export function ongletParDefaut(role) {
  const visibles = ongletsPourRole(role)
  const dashboard = visibles.find((tab) => tab.id === 'dashboard')
  return (dashboard || visibles[0] || { id: 'pointage' }).id
}

// DEFAULT_POINTAGE_SETTINGS decrivait quatre reglages qui n'existent dans
// aucune table : tolerance de retard, heures par jour, pointage mobile,
// notifications. Le service les fabriquait en lisant des colonnes sans
// rapport -- « Tolerance de retard : 50 minutes » etait en realite une
// precision GPS en METRES.
//
// Ce qui suit reflete la table entreprise_parametres_pointage, et rien
// d'autre. Les valeurs sont celles que la base pose elle-meme par defaut.
export const DEFAULT_POINTAGE_SETTINGS = {
  parametree: false,
  precisionGpsMaxMetres: 50,
  gpsObligatoire: true,
  autoriserHorsZoneAvecValidation: false,
  dureeMaxEntrePointagesMinutes: null,
  methodesActives: ['navigateur'],
}

export const MODULE_METADATA = {
  id: 'pointage',
  nom: 'Pointage',
  version: '1.0.0',
  description: 'Suivi du pointage, du statut des équipes et de l’historique des passages.',
}
