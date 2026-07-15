import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
const adminEmail = process.env.QA_ADMIN_EMAIL
const adminPassword = process.env.QA_ADMIN_PASSWORD
const foreignSlug = process.env.QA_FOREIGN_ENTREPRISE_SLUG

if (!baseUrl || !publishableKey || !adminEmail || !adminPassword || !foreignSlug) {
  console.error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD / QA_FOREIGN_ENTREPRISE_SLUG')
  process.exit(1)
}

const client = createClient(baseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { error: signInError } = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
if (signInError) {
  console.error(JSON.stringify({ stage: 'signIn', error: signInError }, null, 2))
  process.exit(1)
}

const {
  data: { user },
} = await client.auth.getUser()

const { data: myProfile, error: profileError } = await client
  .from('profiles')
  .select('entreprise_id')
  .eq('id', user?.id)
  .single()

if (profileError || !myProfile?.entreprise_id) {
  console.error(JSON.stringify({ stage: 'profile', error: profileError ?? 'missing_entreprise_id' }, null, 2))
  process.exit(1)
}

const myEntrepriseId = myProfile.entreprise_id

const checks = []

async function probe(name, promiseFactory) {
  const { data, error, count } = await promiseFactory()
  checks.push({
    name,
    ok: !error,
    count: typeof count === 'number' ? count : undefined,
    error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null,
    sample: Array.isArray(data) ? data.slice(0, 2) : data,
  })
}

await probe('profiles_cross_enterprise', () => client.from('profiles').select('id, entreprise_id, prenom, nom').neq('entreprise_id', null).neq('entreprise_id', myEntrepriseId).limit(5))
await probe('entreprises_foreign_slug', () => client.from('entreprises').select('id, slug, nom').eq('slug', foreignSlug))
await probe('messages_other_enterprise', () => client.from('messages').select('id, entreprise_id, contenu').neq('entreprise_id', myEntrepriseId).limit(5))
await probe('notifications_other_enterprise', () => client.from('notifications').select('id, entreprise_id, title').neq('entreprise_id', myEntrepriseId).limit(5))

console.log(JSON.stringify({ checks }, null, 2))
