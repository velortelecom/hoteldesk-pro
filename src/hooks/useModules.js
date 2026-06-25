// src/hooks/useModules.js
// Hook pour gerer les modules actives par entreprise
// V3 : connecte a App.jsx pour la navigation dynamique
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { planAllows, SOCLE_MENUS, MODULE_ROUTES } from '../lib/modules'

export function useModules() {
  const { profile } = useAuth()
  const [modulesActifs, setModulesActifs] = useState([])
  const [catalogue, setCatalogue] = useState([])
  const [loading, setLoading] = useState(true)
  const [entreprise, setEntreprise] = useState(null)

  const fetchModules = useCallback(async () => {
    setLoading(true)

    // Charger le catalogue complet (visible pour tous les authentifies)
    const { data: cat } = await supabase
      .from('modules_catalogue')
      .select('*')
      .eq('actif', true)
      .order('ordre')
    if (cat) setCatalogue(cat)

    // Si pas d'entreprise liee : aucun module supplementaire
    if (!profile?.entreprise_id) {
      setModulesActifs([])
      setEntreprise(null)
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
    const { data: mods, error } = await supabase
      .from('entreprise_modules')
      .select('*, module:modules_catalogue(*)')
      .eq('entreprise_id', profile.entreprise_id)
      .eq('actif', true)
    if (!error && mods) setModulesActifs(mods)

    setLoading(false)
  }, [profile?.entreprise_id, profile?.is_super_admin])

  useEffect(() => {
    if (profile !== undefined) fetchModules()
  }, [fetchModules])

  // Verifie si un module est actif pour cette entreprise
  function isModuleActive(moduleId) {
    if (profile?.is_super_admin) return true // super_admin voit tout
    return modulesActifs.some(m => m.module_id === moduleId && m.actif)
  }

  // Verifie si le plan de l'entreprise permet un module
  function canAccessModule(planMinimum) {
    if (profile?.is_super_admin) return true
    if (!entreprise) return false
    return planAllows(entreprise.plan, planMinimum)
  }

  // Retourne la liste des menus dynamiques des modules actifs
  // (pour injection dans NAV de App.jsx)
  function getModuleMenus() {
    if (profile?.is_super_admin) {
      // super_admin : voir tous les modules du catalogue comme items de nav
      return catalogue
        .filter(m => MODULE_ROUTES[m.id])
        .map(m => ({
          id: m.id,
          label: m.nom,
          path: MODULE_ROUTES[m.id],
          icone: m.icone,
          isModule: true,
        }))
    }
    // Utilisateur normal : seulement les modules actives pour son entreprise
    return modulesActifs
      .filter(m => m.module && MODULE_ROUTES[m.module_id])
      .map(m => ({
        id: m.module_id,
        label: m.module.nom,
        path: MODULE_ROUTES[m.module_id],
        icone: m.module.icone,
        isModule: true,
        description: m.module.description,
      }))
  }

  // Construit la navigation complete : socle + modules actifs
  function buildNavigation() {
    return [...SOCLE_MENUS, ...getModuleMenus()]
  }

  // Retourne les IDs des modules actifs (pour la protection des routes)
  function getActiveModuleIds() {
    if (profile?.is_super_admin) return catalogue.map(m => m.id)
    return modulesActifs.filter(m => m.actif).map(m => m.module_id)
  }

  return {
    modulesActifs,
    catalogue,
    entreprise,
    loading,
    isModuleActive,
    canAccessModule,
    buildNavigation,
    getModuleMenus,
    getActiveModuleIds,
    refetch: fetchModules,
  }
}
