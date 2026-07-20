import { PLANS } from '../../lib/modules'

export function buildEffectiveOfferLimits(row = {}) {
  const planDefaults = PLANS[row.plan] || {}
  const defaultUsers = Number(planDefaults.max_utilisateurs || 0)
  const effectiveUsers = Number(row.max_utilisateurs || 0)
  const hasOverride = defaultUsers > 0 && effectiveUsers > 0 && effectiveUsers !== defaultUsers

  return {
    defaultUsers,
    effectiveUsers: effectiveUsers || defaultUsers || 0,
    hasOverride,
    usersLabel: hasOverride
      ? `${effectiveUsers} utilisateurs - limite personnalisee`
      : `${effectiveUsers || defaultUsers || 0} utilisateurs inclus`,
  }
}

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
      .select('id, entreprise_id, plan, actif, prix_mensuel, date_debut, date_fin, created_at, paye, paye_le')
      .limit(200)

  const subscriptionState = normalizeSubscriptionState(subRes.error)

const baseRows = enterpriseRes.data || []
      const subscriptionByEntreprise = {}
      ;(subRes.data || []).forEach((sub) => { subscriptionByEntreprise[sub.entreprise_id] = sub })
      const rows = baseRows.map((row) => {
              const sub = subscriptionByEntreprise[row.id] || null
              return {
                        ...row,
                        offerLimits: buildEffectiveOfferLimits(row),
                        abonnementId: sub?.id || null,
                        paye: sub ? sub.paye === true : null,
                        payeLe: sub?.paye_le || null,
              }
      })

  return {
    rows,
    summary: buildOfferSummary(baseRows),
    subscriptions: subscriptionState === 'ok' ? (subRes.data || []) : [],
    subscriptionState,
  }
}


  export async function syncAbonnementFromEntreprise(supabase, entrepriseId, { plan, prix_mensuel, actif } = {}) {
      if (!entrepriseId) return

  const { data: existing, error: selectError } = await supabase
        .from('abonnements')
        .select('id')
        .eq('entreprise_id', entrepriseId)
        .limit(1)
        .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
        const { error } = await supabase
          .from('abonnements')
          .update({ plan, prix_mensuel, actif })
          .eq('id', existing.id)
        if (error) throw error
  } else {
        const { error } = await supabase
          .from('abonnements')
          .insert({ entreprise_id: entrepriseId, plan, prix_mensuel, actif, date_debut: new Date().toISOString() })
        if (error) throw error
  }
  }


              export async function setAbonnementPaiement(supabase, entrepriseId, paye) {
                  if (!entrepriseId) return
                  const { error } = await supabase
                    .from('abonnements')
                    .update({ paye: !!paye, paye_le: paye ? new Date().toISOString() : null })
                    .eq('entreprise_id', entrepriseId)
                  if (error) throw error
              }Page_Down
