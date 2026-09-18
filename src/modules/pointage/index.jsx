import React, { useMemo, useState } from 'react'
import { MODULE_TABS } from './config.js'
import { getPermissionsForRole } from './permissions.js'
import { useEtatJour, usePointageStats, usePointages, usePointageSettings, useSitesSummary } from './hooks.js'

import DashboardPointage from './components/DashboardPointage.jsx'
import PointageEmploye from './components/PointageEmploye.jsx'
import HistoriquePointages from './components/HistoriquePointages.jsx'
import GestionSitesPointage from './components/GestionSitesPointage.jsx'
import ParametresPointage from './components/ParametresPointage.jsx'
import StatutPointage from './components/StatutPointage.jsx'
import CorrectionsPointage from './components/CorrectionsPointage.jsx'
import ExportPaie from './components/ExportPaie.jsx'

export default function PointageModule({ profile, permissions: permissionsLoader, moduleId }) {
  const [activeTab, setActiveTab] = useState('dashboard')

  const role = profile?.role || 'employe'
  const permissions = useMemo(() => getPermissionsForRole(role), [role])
  const canView = permissions.canView && (permissionsLoader?.voir ?? true)

  const { stats } = usePointageStats(profile)
  const { pointages, loading: chargementPointages, error: erreurPointages } = usePointages(profile)
  const { sites } = useSitesSummary(profile)
  const { settings, loading: chargementSettings, error: erreurSettings } = usePointageSettings(profile)
  const {
    etat: etatJour,
    loading: chargementEtat,
    error: erreurEtat,
    recharger: rechargerEtat,
  } = useEtatJour(profile)

  if (!canView) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2>Accès non autorisé</h2>
        <p>Vous n&apos;avez pas la permission d&apos;accéder au module Pointage.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      <div
        style={{
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
            ⏱️ Pointage
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            {stats.present} présent{stats.present !== 1 ? 's' : ''}
            {' • '}
            {stats.aCorriger} journée{stats.aCorriger !== 1 ? 's' : ''} à corriger
          </p>
        </div>
        <StatutPointage label="Système V1" tone="success" />
      </div>

      <div
        style={{
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 2rem',
          display: 'flex',
          gap: '0',
          overflowX: 'auto',
        }}
      >
        {MODULE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.875rem 1.25rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #0f766e' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? '#0f766e' : '#6b7280',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
        {activeTab === 'dashboard' && <DashboardPointage stats={stats} sites={sites} />}
        {activeTab === 'pointage' && (
          <PointageEmploye
            permissions={permissions}
            profile={profile}
            sites={sites}
            etatJour={etatJour}
            chargementEtat={chargementEtat}
            erreurEtat={erreurEtat}
            onPointage={rechargerEtat}
          />
        )}
        {activeTab === 'historique' && (
          <HistoriquePointages
            pointages={pointages}
            chargement={chargementPointages}
            erreur={erreurPointages}
          />
        )}
        {activeTab === 'corrections' && (
          <CorrectionsPointage
            journees={pointages}
            chargement={chargementPointages}
            erreur={erreurPointages}
          />
        )}
        {activeTab === 'paie' && <ExportPaie profile={profile} permissions={permissions} />}
        {activeTab === 'sites' && <GestionSitesPointage sites={sites} />}
        {activeTab === 'parametres' && (
          <ParametresPointage
            permissions={permissions}
            settings={settings}
            chargement={chargementSettings}
            erreur={erreurSettings}
          />
        )}

      </div>
    </div>
  )
}
