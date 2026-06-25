// ============================================================
// MODULE ORGANISATION — config.js
// Configuration centrale du module
// ============================================================

export const MODULE_ID = 'organisation';
export const MODULE_VERSION = '1.0.0';

// Couleurs par rôle
export const ROLE_COLORS = {
  admin: '#ef4444',
  responsable: '#f59e0b',
  employe: '#6366f1',
  super_admin: '#8b5cf6',
};

// Icônes par catégorie de département
export const DEPT_ICONS = [
  { value: 'building', label: 'Batiment' },
  { value: 'door-open', label: 'Reception' },
  { value: 'coffee', label: 'Restaurant' },
  { value: 'sparkles', label: 'Menage' },
  { value: 'wrench', label: 'Maintenance' },
  { value: 'users', label: 'Equipe' },
  { value: 'briefcase', label: 'Gestion' },
  { value: 'shield', label: 'Securite' },
  { value: 'leaf', label: 'Jardinage' },
  { value: 'car', label: 'Transport' },
];

// Couleurs de département disponibles
export const DEPT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

// Niveaux de poste
export const NIVEAUX_POSTE = [
  { value: 1, label: 'Niveau 1 - Debutant' },
  { value: 2, label: 'Niveau 2 - Junior' },
  { value: 3, label: 'Niveau 3 - Confirme' },
  { value: 4, label: 'Niveau 4 - Senior / Chef' },
  { value: 5, label: 'Niveau 5 - Directeur' },
];

// Templates de postes par secteur (sans apostrophes)
export const POSTES_TEMPLATE_HOTEL = [
  'Receptionniste', 'Chef de reception', 'Night Auditor',
  'Agent petit-dejeuner', 'Femme de chambre', 'Gouvernante',
  'Technicien de maintenance', 'Chef de maintenance', 'Bagagiste',
  'Concierge', 'Directeur hotel', 'Directeur adjoint',
];

// Tabs du module
export const MODULE_TABS = [
  { id: 'employes', label: 'Employes', icon: '👥' },
  { id: 'departements', label: 'Departements', icon: '🏢' },
  { id: 'postes', label: 'Postes', icon: '💼' },
  { id: 'organigramme', label: 'Organigramme', icon: '🌳' },
];

// Permissions du module (cles utilisees dans permissions.js)
export const PERMS = {
  VIEW_EMPLOYES: 'organisation.view',
  CREATE_EMPLOYE: 'organisation.create',
  EDIT_EMPLOYE: 'organisation.edit',
  DELETE_EMPLOYE: 'organisation.delete',
  MANAGE_DEPTS: 'organisation.manage_depts',
  MANAGE_POSTES: 'organisation.manage_postes',
  VIEW_NOTES: 'organisation.view_notes',
};
