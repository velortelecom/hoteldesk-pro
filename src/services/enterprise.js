export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function requireProfileId(profile) {
  if (!isUuid(profile?.id)) {
    throw new Error('missing_profile_id')
  }
  return profile.id
}

export function requireEnterpriseId(profile) {
  if (!isUuid(profile?.entreprise_id)) {
    throw new Error('missing_enterprise_id')
  }
  return profile.entreprise_id
}

export function withEnterpriseScope(query, enterpriseId, column = 'entreprise_id') {
  return query.eq(column, enterpriseId)
}
