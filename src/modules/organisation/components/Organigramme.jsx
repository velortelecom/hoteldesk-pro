// ============================================================
// MODULE ORGANISATION — Organigramme.jsx
// Vue hierarchique : Direction -> Responsables -> Employes
// Basee sur les roles, postes et departements de l'entreprise (fonctionne pour tous les secteurs).
// ============================================================
import React from 'react';
import { useEmployes, useDepartements } from '../hooks.js';
import { ROLE_COLORS } from '../config.js';

export default function Organigramme({ entrepriseId }) {
  const { employes, loading, error } = useEmployes(entrepriseId, { includeInactif: false });
  const { departements } = useDepartements(entrepriseId);

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Chargement de l'organigramme...</div>
  );
  if (error) return (
    <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', color: '#ef4444' }}>Erreur : {error}</div>
  );

  const direction = employes.filter(e => e.role === 'admin');
  const responsables = employes.filter(e => e.role === 'responsable');
  const salaries = employes.filter(e => e.role === 'employe');

  const deptNom = (deptId) => departements.find(d => d.id === deptId)?.nom || 'Sans departement';
  const deptPrincipal = (e) => {
    const depts = e.employe_departements || [];
    const principal = depts.find(d => d.est_principal) || depts[0];
    return principal?.departement_id || null;
  };

  const groupByDept = (liste) => {
    const groupes = {};
    liste.forEach(e => {
      const key = deptPrincipal(e) || 'aucun';
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(e);
    });
    return groupes;
  };

  const groupesResponsables = groupByDept(responsables);
  const groupesSalaries = groupByDept(salaries);

  const tousLesGroupes = Array.from(new Set([...Object.keys(groupesResponsables), ...Object.keys(groupesSalaries)]));

  if (employes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
        <p>Aucun employe actif pour construire l'organigramme.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '2rem' }}>
      <Niveau titre="Direction">
        {direction.length === 0 ? (
          <Vide texte="Aucun admin" />
        ) : (
          direction.map(e => <CarteEmploye key={e.id} employe={e} />)
        )}
      </Niveau>

      <Trait />

      <Niveau titre="Responsables">
        {responsables.length === 0 ? (
          <Vide texte="Aucun responsable" />
        ) : (
          tousLesGroupes.map(key => (groupesResponsables[key] || []).length > 0 && (
            <GroupeDepartement key={'resp-' + key} nom={key === 'aucun' ? 'Sans departement' : deptNom(key)}>
              {groupesResponsables[key].map(e => <CarteEmploye key={e.id} employe={e} />)}
            </GroupeDepartement>
          ))
        )}
      </Niveau>

      <Trait />

      <Niveau titre="Employes">
        {salaries.length === 0 ? (
          <Vide texte="Aucun employe" />
        ) : (
          tousLesGroupes.map(key => (groupesSalaries[key] || []).length > 0 && (
            <GroupeDepartement key={'emp-' + key} nom={key === 'aucun' ? 'Sans departement' : deptNom(key)}>
              {groupesSalaries[key].map(e => <CarteEmploye key={e.id} employe={e} />)}
            </GroupeDepartement>
          ))
        )}
      </Niveau>
    </div>
  );
}

function Niveau({ titre, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', textAlign: 'center' }}>
        {titre}
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

function GroupeDepartement({ nom, children }) {
  return (
    <div style={{ border: '1px dashed #d1d5db', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>{nom}</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

function CarteEmploye({ employe }) {
  const initiales = `${employe.prenom?.[0] || ''}${employe.nom?.[0] || ''}`.toUpperCase();
  const roleColor = ROLE_COLORS[employe.role] || '#6b7280';
  return (
    <div style={{
      background: 'white', border: `1px solid ${roleColor}40`, borderRadius: '10px',
      padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: '150px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', background: employe.couleur || roleColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
      }}>
        {employe.photo_url ? (
          <img src={employe.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initiales}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {employe.prenom} {employe.nom}
        </div>
        {employe.poste && (
          <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{employe.poste.nom}</div>
        )}
      </div>
    </div>
  );
}

function Trait() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0 1rem' }}>
      <div style={{ width: '2px', height: '24px', background: '#e5e7eb' }} />
    </div>
  );
}

function Vide({ texte }) {
  return <div style={{ color: '#9ca3af', fontSize: '0.8125rem', fontStyle: 'italic' }}>{texte}</div>;
}
