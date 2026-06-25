// ============================================================
// MODULE ORGANISATION — index.jsx
// Composant principal du module (v1.0.0)
// Interface : Employés, Départements, Postes, Organigramme
// ============================================================

import React, { useState, useMemo } from 'react';
import { getPermissionsForRole } from './permissions.js';
import { MODULE_TABS } from './config.js';
import { useDepartements, usePostes, useEmployes, useStatsOrganisation } from './hooks.js';

// Sous-composants
import ListeEmployes from './components/ListeEmployes.jsx';
import FicheEmploye from './components/FicheEmploye.jsx';
import GestionDepartements from './components/GestionDepartements.jsx';
import GestionPostes from './components/GestionPostes.jsx';

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function OrganisationModule({ user, entrepriseId }) {
  const [activeTab, setActiveTab] = useState('employes');
  const [selectedEmployeId, setSelectedEmployeId] = useState(null);

  const permissions = useMemo(() => getPermissionsForRole(user?.role || 'employe'), [user?.role]);
  const { stats } = useStatsOrganisation(entrepriseId);

  // Navigation vers la fiche employé
  const handleViewEmploye = (id) => {
    setSelectedEmployeId(id);
    setActiveTab('fiche');
  };

  const handleBackToList = () => {
    setSelectedEmployeId(null);
    setActiveTab('employes');
  };

  if (!permissions.canView) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2>Accès non autorisé</h2>
        <p>Vous n&apos;avez pas la permission d&apos;accéder au module Organisation.</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
            🏢 Organisation
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            {stats.totalEmployes} employé{stats.totalEmployes !== 1 ? 's' : ''} •{' '}
            {stats.totalDepartements} département{stats.totalDepartements !== 1 ? 's' : ''} •{' '}
            {stats.totalPostes} poste{stats.totalPostes !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      {activeTab !== 'fiche' && (
        <div style={{
          background: 'white', borderBottom: '1px solid #e5e7eb',
          padding: '0 2rem', display: 'flex', gap: '0'
        }}>
          {MODULE_TABS.filter(t => t.id !== 'organigramme').map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === tab.id ? '#6366f1' : '#6b7280',
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
      )}

      {/* Contenu */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
        {activeTab === 'employes' && (
          <ListeEmployes
            entrepriseId={entrepriseId}
            permissions={permissions}
            onViewEmploye={handleViewEmploye}
          />
        )}

        {activeTab === 'fiche' && selectedEmployeId && (
          <FicheEmploye
            employeId={selectedEmployeId}
            entrepriseId={entrepriseId}
            permissions={permissions}
            onBack={handleBackToList}
          />
        )}

        {activeTab === 'departements' && (
          <GestionDepartements
            entrepriseId={entrepriseId}
            permissions={permissions}
          />
        )}

        {activeTab === 'postes' && (
          <GestionPostes
            entrepriseId={entrepriseId}
            permissions={permissions}
          />
        )}
      </div>
    </div>
  );
}

// Métadonnées du module (utilisées par le Plugin System)
OrganisationModule.moduleId = 'organisation';
OrganisationModule.version = '1.0.0';
