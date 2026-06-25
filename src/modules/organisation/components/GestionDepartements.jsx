// ============================================================
// MODULE ORGANISATION — GestionDepartements.jsx
// Gestion des départements (CRUD complet)
// ============================================================

import React, { useState } from 'react';
import { useDepartements } from '../hooks.js';
import { DEPT_COLORS, DEPT_ICONS } from '../config.js';

const DEFAULT_FORM = { nom: '', code: '', description: '', couleur: '#6366f1', icone: 'building', ordre: 0 };

export default function GestionDepartements({ entrepriseId, permissions }) {
  const { departements, loading, error, create, update, toggle } = useDepartements(entrepriseId);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const handleEdit = (dept) => {
    setForm({ nom: dept.nom || '', code: dept.code || '', description: dept.description || '', couleur: dept.couleur || '#6366f1', icone: dept.icone || 'building', ordre: dept.ordre || 0 });
    setEditId(dept.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await update(editId, form);
      } else {
        await create(form);
      }
      setShowForm(false);
      setEditId(null);
      setForm(DEFAULT_FORM);
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>⏳ Chargement...</div>;
  if (error) return <div style={{ padding: '1rem', color: '#ef4444' }}>❌ {error}</div>;

  return (
    <div>
      {/* Header avec bouton création */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>🏢 Départements</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>{departements.length} département{departements.length !== 1 ? 's' : ''} actif{departements.length !== 1 ? 's' : ''}</p>
        </div>
        {permissions.canManageDepts && (
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_FORM); }}
            style={{ padding: '0.625rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
            + Nouveau département
          </button>
        )}
      </div>

      {/* Formulaire création/édition */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#111827', fontWeight: 600 }}>{editId ? '✏️ Modifier' : '➕ Nouveau département'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Nom *</label>
                <input required value={form.nom} onChange={e => setForm(p => ({...p, nom: e.target.value}))} placeholder="Ex: Réception"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Code</label>
                <input value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} placeholder="Ex: REC"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Description</label>
                <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Description du département"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Couleur</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {DEPT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({...p, couleur: c}))}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: form.couleur === c ? '3px solid #111827' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Ordre d'affichage</label>
                <input type="number" min="0" value={form.ordre} onChange={e => setForm(p => ({...p, ordre: parseInt(e.target.value) || 0}))}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                Annuler
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '0.625rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                {saving ? '⏳ Sauvegarde...' : editId ? '✅ Modifier' : '➕ Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des départements */}
      {departements.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
          <p>Aucun département créé</p>
          {permissions.canManageDepts && <p style={{ fontSize: '0.875rem' }}>Cliquez sur "+ Nouveau département" pour commencer.</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {departements.map(dept => (
            <DepartementCard key={dept.id} dept={dept} permissions={permissions} onEdit={() => handleEdit(dept)} onToggle={() => toggle(dept.id, !dept.actif)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DepartementCard({ dept, permissions, onEdit, onToggle }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${dept.couleur || '#6366f1'}` }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: (dept.couleur || '#6366f1') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
        {dept.icone === 'door-open' ? '🚪' : dept.icone === 'coffee' ? '☕' : dept.icone === 'sparkles' ? '✨' : dept.icone === 'wrench' ? '🔧' : '🏢'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {dept.nom}
          {dept.code && <span style={{ fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{dept.code}</span>}
          {!dept.actif && <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f9fafb', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>Inactif</span>}
        </div>
        {dept.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{dept.description}</p>}
      </div>
      {permissions.canManageDepts && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onEdit} style={{ padding: '0.375rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}>✏️ Modifier</button>
          <button onClick={onToggle} style={{ padding: '0.375rem 0.75rem', background: dept.actif ? '#fef3c7' : '#d1fae5', border: '1px solid ' + (dept.actif ? '#fbbf24' : '#6ee7b7'), borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', color: dept.actif ? '#92400e' : '#065f46' }}>
            {dept.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      )}
    </div>
  );
}
