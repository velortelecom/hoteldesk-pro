// src/hooks/useModules.js
// Hook pour gerer les modules actives par entreprise
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { planAllows, SOCLE_MENUS, MODULE_ROUTES } from '../lib/modules'

export function useModules() {
  const { profile } = useAuth()
  const [modulesActifs, setModulesActifs] = useState([])
  const [catalogue, setCatalogue] = useState([])
  const [loading, setLoading] = useState(true)
  const [entreprise, setEntreprise] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchModules()
  }, [profile])

  async function fetchModules() {
    setLoading(true)

    // Charger le catalogue complet
    const { data: cat } = await supabase
      .from('modules_catalogue')
      .select('*')
      .eq('actif', true)
      .order('ordre')
    if (cat) setCatalogue(cat)

    // Si pas d'entreprise liee, pas de modules supplementaires
    if (!profile?.entreprise_id) {
      setLoading(false)
      return
    }

    // Charger l'entreprise pour connaitre le plan
    const { data: ent } = await supabase
      .from('entreprises')
      .select('*')
      .eq('id', profile.entreprise_id)
      .single()
    if (ent) setEntreprise(ent)

    // Charger les modules actives pour cette entreprise
    const { data: mods } = await supabase
      .from('entreprise_modules')
      .select('*, module:modules_catalogue(*)')
      .eq('entreprise_id', profile.entreprise_id)
      .eq('actif', true)
    if (mods) setModulesActifs(mods)

    setLoading(false)
  }

  // Verifie si un module est actif pour cette entreprise
  function isModuleActive(moduleId) {
    return modulesActifs.some(m => m.module_id === moduleId)
  }

  // Verifie si le plan de l'entreprise permet un module
  function canAccessModule(planMinimum) {
    if (!entreprise) return false
    return planAllows(entreprise.plan, planMinimum)
  }

  // Construit la liste des menus dynamiques (socle + modules actifs)
  function buildNavigation() {
    const dynamicMenus = modulesActifs
      .filter(m => m.module && MODULE_ROUTES[m.module_id])
      .map(m => ({
        id: m.module_id,
        nom: m.module.nom,
        path: MODULE_ROUTES[m.module_id],
        icone: m.module.icone,
      }))
    return [...SOCLE_MENUS, ...dynamicMenus]
  }

  return {
    modulesActifs,
    catalogue,
    entreprise,
    loading,
    isModuleActive,
    canAccessModule,
    buildNavigation,
    refetch: fetchModules,
  }
}
