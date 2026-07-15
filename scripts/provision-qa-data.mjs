import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY

if (!baseUrl || !secretKey || !publishableKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY environment variables.')
  process.exit(1)
}

const admin = createClient(baseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
const userClient = createClient(baseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)

function tempPassword(label) {
  return `Velor!${label}_${stamp}`
}

async function ensureUser({ email, password, prenom, nom, role, entrepriseId = null, isSuperAdmin = false }) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { prenom, nom, role, entreprise_id: entrepriseId },
  })

  if (created.error) {
    if (created.error.code !== 'email_exists') throw created.error
    const signIn = await userClient.auth.signInWithPassword({ email, password })
    if (signIn.error) throw signIn.error
    const userId = signIn.data.user?.id
    if (!userId) throw new Error('existing_user_missing_id')
    await admin.from('profiles').upsert({ id: userId, prenom, nom, role, entreprise_id: entrepriseId, actif: true, is_super_admin: isSuperAdmin })
    return { userId, email, password }
  }

  const userId = created.data.user?.id
  if (!userId) throw new Error('created_user_missing_id')
  await admin.from('profiles').upsert({ id: userId, prenom, nom, role, entreprise_id: entrepriseId, actif: true, is_super_admin: isSuperAdmin })
  return { userId, email, password }
}

async function ensureEntreprise(payload) {
  const { data: existing } = await admin.from('entreprises').select('id, nom, slug').eq('slug', payload.slug).maybeSingle()
  if (existing?.id) return existing
  const { data, error } = await admin.from('entreprises').insert(payload).select('id, nom, slug').single()
  if (error) throw error
  return data
}

async function ensureSite(entrepriseId, nom, slug) {
  const { data: existing } = await admin.from('sites').select('id, nom').eq('entreprise_id', entrepriseId).eq('slug', slug).maybeSingle()
  if (existing?.id) return existing
  const { data, error } = await admin.from('sites').insert({ entreprise_id: entrepriseId, nom, slug, ville: 'Paris', pays: 'France', actif: true }).select('id, nom').single()
  if (error) throw error
  return data
}

async function ensureDepartement(entrepriseId, siteId, nom, code, couleur) {
  const { data: existing } = await admin.from('departements').select('id, nom').eq('entreprise_id', entrepriseId).eq('code', code).maybeSingle()
  if (existing?.id) return existing
  const { data, error } = await admin.from('departements').insert({ entreprise_id: entrepriseId, site_id: siteId, nom, code, couleur, actif: true }).select('id, nom').single()
  if (error) throw error
  return data
}

async function ensureEquipe(entrepriseId, departementId, siteId, nom, code, couleur) {
  const { data: existing } = await admin.from('equipes').select('id, nom').eq('entreprise_id', entrepriseId).eq('nom', nom).maybeSingle()
  if (existing?.id) return existing
  const { data, error } = await admin.from('equipes').insert({ entreprise_id: entrepriseId, departement_id: departementId, site_id: siteId, nom, code, couleur, actif: true }).select('id, nom').single()
  if (error) throw error
  return data
}

async function ensurePoste(entrepriseId, departementId, nom, slug, niveau, roleSysteme = 'employe') {
  const { data: existing } = await admin.from('postes').select('id, nom').eq('entreprise_id', entrepriseId).eq('slug', slug).maybeSingle()
  if (existing?.id) return existing
  const { data, error } = await admin.from('postes').insert({ entreprise_id: entrepriseId, departement_id: departementId, nom, slug, niveau, role_systeme: roleSysteme, actif: true }).select('id, nom').single()
  if (error) throw error
  return data
}

async function attachEmployee({ userId, entrepriseId, siteId, departementId, equipeId, posteId, role }) {
  await admin.from('profiles').update({ entreprise_id: entrepriseId, site_id: siteId, poste_id: posteId, role, actif: true }).eq('id', userId)
  await admin.from('employe_departements').upsert({ profile_id: userId, departement_id: departementId, entreprise_id: entrepriseId, est_principal: true }, { onConflict: 'profile_id,departement_id' })
  await admin.from('employe_sites').upsert({ profile_id: userId, site_id: siteId, entreprise_id: entrepriseId, est_principal: true }, { onConflict: 'profile_id,site_id' })
  await admin.from('employe_equipes').upsert({ profile_id: userId, equipe_id: equipeId, entreprise_id: entrepriseId, est_principal: true }, { onConflict: 'profile_id,equipe_id' })
}

async function createDemoShift(entrepriseId, employeId, equipeId, siteId, departementId, createdBy, dateShift, start, end, typeShift, notes) {
  const { error } = await admin.from('shifts').insert({
    entreprise_id: entrepriseId,
    employe_id: employeId,
    equipe_id: equipeId,
    site_id: siteId,
    departement_id: departementId,
    date_shift: dateShift,
    heure_debut: start,
    heure_fin: end,
    pause_minutes: 30,
    statut: 'publie',
    type_shift: typeShift,
    notes,
    created_by: createdBy,
    updated_by: createdBy,
    published_at: new Date().toISOString(),
  })
  if (error) throw error
}

async function createDemoTask(entrepriseId, assigneeId, creatorId, title, dueAt) {
  const { error } = await admin.from('taches').insert({
    entreprise_id: entrepriseId,
    titre: title,
    categorie: 'admin',
    priorite: 'moyenne',
    statut: 'planifiee',
    assigne_a: assigneeId,
    cree_par: creatorId,
    date_echeance: dueAt,
  })
  if (error) throw error
}

async function createDemoReminder(entrepriseId, creatorId, assigneeId, title, reminderAt) {
  const { error } = await admin.from('rappels').insert({
    entreprise_id: entrepriseId,
    cree_par: creatorId,
    assigne_a: assigneeId,
    titre: title,
    priorite: 'normale',
    date_rappel: reminderAt,
  })
  if (error) throw error
}

async function createDemoLeave(entrepriseId, employeId, validateurId, startDate, endDate) {
  const { error } = await admin.from('conges').insert({
    entreprise_id: entrepriseId,
    employe_id: employeId,
    validateur_id: validateurId,
    type_conge: 'conges_payes',
    date_debut: startDate,
    date_fin: endDate,
    nb_jours: 2,
    statut: 'approuve',
    validated_at: new Date().toISOString(),
  })
  if (error) throw error
}

async function createDemoMessage(entrepriseId, senderId, recipientId, text) {
  const { error } = await admin.from('messages').insert({
    entreprise_id: entrepriseId,
    expediteur_id: senderId,
    destinataire_id: recipientId,
    contenu: text,
    lu: false,
  })
  if (error) throw error
}

async function main() {
  const superAdmin = await ensureUser({
    email: `qa.superadmin.${stamp}@velor-one.test`,
    password: tempPassword('superadmin'),
    prenom: 'QA',
    nom: 'SuperAdmin',
    role: 'super_admin',
    isSuperAdmin: true,
  })

  const entrepriseA = await ensureEntreprise({ nom: `Velor QA A ${stamp}`, slug: `velor-qa-a-${stamp}`, secteur: 'hotel', plan: 'starter', actif: true, prix_mensuel: 0, max_utilisateurs: 50, adresse: 'Paris' })
  const entrepriseB = await ensureEntreprise({ nom: `Velor QA B ${stamp}`, slug: `velor-qa-b-${stamp}`, secteur: 'hotel', plan: 'starter', actif: true, prix_mensuel: 0, max_utilisateurs: 50, adresse: 'Lyon' })

  const siteA = await ensureSite(entrepriseA.id, 'Site A', `site-a-${stamp}`)
  const siteB = await ensureSite(entrepriseB.id, 'Site B', `site-b-${stamp}`)
  const deptA = await ensureDepartement(entrepriseA.id, siteA.id, 'Réception', `rec-a-${stamp}`, '#3B82F6')
  const deptB = await ensureDepartement(entrepriseB.id, siteB.id, 'Réception', `rec-b-${stamp}`, '#8B5CF6')
  const equipeA = await ensureEquipe(entrepriseA.id, deptA.id, siteA.id, `Equipe A ${stamp}`, `eq-a-${stamp}`, '#0F766E')
  const equipeB = await ensureEquipe(entrepriseB.id, deptB.id, siteB.id, `Equipe B ${stamp}`, `eq-b-${stamp}`, '#0F766E')
  const posteAdminA = await ensurePoste(entrepriseA.id, deptA.id, 'Admin Entreprise A', `admin-a-${stamp}`, 5, 'admin')
  const posteAdminB = await ensurePoste(entrepriseB.id, deptB.id, 'Admin Entreprise B', `admin-b-${stamp}`, 5, 'admin')
  const posteManagerA = await ensurePoste(entrepriseA.id, deptA.id, 'Manager A', `manager-a-${stamp}`, 4, 'responsable')
  const posteChefA = await ensurePoste(entrepriseA.id, deptA.id, 'Chef A', `chef-a-${stamp}`, 3, 'employe')
  const posteEmployeA = await ensurePoste(entrepriseA.id, deptA.id, 'Employé A', `employe-a-${stamp}`, 2, 'employe')

  const adminA = await ensureUser({ email: `qa.admin.a.${stamp}@velor-one.test`, password: tempPassword('adminA'), prenom: 'Admin', nom: 'EntrepriseA', role: 'admin', entrepriseId: entrepriseA.id })
  const adminB = await ensureUser({ email: `qa.admin.b.${stamp}@velor-one.test`, password: tempPassword('adminB'), prenom: 'Admin', nom: 'EntrepriseB', role: 'admin', entrepriseId: entrepriseB.id })
  const managerA = await ensureUser({ email: `qa.manager.a.${stamp}@velor-one.test`, password: tempPassword('managerA'), prenom: 'Manager', nom: 'EntrepriseA', role: 'responsable', entrepriseId: entrepriseA.id })
  const chefA = await ensureUser({ email: `qa.chef.a.${stamp}@velor-one.test`, password: tempPassword('chefA'), prenom: 'Chef', nom: 'EntrepriseA', role: 'chef_equipe', entrepriseId: entrepriseA.id })
  const employeA1 = await ensureUser({ email: `qa.employe1.a.${stamp}@velor-one.test`, password: tempPassword('employeA1'), prenom: 'Employe1', nom: 'EntrepriseA', role: 'employe', entrepriseId: entrepriseA.id })
  const employeA2 = await ensureUser({ email: `qa.employe2.a.${stamp}@velor-one.test`, password: tempPassword('employeA2'), prenom: 'Employe2', nom: 'EntrepriseA', role: 'employe', entrepriseId: entrepriseA.id })

  await attachEmployee({ userId: adminA.userId, entrepriseId: entrepriseA.id, siteId: siteA.id, departementId: deptA.id, equipeId: equipeA.id, posteId: posteAdminA.id, role: 'admin' })
  await attachEmployee({ userId: adminB.userId, entrepriseId: entrepriseB.id, siteId: siteB.id, departementId: deptB.id, equipeId: equipeB.id, posteId: posteAdminB.id, role: 'admin' })
  await attachEmployee({ userId: managerA.userId, entrepriseId: entrepriseA.id, siteId: siteA.id, departementId: deptA.id, equipeId: equipeA.id, posteId: posteManagerA.id, role: 'responsable' })
  await attachEmployee({ userId: chefA.userId, entrepriseId: entrepriseA.id, siteId: siteA.id, departementId: deptA.id, equipeId: equipeA.id, posteId: posteChefA.id, role: 'chef_equipe' })
  await attachEmployee({ userId: employeA1.userId, entrepriseId: entrepriseA.id, siteId: siteA.id, departementId: deptA.id, equipeId: equipeA.id, posteId: posteEmployeA.id, role: 'employe' })
  await attachEmployee({ userId: employeA2.userId, entrepriseId: entrepriseA.id, siteId: siteA.id, departementId: deptA.id, equipeId: equipeA.id, posteId: posteEmployeA.id, role: 'employe' })

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(today.getDate() + 2)
  const isoDate = (date) => date.toISOString().slice(0, 10)
  const isoDateTime = (date, hour, minute = 0) => {
    const copy = new Date(date)
    copy.setHours(hour, minute, 0, 0)
    return copy.toISOString()
  }

  await createDemoShift(entrepriseA.id, managerA.userId, equipeA.id, siteA.id, deptA.id, adminA.userId, isoDate(today), '08:00', '16:00', 'travail', 'Service manager')
  await createDemoShift(entrepriseA.id, chefA.userId, equipeA.id, siteA.id, deptA.id, adminA.userId, isoDate(today), '09:00', '17:00', 'travail', 'Service chef')
  await createDemoShift(entrepriseA.id, employeA1.userId, equipeA.id, siteA.id, deptA.id, managerA.userId, isoDate(today), '10:00', '18:00', 'travail', 'Service employé 1')
  await createDemoShift(entrepriseA.id, employeA2.userId, equipeA.id, siteA.id, deptA.id, managerA.userId, isoDate(tomorrow), '09:00', '17:00', 'formation', 'Formation client')

  await createDemoTask(entrepriseA.id, employeA1.userId, managerA.userId, 'Préparer l accueil', isoDateTime(today, 11))
  await createDemoTask(entrepriseA.id, chefA.userId, managerA.userId, 'Vérifier le planning', isoDateTime(today, 14))
  await createDemoReminder(entrepriseA.id, managerA.userId, employeA1.userId, 'Rappel accueil', isoDateTime(today, 16))
  await createDemoLeave(entrepriseA.id, employeA2.userId, managerA.userId, isoDate(dayAfter), isoDate(dayAfter))
  await createDemoMessage(entrepriseA.id, managerA.userId, chefA.userId, 'Brief équipe pour demain')

  console.log(JSON.stringify({
    super_admin: superAdmin,
    entreprise_a: entrepriseA,
    entreprise_b: entrepriseB,
    accounts: {
      admin_a: adminA,
      admin_b: adminB,
      manager_a: managerA,
      chef_a: chefA,
      employe_a_1: employeA1,
      employe_a_2: employeA2,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
