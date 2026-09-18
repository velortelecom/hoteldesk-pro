import { useCallback, useEffect, useState } from 'react'
import { getEtatJour, getPointages, getPointageSettings, getSitesSummary, getTodaySummary } from './services.js'

const EMPTY_STATS = {
  totalEmployes: 0,
  present: 0,
  absents: 0,
  retards: 0,
  tempsTotal: '0h',
}

export function usePointageStats(profile) {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadStats() {
      try {
        const nextStats = await getTodaySummary(profile)
        if (isMounted) {
          setStats(nextStats)
          setError(null)
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError?.message || 'Erreur lors du chargement du tableau de bord.')
          setStats(EMPTY_STATS)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      isMounted = false
    }
  }, [profile?.id, profile?.entreprise_id])

  return { stats, loading, error }
}

export function usePointages(profile) {
  const [pointages, setPointages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadPointages() {
      try {
        const nextPointages = await getPointages(profile)
        if (isMounted) {
          setPointages(nextPointages)
          setError(null)
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError?.message || 'Erreur lors du chargement de l’historique.')
          setPointages([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadPointages()

    return () => {
      isMounted = false
    }
  }, [profile?.id, profile?.entreprise_id])

  return { pointages, loading, error }
}

export function usePointageSettings(profile) {
  // null tant qu'on ne sait pas : retomber sur des valeurs par defaut
  // ferait afficher des reglages que personne n'a choisis, sans le dire.
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      try {
        const nextSettings = await getPointageSettings(profile)
        if (isMounted) {
          setSettings(nextSettings)
          setError(null)
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError?.message || 'Erreur lors du chargement des paramètres.')
          setSettings(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [profile?.id, profile?.entreprise_id])

  return { settings, loading, error }
}

export function useSitesSummary(profile) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadSites() {
      try {
        const nextSites = await getSitesSummary(profile)
        if (isMounted) {
          setSites(nextSites)
          setError(null)
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError?.message || 'Erreur lors du chargement des sites.')
          setSites([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadSites()

    return () => {
      isMounted = false
    }
  }, [profile?.id, profile?.entreprise_id])

  return { sites, loading, error }
}

/**
 * L'etat de la journee en cours de la personne connectee.
 *
 * recharger() est expose pour que l'ecran puisse se remettre a jour
 * apres un pointage, sans recharger toute la page.
 */
export function useEtatJour(profile) {
  const [etat, setEtat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const charger = useCallback(async () => {
    if (!profile?.id) { setEtat(null); setLoading(false); return }
    setLoading(true)
    try {
      const prochain = await getEtatJour(profile)
      setEtat(prochain)
      setError(null)
    } catch (err) {
      setError(err?.message || 'Impossible de lire votre journee en cours.')
      setEtat(null)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { charger() }, [charger])

  return { etat, loading, error, recharger: charger }
}
