export const SUPER_ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard global', icon: '📊' },
  { id: 'enterprises', label: 'Entreprises', icon: '🏢' },
  { id: 'users', label: 'Utilisateurs globaux', icon: '👥' },
  { id: 'modules', label: 'Catalogue modules', icon: '🧩' },
  { id: 'offers', label: 'Offres & limites', icon: '💼' },
  { id: 'support', label: 'Support tickets', icon: '🎫' },
  { id: 'audit', label: 'Audit & supervision', icon: '🕵️' },
  { id: 'platform', label: 'Sante plateforme', icon: '🛠️' },
  { id: 'settings', label: 'Parametres globaux', icon: '⚙️' },
  { id: 'assistance', label: 'Mode assistance', icon: '🆘' },
]

export function getSuperAdminSectionLabel(sectionId) {
  return SUPER_ADMIN_SECTIONS.find((section) => section.id === sectionId)?.label || 'Dashboard global'
}
