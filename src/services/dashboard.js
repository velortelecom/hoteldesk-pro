import { supabase } from '../lib/supabase'
import { requireEnterpriseId } from './enterprise'

export async function fetchDashboardTaskStats(profile) {
  const enterpriseId = requireEnterpriseId(profile)
  const { data, error } = await supabase
    .from('taches')
    .select('statut, priorite, categorie')
    .eq('entreprise_id', enterpriseId)

  if (error) throw error
  return data || []
}

export async function fetchDashboardTeam(profile) {
  const enterpriseId = requireEnterpriseId(profile)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, prenom, role, departement')
    .eq('entreprise_id', enterpriseId)
    .order('nom')

  if (error) throw error
  return data || []
}

export async function fetchDashboardRecentTasks(profile, limit = 5) {
  const enterpriseId = requireEnterpriseId(profile)
  const { data, error } = await supabase
    .from('taches')
    .select('id, titre, statut, priorite, categorie, created_at')
    .eq('entreprise_id', enterpriseId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
