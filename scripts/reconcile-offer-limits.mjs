import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const applyMode = String(process.env.QA_APPLY || '').toLowerCase() === 'true'

if (!baseUrl || !secretKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(baseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
const PLAN_DEFAULTS = {
  starter: { max_utilisateurs: 10 },
  business: { max_utilisateurs: 50 },
  premium: { max_utilisateurs: 200 },
}
const QA_PATTERN = /(qa|e2e|test)/i

async function main() {
  const { data, error } = await admin.from('entreprises').select('id, nom, slug, plan, max_utilisateurs').order('created_at', { ascending: false })
  if (error) throw error

  const rows = data || []
  const mismatches = rows.filter((row) => {
    const defaults = PLAN_DEFAULTS[row.plan]
    if (!defaults) return false
    return Number(row.max_utilisateurs || 0) !== Number(defaults.max_utilisateurs)
  })

  const qaMismatches = mismatches.filter((row) => QA_PATTERN.test(row.nom || '') || QA_PATTERN.test(row.slug || ''))
  const result = {
    dryRun: !applyMode,
    total_mismatches: mismatches.length,
    qa_mismatches: qaMismatches.length,
    samples: qaMismatches.slice(0, 50),
  }

  if (!applyMode) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  for (const row of qaMismatches) {
    const defaults = PLAN_DEFAULTS[row.plan]
    const { error: updateError } = await admin.from('entreprises').update({ max_utilisateurs: defaults.max_utilisateurs }).eq('id', row.id)
    if (updateError) throw updateError
  }

  console.log(JSON.stringify({ ...result, applied: true }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
