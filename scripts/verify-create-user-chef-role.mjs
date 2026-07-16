import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
const adminEmail = process.env.QA_ADMIN_EMAIL
const adminPassword = process.env.QA_ADMIN_PASSWORD

if (!baseUrl || !publishableKey || !adminEmail || !adminPassword) {
  console.error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD')
  process.exit(1)
}

const client = createClient(baseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { error: signInError, data: signInData } = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (signInError) {
    console.error(JSON.stringify({ stage: 'signIn', error: signInError }, null, 2))
    process.exit(1)
  }

  const adminUserId = signInData.user?.id
  if (!adminUserId) {
    console.error(JSON.stringify({ stage: 'signIn', error: 'missing_user_id' }, null, 2))
    process.exit(1)
  }

  const { data: adminProfile, error: profileError } = await client
    .from('profiles')
    .select('entreprise_id')
    .eq('id', adminUserId)
    .single()

  if (profileError || !adminProfile?.entreprise_id) {
    console.error(JSON.stringify({ stage: 'profile', error: profileError ?? 'missing_entreprise_id' }, null, 2))
    process.exit(1)
  }

  const now = Date.now()
  const payload = {
    prenom: 'Chef',
    nom: 'QA',
    role: 'chef_equipe',
    entreprise_id: adminProfile.entreprise_id,
    email: `qa.createuser.chef.${now}@velor-one.test`,
    actif: true,
  }

  const { data, error } = await client.functions.invoke('create-user', { body: payload })
  const safeData = data
    ? {
        ...data,
        temp_password: data.temp_password ? '[redacted]' : null,
      }
    : null

  console.log(
    JSON.stringify(
      {
        ok: !error && data?.success === true,
        error,
        data: safeData,
      },
      null,
      2
    )
  )

  if (error || data?.success !== true || data?.role !== 'chef_equipe') {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})