export function getMockPointages() {
  return [
    {
      id: 'PT-1001',
      employe: 'Sophie Martin',
      site: 'Hôtel Central',
      date: '2026-07-13',
      entree: '07:58',
      sortie: '17:30',
      statut: 'Validé',
    },
    {
      id: 'PT-1002',
      employe: 'Léa Bernard',
      site: 'Restaurant Le Sud',
      date: '2026-07-13',
      entree: '08:13',
      sortie: '17:45',
      statut: 'A vérifier',
    },
    {
      id: 'PT-1003',
      employe: 'Noah Dubois',
      site: 'Résidence Le Parc',
      date: '2026-07-13',
      entree: '08:03',
      sortie: '16:58',
      statut: 'Validé',
    },
  ]
}

export function getTodaySummary() {
  return {
    totalEmployes: 18,
    present: 14,
    absents: 2,
    retards: 3,
    tempsTotal: '8h 12m',
  }
}

export function getSitesSummary() {
  return [
    { id: 'site-1', nom: 'Hôtel Central', equipe: 6, actif: true },
    { id: 'site-2', nom: 'Restaurant Le Sud', equipe: 4, actif: true },
    { id: 'site-3', nom: 'Résidence Le Parc', equipe: 5, actif: false },
  ]
}

export function formatStatut(statut) {
  return statut?.toUpperCase?.() || 'INCONNU'
}
