export function buildEntrepriseUpdatePayload(form) {
  return {
    nom: form.nom,
    slug: form.slug,
    secteur: form.secteur,
    plan: form.plan,
    actif: form.actif !== false,
    prix_mensuel: Number(form.prix_mensuel || 0),
    max_utilisateurs: Number(form.max_utilisateurs || 0),
    email_contact: form.email_contact || null,
    telephone: form.telephone || null,
    adresse: form.adresse || null,
  }
}

export function filterSuperAdminUsers(users = [], filters = {}, viewer = null) {
  const search = (filters.search || '').trim().toLowerCase()
  const role = filters.role || ''
  const entrepriseId = filters.entrepriseId || ''
  const status = filters.status || ''

  return users.filter((user) => {
    if (!viewer?.is_super_admin && viewer?.entreprise_id && user.entreprise_id !== viewer.entreprise_id) {
      return false
    }
    if (role && user.role !== role) return false
    if (entrepriseId && user.entreprise_id !== entrepriseId) return false
    if (status === 'actif' && user.actif === false) return false
    if (status === 'inactif' && user.actif !== false) return false
    if (search) {
      const haystack = [
        user.prenom,
        user.nom,
        user.email,
        user.role,
        user.entreprise_nom,
        user.poste_nom,
        user.site_nom,
        user.departement_nom,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

export function buildSupervisionKpis({ entreprises = [], profiles = [], modules = [], sites = [], events = [] }) {
  const entrepriseIds = new Set(entreprises.map((ent) => ent.id))
  const activeModules = modules.filter((mod) => mod.actif === true)
  const users = profiles.filter((profile) => !profile.is_super_admin)
  const usersDisabled = users.filter((profile) => profile.actif === false)
  const entreprisesWithoutAdmin = entreprises.filter((ent) => users.some((u) => u.entreprise_id === ent.id && u.role === 'admin') === false)
  const entreprisesWithoutSite = entreprises.filter((ent) => sites.some((site) => site.entreprise_id === ent.id) === false)
  const activityByEntreprise = events.reduce((acc, evt) => {
    if (!evt?.entreprise_id) return acc
    const current = acc[evt.entreprise_id]
    const currentDate = current ? new Date(current) : null
    const eventDate = evt.created_at ? new Date(evt.created_at) : null
    if (eventDate && (!currentDate || eventDate > currentDate)) {
      acc[evt.entreprise_id] = evt.created_at
    }
    return acc
  }, {})

  return {
    totalEntreprises: entrepriseIds.size,
    entreprisesActives: entreprises.filter((ent) => ent.actif !== false).length,
    entreprisesSuspendues: entreprises.filter((ent) => ent.actif === false).length,
    totalUsers: users.length,
    usersDisabled: usersDisabled.length,
    entreprisesWithoutAdmin: entreprisesWithoutAdmin.length,
    entreprisesWithoutSite: entreprisesWithoutSite.length,
    modulesActifs: activeModules.length,
    configErrors: entreprisesWithoutAdmin.length + entreprisesWithoutSite.length,
    activityByEntreprise,
  }
}

export function buildModuleWritePolicyWarning(viewer) {
  if (viewer?.is_super_admin) return null
  return 'Seul le Super Admin peut modifier les modules commerciaux d une entreprise.'
}

export function buildDependencyErrorMessage(error) {
  const raw = String(error?.message || error || '').toLowerCase()
  if (raw.includes('foreign key') || raw.includes('violates')) {
    return 'Suppression bloquée: cet élément est encore utilisé par des données liées.'
  }
  return error?.message || 'Opération impossible.'
}

export function mapSuperAdminError(error, fallback = 'Opération impossible.') {
  const raw = String(error?.message || error || '').toLowerCase()

  if (raw.includes('failed to send a request to the edge function') || raw.includes('functionsfetcherror') || raw.includes('network')) {
    return 'Service temporairement indisponible. Réessayez dans quelques instants.'
  }
  if (raw.includes('duplicate key') || raw.includes('unique constraint') || raw.includes('slug')) {
    return 'Un enregistrement avec ces informations existe déjà.'
  }
  if (raw.includes('could not find') && raw.includes('schema cache')) {
    return 'Le schéma de données est en cours de synchronisation. Réessayez dans quelques instants.'
  }
  if (raw.includes('forbidden') || raw.includes('authentication_required') || raw.includes('invalid_token')) {
    return 'Action non autorisée pour ce compte.'
  }
  if (raw.includes('admin_create_failed')) {
    return 'Impossible de créer l administrateur.'
  }
  if (raw.includes('profile_create_failed') || raw.includes('caller_profile_missing')) {
    return 'Impossible de finaliser la création de l utilisateur.'
  }

  return fallback
}

export function buildAssistanceSessionDraft({ entrepriseId, reason, durationMinutes = 30 }) {
  if (!entrepriseId || !reason?.trim()) {
    throw new Error('missing_assistance_fields')
  }
  const openedAt = new Date()
  const expiresAt = new Date(openedAt.getTime() + durationMinutes * 60 * 1000)
  return {
    entrepriseId,
    reason: reason.trim(),
    openedAt: openedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    active: true,
  }
}
