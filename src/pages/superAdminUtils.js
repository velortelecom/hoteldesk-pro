export function normalizeEntrepriseSlug(nom) {
  return (nom || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

export function buildEditionForm(ent, activeModuleRows = []) {
  const modules_selectionnes = (activeModuleRows || [])
    .filter((row) => row && row.actif)
    .map((row) => row.module_id)

  return {
    nom: ent?.nom || '',
    slug: ent?.slug || '',
    secteur: ent?.secteur || 'hotel',
    plan: ent?.plan || 'starter',
    prix_mensuel: ent?.prix_mensuel || 29,
    max_utilisateurs: ent?.max_utilisateurs || 10,
    actif: ent?.actif !== false,
    modules_selectionnes,
    departements_selectionnes: [],
    postes_selectionnes: [],
    email_contact: ent?.email_contact || '',
    telephone: ent?.telephone || '',
    adresse: ent?.adresse || '',
    admin_prenom: '',
    admin_nom: '',
    admin_email: '',
    admin_telephone: '',
  }
}

export function buildCreationSlug(nom) {
  return normalizeEntrepriseSlug(nom)
}
