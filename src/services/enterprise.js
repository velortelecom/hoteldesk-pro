export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function requireProfileId(profile) {
  if (!isUuid(profile?.id)) {
    throw new Error('Session invalide : identifiant du profil introuvable. Merci de vous reconnecter.')
  }
  return profile.id
}

export function requireEnterpriseId(profile) {
  if (!isUuid(profile?.entreprise_id)) {
    throw new Error('Aucune entreprise associee a cette session. Si vous etes en mode assistance, rafraichissez la page puis reessayez.')
  }
  return profile.entreprise_id
}

export function withEnterpriseScope(query, enterpriseId, column = 'entreprise_id') {
  return query.eq(column, enterpriseId)
}
