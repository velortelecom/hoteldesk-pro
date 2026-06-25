// ============================================================
// MODULE ORGANISATION — ListeEmployes.jsx
// Liste des employés avec filtres et actions
// ============================================================

import React, { useState } from 'react';
import { useEmployes } from '../hooks.js';
import { ROLE_COLORS } from '../config.js';

const ROLE_LABELS = {
  admin: 'Admin',
  responsable: 'Responsable',
  employe: 'Employé',
  super_admin: 'Super Admin',
};

export default function ListeEmployes({ entrepriseId, permissions, onViewEmploye }) {
  const { employes, loading, error, desactiver, reactiver } = useEmployes(entrepriseId, { includeInactif: false });
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [showInactif, setShowInactif] = useState(false);
  const { employes: tous } = useEmployes(entrepriseId, { includeInactif: true });

  const list = (showInactif ? tous : employes).filter(e => {
    const fullName = `${e.prenom} ${e.nom}`.toLowerCase();
    const matchSearch = !search || fullName.includes(search.toLowerCase());
    const depts = e.employe_departements || [];
    const matchDept = !filterDept || depts.some(d => d.departement?.id === filterDept);
    return matchSearch && matchDept;
  });

  // Collecter tous les départements uniques
  const allDepts = [];
  tous.forEach(e => {
    (e.employe_departements || []).forEach(ed => {
      if (ed.departement && !allDepts.find(d => d.id === ed.departement.id)) {
        allDepts.push(ed.departement);
      }
    });
  });

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <div style={{ color: '#6b7280' }}>⏳ Chargement des employés...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', color: '#ef4444' }}>
      ❌ Erreur : {error}
    </div>
  );

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Rechercher un employé..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '0.625rem 1rem',
            border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem',
          }}
        />
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
        >
          <option value="">Tous les départements</option>
          {allDepts.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactif} onChange={e => setShowInactif(e.target.checked)} />
          Inclure inactifs
        </label>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: 'auto' }}>
          {list.length} employé{list.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tableau */}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
          <p>Aucun employé trouvé</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {list.map(employe => (
            <EmployeCard
              key={employe.id}
              employe={employe}
              permissions={permissions}
              onView={() => onViewEmploye(employe.id)}
              onDesactiver={() => desactiver(employe.id)}
              onReactiver={() => reactiver(employe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeCard({ employe, permissions, onView, onDesactiver, onReactiver }) {
  const initiales = `${employe.prenom?.[0] || ''}${employe.nom?.[0] || ''}`.toUpperCase();
  const roleColor = ROLE_COLORS[employe.role] || '#6b7280';
  const depts = employe.employe_departements || [];
  const poste = employe.poste;

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
      padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
      opacity: employe.actif ? 1 : 0.6, transition: 'box-shadow 0.15s',
      cursor: 'pointer',
    }}
      onClick={onView}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Avatar */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: employe.avatar_couleur || '#6366f1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
      }}>
        {employe.photo_url ? (
          <img src={employe.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initiales}
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>
            {employe.prenom} {employe.nom}
          </span>
          <span style={{
            fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px',
            background: roleColor + '20', color: roleColor, fontWeight: 500,
          }}>
            {ROLE_LABELS[employe.role] || employe.role}
          </span>
          {!employe.actif && (
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f3f4f6', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
              Inactif
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {poste && <span>💼 {poste.nom}</span>}
          {depts.length > 0 && (
            <span>
              🏢 {depts.slice(0, 2).map(d => d.departement?.nom).filter(Boolean).join(', ')}
              {depts.length > 2 && ` +${depts.length - 2}`}
            </span>
          )}
          {employe.email && <span>✉️ {employe.email}</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onView}
          style={{
            padding: '0.375rem 0.75rem', background: '#6366f1', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem',
          }}
        >
          Voir fiche
        </button>
        {permissions.canEdit && (
          employe.actif ? (
            <button
              onClick={onDesactiver}
              style={{
                padding: '0.375rem 0.75rem', background: '#f3f4f6', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem',
              }}
            >
              Désactiver
            </button>
          ) : (
            <button
              onClick={onReactiver}
              style={{
                padding: '0.375rem 0.75rem', background: '#d1fae5', color: '#065f46',
                border: '1px solid #6ee7b7', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem',
              }}
            >
              Réactiver
            </button>
          )
        )}
      </div>
    </div>
  );
}
