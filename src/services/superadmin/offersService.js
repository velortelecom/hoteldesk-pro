import { PLANS } from '../../lib/modules'

export function filterOfferRows(rows = [], searchQuery = '', filters = {}) {
  const needle = (searchQuery || '').trim().toLowerCase()
  const plan = filters.plan || ''
  const status = filters.status || ''

  return rows.filter((row) => {
    if (plan && row.plan !== plan) return false
    if (status === 'actif' && row.actif === false) return false
    if (status === 'inactif' && row.actif !== false) return false

    if (!needle) return true
    return [row.nom, row.slug, row.plan]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
}

export function buildOfferSummary(rows = []) {
  const byPlan = {}
  let customLimits = 0

  rows.forEach((row) => {
    byPlan[row.plan] = (byPlan[row.plan] || 0) + 1

    const defaultPlan = PLANS[row.plan]
    if (!defaultPlan) return

    const customPrice = Number(row.prix_mensuel || 0) !== Number(defaultPlan.prix || 0)
    const customUsers = Number(row.max_utilisateurs || 0) !== Number(defaultPlan.max_utilisateurs || 0)
    if (customPrice || customUsers) customLimits += 1
  })

  return {
    total: rows.length,
    active: rows.filter((row) => row.actif !== false).length,
    suspended: rows.filter((row) => row.actif === false).length,
    customLimits,
    byPlan,
  }
}

function normalizeSubscriptionState(error) {
  if (!error) return 'ok'
  const msg = String(error.message || error || '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('schema cache')) return 'non_configure'
  return 'indisponible'
}

export async function fetchOffersLimitsData(supabase) {
  const enterpriseRes = await supabase
    .from('entreprises')
    .select('id, nom, slug, plan, actif, prix_mensuel, max_utilisateurs, created_at')
    .order('nom')

  if (enterpriseRes.error) throw enterpriseRes.error

  const subRes = await supabase
    .from('abonnements')
    .select('id, entreprise_id, plan, statut, max_utilisateurs, prix_mensuel, updated_at')
    .limit(200)

  const subscriptionState = normalizeSubscriptionState(subRes.error)

  return {
    rows: enterpriseRes.data || [],
    summary: buildOfferSummary(enterpriseRes.data || []),
    subscriptions: subscriptionState === 'ok' ? (subRes.data || []) : [],
    subscriptionState,
  }
}
