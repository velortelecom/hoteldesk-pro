import { limiteUtilisateurs } from '../lib/offres'

export function buildEnterpriseCreationPayload(form, entData) {
  return {
    entreprise: {
      nom: entData.nom,
      slug: entData.slug,
      secteur: entData.secteur,
      plan: entData.plan,
      actif: entData.actif !== false,
      prix_mensuel: Number(entData.prix_mensuel || 0),
      // Un 0 ferait facturer CHAQUE utilisateur en supplement. A defaut
      // de valeur saisie, la limite est celle du pack choisi.
      max_utilisateurs: Number(entData.max_utilisateurs) > 0
        ? Number(entData.max_utilisateurs)
        : limiteUtilisateurs(entData.plan),
      email_contact: entData.email_contact || null,
      telephone: entData.telephone || null,
      adresse: entData.adresse || null,
    },
    modules_selectionnes: Array.isArray(form.modules_selectionnes) ? form.modules_selectionnes : [],
    departements_selectionnes: Array.isArray(form.departements_selectionnes) ? form.departements_selectionnes : [],
    postes_selectionnes: Array.isArray(form.postes_selectionnes) ? form.postes_selectionnes : [],
    admin: form.admin_email
      ? {
          prenom: form.admin_prenom || 'Admin',
          nom: form.admin_nom || entData.nom,
          email: form.admin_email,
          telephone: form.admin_telephone || null,
        }
      : null,
  }
}

export function shouldCommitEnterpriseCreation(result) {
  return Boolean(result?.success && result?.entreprise?.id)
}

export function applyEnterpriseCreationToState(current, result) {
  if (!shouldCommitEnterpriseCreation(result)) return current

  const entreprise = result.entreprise
  const previousEntreprises = Array.isArray(current?.entreprises) ? current.entreprises : []
  const previousStats = current?.stats || { total: 0, actives: 0, totalUsers: 0, totalSites: 0, par_plan: {} }

  const entreprises = [
    entreprise,
    ...previousEntreprises.filter((row) => row.id !== entreprise.id),
  ]

  const health = result.health || null
  const stats = {
    ...previousStats,
    total: health?.total_entreprises ?? previousStats.total,
    actives: health?.entreprises_actives ?? previousStats.actives,
    totalUsers: health?.total_users ?? previousStats.totalUsers,
    totalSites: health?.total_sites ?? previousStats.totalSites,
  }

  return { entreprises, stats }
}

export function mapEnterpriseCreationError(error) {
  const raw = String(error?.message || error || '').toLowerCase()

  if (raw.includes('entreprise_slug_exists') || raw.includes('entreprise_name_exists') || raw.includes('duplicate key')) {
    return 'Une entreprise avec ce nom existe deja.'
  }
  // Trois causes distinctes donnaient la meme phrase : on ne savait pas
  // laquelle corriger. Un email deja pris se regle en changeant l'email ;
  // une panne reseau se regle en reessayant. Ce n'est pas le meme geste.
  if (raw.includes('admin_email_already_exists')) {
    return 'Cet email est deja utilise par un compte existant. Choisissez-en un autre.'
  }
  if (raw.includes('admin_create_failed') || raw.includes('admin_profile_create_failed')) {
    return 'Impossible de creer l administrateur. La creation a ete annulee.'
  }
  if (raw.includes('failed to send a request to the edge function') || raw.includes('functionsfet') || raw.includes('network')) {
    return 'Le serveur n a pas repondu. Rien n a ete cree, vous pouvez reessayer.'
  }
  if (raw.includes('forbidden') || raw.includes('authentication_required') || raw.includes('invalid_token')) {
    return 'Action non autorisee pour ce compte.'
  }

  return 'La creation a ete annulee.'
}

export function buildEnterpriseCreationSuccessMessage({ isEdit, departementsCount, postesCount, adminCredentials }) {
  const baseMsg = isEdit
    ? 'Entreprise modifiee !'
    : 'Entreprise creee avec ' + departementsCount + ' depts et ' + postesCount + ' postes !'

  if (!adminCredentials) return baseMsg

  return (
    baseMsg +
    ' Admin cree - Identifiant : ' +
    adminCredentials.email +
    ' / Mot de passe temporaire : ' +
    adminCredentials.password +
    ' (a transmettre une seule fois)'
  )
}
