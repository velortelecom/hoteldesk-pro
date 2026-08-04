export const MODULE_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { id: 'pointage', label: 'Pointage', icon: '⏱️' },
  { id: 'historique', label: 'Historique', icon: '🗂️' },
  { id: 'sites', label: 'Sites', icon: '📍' },
  { id: 'parametres', label: 'Paramètres', icon: '⚙️' },
]

export const DEFAULT_POINTAGE_SETTINGS = {
  toleranceRetardMinutes: 5,
  heuresParJour: 8,
  autoriserPointageMobile: true,
  notificationRetards: true,
  heureDebutTravail: '09:00',
  heureFinTravail: '18:00',
  pauseDureeMinutes: 60,
  pauseObligatoire: true,
}

export const MODULE_METADATA = {
  id: 'pointage',
  nom: 'Pointage',
  version: '1.0.0',
  description: 'Suivi du pointage, du statut des équipes et de l’historique des passages.',
}
