// ============================================================
// MODULE ORGANISATION — routes.js
// Définition des routes du module
// ============================================================

export const ORGANISATION_ROUTES = [
  {
    path: 'organisation',
    label: 'Organisation',
    isDefault: true,
  },
  {
    path: 'organisation/employes',
    label: 'Employés',
  },
  {
    path: 'organisation/employe/:id',
    label: 'Fiche Employé',
    hideFromNav: true,
  },
  {
    path: 'organisation/departements',
    label: 'Départements',
  },
  {
    path: 'organisation/postes',
    label: 'Postes',
  },
];

export const MODULE_ROUTE = 'organisation';
