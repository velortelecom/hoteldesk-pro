import { useEffect, useState } from 'react'
import { DEFAULT_POINTAGE_SETTINGS } from './config.js'
import { getPointages, getPointageSettings, getSitesSummary, getTodaySummary } from './services.js'

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
  const [settings, setSettings] = useState(DEFAULT_POINTAGE_SETTINGS)
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
          setSettings(DEFAULT_POINTAGE_SETTINGS)
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
