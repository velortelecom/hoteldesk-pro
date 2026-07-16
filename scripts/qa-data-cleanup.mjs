import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const applyMode = String(process.env.QA_APPLY || '').toLowerCase() === 'true'

if (!baseUrl || !secretKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(baseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
const QA_PATTERN = /(qa|e2e|test)/i

async function main() {
  const [profilesRes, entreprisesRes] = await Promise.all([
    admin.from('profiles').select('id, entreprise_id, actif'),
    admin.from('entreprises').select('id, nom, slug, actif'),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (entreprisesRes.error) throw entreprisesRes.error

  const profiles = profilesRes.data || []
  const entreprises = entreprisesRes.data || []
  const enterpriseIds = new Set(entreprises.map((row) => row.id))

  const qaEntreprises = entreprises.filter((row) => QA_PATTERN.test(row.nom || '') || QA_PATTERN.test(row.slug || ''))
  const orphanProfiles = profiles.filter((row) => row.entreprise_id && !enterpriseIds.has(row.entreprise_id) && row.actif !== false)

  const plan = {
    dryRun: !applyMode,
    archive_qa_entreprises: qaEntreprises.map((row) => ({ id: row.id, nom: row.nom, slug: row.slug })),
    deactivate_orphan_profiles: orphanProfiles.map((row) => row.id),
  }

  if (!applyMode) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  for (const ent of qaEntreprises) {
    const nextName = String(ent.nom || '').startsWith('[ARCHIVED_QA]') ? ent.nom : `[ARCHIVED_QA] ${ent.nom}`
    const { error } = await admin.from('entreprises').update({ actif: false, nom: nextName }).eq('id', ent.id)
    if (error) throw error
  }

  if (orphanProfiles.length > 0) {
    const { error } = await admin.from('profiles').update({ actif: false }).in('id', orphanProfiles.map((row) => row.id))
    if (error) throw error
  }

  console.log(JSON.stringify({ ...plan, applied: true }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
