export async function fetchSuperAdminSnapshot(supabase) {
  const [healthRes, entreprisesRes] = await Promise.all([
    supabase.rpc('super_admin_platform_health'),
    supabase.from('entreprises').select('id, nom, slug, plan, actif, created_at').order('created_at', { ascending: false }),
  ])

  if (healthRes.error) throw healthRes.error
  if (entreprisesRes.error) throw entreprisesRes.error

  const health = Array.isArray(healthRes.data) ? (healthRes.data[0] || null) : (healthRes.data || null)
  const entreprises = entreprisesRes.data || []

  return {
    health,
    entreprises,
  }
}

export function filterSnapshotEntreprises(entreprises = [], searchQuery = '') {
  const needle = (searchQuery || '').trim().toLowerCase()
  if (!needle) return entreprises

  return entreprises.filter((ent) => {
    return [ent.nom, ent.slug, ent.plan, ent.secteur, ent.email_contact]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
}
