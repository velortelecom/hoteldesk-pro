export function filterEnterpriseRows(entreprises = [], searchQuery = '') {
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

export async function fetchEnterpriseList(supabase) {
  const [entreprisesRes, detailsRes, auditsRes] = await Promise.all([
    supabase
      .from('entreprises')
      .select('id, nom, slug, plan, secteur, email_contact, actif, created_at, max_utilisateurs')
      .order('created_at', { ascending: false }),
    supabase.from('super_admin_entreprises').select('entreprise_id, nb_sites, nb_admins, nb_personnel'),
    supabase
      .from('audit_events')
      .select('entreprise_id, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  if (entreprisesRes.error) throw entreprisesRes.error
  if (detailsRes.error) throw detailsRes.error
  if (auditsRes.error) throw auditsRes.error

  const detailsMap = {}
  ;(detailsRes.data || []).forEach((row) => {
    detailsMap[row.entreprise_id] = row
  })

  const lastActivityByEntreprise = {}
  ;(auditsRes.data || []).forEach((row) => {
    if (!row.entreprise_id || lastActivityByEntreprise[row.entreprise_id]) return
    lastActivityByEntreprise[row.entreprise_id] = row.created_at
  })

  return {
    entreprises: entreprisesRes.data || [],
    detailsMap,
    lastActivityByEntreprise,
  }
}

export async function toggleEnterpriseStatus(supabase, entrepriseId, currentActif) {
  const { error } = await supabase
    .from('entreprises')
    .update({ actif: currentActif === false })
    .eq('id', entrepriseId)

  if (error) throw error
}

export async function deleteEnterprise(supabase, entrepriseId) {
  const { error } = await supabase.rpc('supprimer_entreprise_complete', { p_entreprise_id: entrepriseId })
  if (error) throw error
}
