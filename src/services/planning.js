import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
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

export async function fetchPlanningEntries(profile, currentMonth) {
  const enterpriseId = requireEnterpriseId(profile)
  const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
  const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

  const [{ data: shifts = [], error: shiftsError }, { data: conges = [], error: congesError }] = await Promise.all([
    supabase
      .from('shifts')
      .select('*, employe:profiles!shifts_employe_id_fkey(id,nom,prenom,couleur,avatar_initiales,departement), site:sites(id,nom), departement:departements(id,nom,code), equipe:equipes(id,nom,code)')
      .eq('entreprise_id', enterpriseId)
      .gte('date_shift', from)
      .lte('date_shift', to)
      .neq('statut', 'annule'),
    supabase
      .from('conges')
      .select('id, employe_id, type_conge, date_debut, date_fin, statut, employe:profiles!conges_employe_id_fkey(id,nom,prenom,couleur,avatar_initiales,departement)')
      .eq('entreprise_id', enterpriseId)
      .eq('statut', 'approuve')
      .lte('date_debut', to)
      .gte('date_fin', from),
  ])

  if (shiftsError) throw shiftsError
  if (congesError) throw congesError

  const shiftEntries = (shifts || []).map((shift) => ({
    id: shift.id,
    kind: 'shift',
    date_key: shift.date_shift,
    title: shift.type_shift,
    categorie: shift.departement?.code || shift.employe?.departement || 'admin',
    statut: shift.statut,
    heure_debut: shift.heure_debut,
    heure_fin: shift.heure_fin,
    employe_id: shift.employe_id,
    assignee: shift.employe,
    site: shift.site,
    departement: shift.departement,
    equipe: shift.equipe,
    notes: shift.notes,
    pause_minutes: shift.pause_minutes,
    type_shift: shift.type_shift,
  }))

  const congeEntries = (conges || []).flatMap((conge) => {
    const days = eachDayOfInterval({
      start: new Date(conge.date_debut + 'T00:00:00'),
      end: new Date(conge.date_fin + 'T00:00:00'),
    })

    return days.map((day) => ({
      id: `${conge.id}-${format(day, 'yyyy-MM-dd')}`,
      source_id: conge.id,
      kind: 'conge',
      date_key: format(day, 'yyyy-MM-dd'),
      title: conge.type_conge,
      categorie: 'absence',
      statut: conge.statut,
      heure_debut: '00:00:00',
      heure_fin: '23:59:00',
      employe_id: conge.employe_id,
      assignee: conge.employe,
      type_conge: conge.type_conge,
    }))
  })

  return [...shiftEntries, ...congeEntries]
}

export async function createQuickPlanningShift(profile, quickForm, quickCreateDate) {
  const enterpriseId = requireEnterpriseId(profile)
  const profileId = requireProfileId(profile)

  const { error } = await supabase.from('shifts').insert({
    entreprise_id: enterpriseId,
    employe_id: quickForm.employe_id || profileId,
    departement_id: quickForm.departement_id || null,
    site_id: quickForm.site_id || null,
    equipe_id: quickForm.equipe_id || null,
    date_shift: quickCreateDate,
    heure_debut: quickForm.heure_debut || '09:00:00',
    heure_fin: quickForm.heure_fin || '17:00:00',
    pause_minutes: Number(quickForm.pause_minutes || 0),
    statut: 'publie',
    type_shift: quickForm.type_shift || 'travail',
    notes: quickForm.notes?.trim() || null,
    created_by: profileId,
    updated_by: profileId,
    published_at: new Date().toISOString(),
  })

  if (error) throw error
}
