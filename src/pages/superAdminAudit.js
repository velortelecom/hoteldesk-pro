const FORBIDDEN_META_KEYS = new Set([
  'password',
  'temp_password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'private_key',
  'service_role',
  'authorization',
  'jwt',
]);

export function sanitizeAuditMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeAuditMetadata(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (FORBIDDEN_META_KEYS.has(key.toLowerCase())) return acc;
      acc[key] = sanitizeAuditMetadata(item);
      return acc;
    }, {});
  }

  return value;
}

export function buildAuditActionLabel(action) {
  const labels = {
    creation_entreprise: 'Création entreprise',
    modification_entreprise: 'Modification entreprise',
    suspension_entreprise: 'Suspension entreprise',
    reactivation_entreprise: 'Réactivation entreprise',
    suppression_entreprise: 'Suppression entreprise',
    activation_module: 'Activation module',
    desactivation_module: 'Désactivation module',
    creation_utilisateur: 'Création utilisateur',
    modification_role_utilisateur: 'Modification rôle',
    activation_utilisateur: 'Activation utilisateur',
    desactivation_utilisateur: 'Désactivation utilisateur',
    reset_mot_de_passe_utilisateur: 'Reset mot de passe',
    suppression_utilisateur: 'Suppression utilisateur',
    creation_site: 'Création site',
    suppression_site: 'Suppression site',
    modification_parametres_critiques: 'Paramètres critiques',
  };

  return labels[action] || action || 'Action inconnue';
}

export function buildAuditEventRecord(input) {
  return {
    acteur_profile_id: input.acteur_profile_id || null,
    acteur_email: input.acteur_email || null,
    entreprise_id: input.entreprise_id || null,
    action: input.action,
    type_cible: input.type_cible,
    cible_id: input.cible_id || null,
    description: input.description,
    metadonnees: sanitizeAuditMetadata(input.metadonnees || {}),
    adresse_ip: input.adresse_ip || null,
    user_agent: input.user_agent || null,
    created_at: input.created_at || new Date().toISOString(),
  }
}

export function canSeeAuditRow(viewer, row) {
  if (!viewer) return false;
  if (viewer.is_super_admin) return true;
  if (['admin', 'responsable'].includes(viewer.role)) {
    return viewer.entreprise_id && viewer.entreprise_id === row.entreprise_id;
  }
  return false;
}

export function filterAuditEvents(events, filters, viewer) {
  const search = (filters.search || '').trim().toLowerCase();
  const action = filters.action || '';
  const enterpriseId = filters.entrepriseId || '';
  const actor = filters.actor || '';
  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : null;

  return (events || []).filter(row => {
    if (!canSeeAuditRow(viewer, row)) return false;
    if (enterpriseId && row.entreprise_id !== enterpriseId) return false;
    if (action && row.action !== action) return false;
    if (actor && !(row.acteur_email || '').toLowerCase().includes(actor.toLowerCase())) return false;
    if (startDate && new Date(row.created_at) < startDate) return false;
    if (endDate) {
      const rowDate = new Date(row.created_at);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (rowDate > end) return false;
    }
    if (search) {
      const haystack = [
        row.action,
        row.type_cible,
        row.description,
        row.acteur_email,
        row.cible_id,
        JSON.stringify(row.metadonnees || {}),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function buildSupervisionSnapshot({ entreprises = [], profiles = [], modules = [], events = [] }) {
  const activeModulesByEntreprise = new Map();
  modules.forEach(row => {
    if (!activeModulesByEntreprise.has(row.entreprise_id)) activeModulesByEntreprise.set(row.entreprise_id, []);
    activeModulesByEntreprise.get(row.entreprise_id).push(row);
  });

  const disabledUsers = profiles.filter(p => p.actif === false && !p.is_super_admin);
  const entrepriseSansAdmin = entreprises.filter(ent => profiles.some(p => p.entreprise_id === ent.id && p.role === 'admin' && !p.is_super_admin) === false);
  const entrepriseSansModule = entreprises.filter(ent => {
    const rows = activeModulesByEntreprise.get(ent.id) || [];
    return rows.filter(r => r.actif === true).length === 0;
  });
  const configIssues = [
    ...entrepriseSansAdmin.map(ent => ({ entreprise_id: ent.id, nom: ent.nom, type: 'sans_admin' })),
    ...entrepriseSansModule.map(ent => ({ entreprise_id: ent.id, nom: ent.nom, type: 'sans_module' })),
  ];
  const criticalIncidents = (events || []).filter(evt => [
    'suppression_entreprise',
    'suppression_utilisateur',
    'reset_mot_de_passe_utilisateur',
    'suspension_entreprise',
    'modification_parametres_critiques',
  ].includes(evt.action));

  return {
    entrepriseSansAdmin,
    entrepriseSansModule,
    disabledUsers,
    configIssues,
    criticalIncidents,
  };
}
