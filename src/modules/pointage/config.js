export const MODULE_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { id: 'pointage', label: 'Pointage', icon: '⏱️' },
  { id: 'historique', label: 'Historique', icon: '🗂️' },
  // L'ecran Corrections existait mais n'etait atteignable par aucun
  // onglet : il ne s'affichait que si activeTab n'etait aucun des cinq,
  // ce qui n'arrivait jamais. Personne n'a donc jamais vu -- ni ses
  // fausses donnees, ni les vraies anomalies qu'il aurait du montrer.
  { id: 'corrections', label: 'A corriger', icon: '⚠️' },
  { id: 'paie', label: 'Heures & paie', icon: '💶' },
  { id: 'sites', label: 'Sites', icon: '📍' },
  { id: 'parametres', label: 'Paramètres', icon: '⚙️' },
]

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
