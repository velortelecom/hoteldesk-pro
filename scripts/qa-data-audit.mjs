import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!baseUrl || !secretKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(baseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
const QA_PATTERN = /(qa|e2e|test)/i

async function main() {
  const [profilesRes, entreprisesRes, invitationsRes] = await Promise.all([
    admin.from('profiles').select('id, entreprise_id, prenom, nom, email, actif'),
    admin.from('entreprises').select('id, nom, slug, actif, created_at'),
    admin.from('invitations').select('id, email, entreprise_id, statut, created_at').limit(500),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (entreprisesRes.error) throw entreprisesRes.error

  const profiles = profilesRes.data || []
  const entreprises = entreprisesRes.data || []
  const invitations = invitationsRes.error ? [] : (invitationsRes.data || [])

  const enterpriseIds = new Set(entreprises.map((row) => row.id))
  const orphanProfiles = profiles.filter((row) => row.entreprise_id && !enterpriseIds.has(row.entreprise_id))
  const qaEntreprises = entreprises.filter((row) => QA_PATTERN.test(row.nom || '') || QA_PATTERN.test(row.slug || ''))
  const orphanInvitations = invitations.filter((row) => row.entreprise_id && !enterpriseIds.has(row.entreprise_id))
  const incompleteInvitations = invitations.filter((row) => ['draft', 'pending', 'pending_email'].includes(String(row.statut || '').toLowerCase()))

  console.log(JSON.stringify({
    summary: {
      entreprises_total: entreprises.length,
      profiles_total: profiles.length,
      invitations_total: invitations.length,
      qa_entreprises: qaEntreprises.length,
      orphan_profiles: orphanProfiles.length,
      orphan_invitations: orphanInvitations.length,
      incomplete_invitations: incompleteInvitations.length,
    },
    samples: {
      qa_entreprises: qaEntreprises.slice(0, 20),
      orphan_profiles: orphanProfiles.slice(0, 20),
      orphan_invitations: orphanInvitations.slice(0, 20),
      incomplete_invitations: incompleteInvitations.slice(0, 20),
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
