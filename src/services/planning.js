import { endOfMonth, startOfMonth } from 'date-fns'
import { supabase } from '../lib/supabase'
import { requireEnterpriseId, requireProfileId } from './enterprise'

export async function fetchPlanningEmployees(profile, userRole, userDept) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)

  let query = supabase
    .from('profiles')
    .select('id,nom,prenom,couleur,avatar_initiales,departement')
    .eq('entreprise_id', enterpriseId)
    .eq('actif', true)

  if (userRole === 'responsable') query = query.eq('departement', userDept)
  if (userRole === 'employe') query = query.eq('id', profileId)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchPlanningTasks(profile, currentMonth) {
  const enterpriseId = requireEnterpriseId(profile)
  const from = startOfMonth(currentMonth).toISOString()
  const to = endOfMonth(currentMonth).toISOString()

  const { data, error } = await supabase
    .from('taches')
    .select('*, assignee:profiles!taches_assigne_a_fkey(id,nom,prenom,couleur,avatar_initiales)')
    .eq('entreprise_id', enterpriseId)
    .gte('date_echeance', from)
    .lte('date_echeance', to)
    .neq('statut', 'annulee')

  if (error) throw error
  return data || []
}

export async function createQuickPlanningTask(profile, quickForm, quickCreateDate) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)
  const dateStr = quickCreateDate + 'T09:00:00'

  const { error } = await supabase.from('taches').insert({
    titre: quickForm.titre.trim(),
    categorie: quickForm.categorie,
    priorite: quickForm.priorite,
    statut: 'planifiee',
    date_echeance: dateStr,
    entreprise_id: enterpriseId,
    assigne_a: profileId,
  })

  if (error) throw error
}
