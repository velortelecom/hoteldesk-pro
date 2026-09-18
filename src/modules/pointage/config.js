export const MODULE_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { id: 'pointage', label: 'Pointage', icon: '⏱️' },
  { id: 'historique', label: 'Historique', icon: '🗂️' },
  // L'ecran Corrections existait mais n'etait atteignable par aucun
  // onglet : il ne s'affichait que si activeTab n'etait aucun des cinq,
  // ce qui n'arrivait jamais. Personne n'a donc jamais vu -- ni ses
  // fausses donnees, ni les vraies anomalies qu'il aurait du montrer.
  { id: 'corrections', label: 'A corriger', icon: '⚠️' },
  { id: 'sites', label: 'Sites', icon: '📍' },
  { id: 'parametres', label: 'Paramètres', icon: '⚙️' },
]

export const DEFAULT_POINTAGE_SETTINGS = {
  toleranceRetardMinutes: 5,
  heuresParJour: 8,
  autoriserPointageMobile: true,
  notificationRetards: true,
}

export const MODULE_METADATA = {
  id: 'pointage',
  nom: 'Pointage',
  version: '1.0.0',
  description: 'Suivi du pointage, du statut des équipes et de l’historique des passages.',
}
