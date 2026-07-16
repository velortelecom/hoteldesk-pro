export async function fetchModulesCatalogue(supabase) {
  const { data, error } = await supabase
    .from('modules_catalogue')
    .select('id, nom, categorie, plan_minimum, actif, icone, ordre')
    .order('ordre')

  if (error) throw error
  return data || []
}

export function filterModulesCatalogue(rows = [], searchQuery = '', filters = {}) {
  const needle = (searchQuery || '').trim().toLowerCase()
  const status = filters.status || ''
  const category = filters.category || ''

  return rows.filter((row) => {
    if (status === 'actif' && row.actif !== true) return false
    if (status === 'inactif' && row.actif === true) return false
    if (category && row.categorie !== category) return false
    if (!needle) return true

    return [row.id, row.nom, row.categorie, row.plan_minimum]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
}
