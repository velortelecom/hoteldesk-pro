import React, { useState } from 'react';
import { useDepartements, useEquipes } from '../hooks.js';

const DEFAULT_FORM = { nom: '', code: '', description: '', couleur: '#0F766E', departement_id: '' };

export default function GestionEquipes({ entrepriseId, permissions }) {
  const { equipes, loading, error, create, update, toggle } = useEquipes(entrepriseId);
  const { departements } = useDepartements(entrepriseId);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const handleEdit = (equipe) => {
    setForm({
      nom: equipe.nom || '',
      code: equipe.code || '',
      description: equipe.description || '',
      couleur: equipe.couleur || '#0F766E',
      departement_id: equipe.departement_id || '',
    });
    setEditId(equipe.id);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editId) await update(editId, form);
      else await create(form);
      setShowForm(false);
      setEditId(null);
      setForm(DEFAULT_FORM);
    } catch (caughtError) {
      alert('Erreur : ' + caughtError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>⏳ Chargement...</div>;
  if (error) return <div style={{ padding: '1rem', color: '#ef4444' }}>❌ {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>👥 Équipes</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>{equipes.length} équipe{equipes.length !== 1 ? 's' : ''}</p>
        </div>
        {permissions.canManageDepts && (
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_FORM); }} style={{ padding: '0.625rem 1.25rem', background: '#0F766E', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
            + Nouvelle équipe
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#111827', fontWeight: 600 }}>{editId ? '✏️ Modifier l équipe' : '➕ Nouvelle équipe'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Nom *</label>
                <input required value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Code</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Département</label>
                <select value={form.departement_id} onChange={e => setForm(p => ({ ...p, departement_id: e.target.value }))} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                  <option value="">— Aucun —</option>
                  {departements.map((dept) => <option key={dept.id} value={dept.id}>{dept.nom}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Couleur</label>
                <input value={form.couleur} onChange={e => setForm(p => ({ ...p, couleur: e.target.value }))} style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>Annuler</button>
              <button type="submit" disabled={saving} style={{ padding: '0.625rem 1.25rem', background: '#0F766E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>{saving ? '⏳...' : editId ? '✅ Modifier' : '➕ Créer'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {equipes.map((equipe) => {
          const departement = departements.find((dept) => dept.id === equipe.departement_id);
          return (
            <div key={equipe.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${equipe.couleur || '#0F766E'}` }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: (equipe.couleur || '#0F766E') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>👥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {equipe.nom}
                  {equipe.code && <span style={{ fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{equipe.code}</span>}
                  {departement && <span style={{ fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>🏢 {departement.nom}</span>}
                </div>
                {equipe.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{equipe.description}</p>}
              </div>
              {permissions.canManageDepts && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleEdit(equipe)} style={{ padding: '0.375rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}>✏️</button>
                  <button onClick={() => toggle(equipe.id, !equipe.actif)} style={{ padding: '0.375rem 0.75rem', background: equipe.actif ? '#fef3c7' : '#d1fae5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', color: equipe.actif ? '#92400e' : '#065f46' }}>{equipe.actif ? 'Désactiver' : 'Réactiver'}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}