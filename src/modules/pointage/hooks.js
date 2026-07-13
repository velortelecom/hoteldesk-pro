import { useMemo } from 'react'
import { DEFAULT_POINTAGE_SETTINGS } from './config.js'
import { getMockPointages, getTodaySummary, getSitesSummary } from './services.js'

export function usePointageStats() {
  const summary = useMemo(() => getTodaySummary(), [])
  return {
    stats: summary,
    loading: false,
    error: null,
  }
}

export function usePointages() {
  const pointages = useMemo(() => getMockPointages(), [])
  return {
    pointages,
    loading: false,
    error: null,
  }
}

export function usePointageSettings() {
  return {
    settings: DEFAULT_POINTAGE_SETTINGS,
    loading: false,
    error: null,
  }
}

export function useSitesSummary() {
  const sites = useMemo(() => getSitesSummary(), [])
  return {
    sites,
    loading: false,
    error: null,
  }
}
