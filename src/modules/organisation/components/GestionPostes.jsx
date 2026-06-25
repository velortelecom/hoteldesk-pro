// ============================================================
// MODULE ORGANISATION — GestionPostes.jsx
// Gestion des postes de travail (CRUD complet)
// ============================================================

import React, { useState } from 'react';
import { usePostes, useDepartements } from '../hooks.js';
import { DEPT_COLORS, NIVEAUX_POSTE } from '../config.js';

const DEFAULT_FORM = { nom: '', departement_id: '', description: '', couleur: '#8b5cf6', icone: 'briefcase', niveau: 1, template_secteur_id: '' };

export default function GestionPostes({ entrepriseId, permissions }) {
  const { postes, loading, error, create, update, toggle } = usePostes(entrepriseId);
  const { departements } = useDepartements(entrepriseId);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [filterDept, setFilterDept] = useState('');

  const handleEdit = (poste) => {
    setForm({ nom: poste.nom || '', departement_id: poste.departement_id || '', description: poste.description || '', couleur: poste.couleur || '#8b5cf6', icone: poste.icone || 'briefcase', niveau: poste.niveau || 1, template_secteur_id: poste.template_secteur_id || '' });
    setEditId(poste.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) { await update(editId, form); }
      else { await create(form); }
      setShowForm(false);
      setEditId(null);
      setForm(DEFAULT_FORM);
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredPostes = filterDept ? postes.filter(p => p.departement_id === filterDept) : postes;

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>⏳ Chargement...</div>;
  if (error) return <div style={{ padding: '1rem', color: '#ef4444' }}>❌ {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>💼 Postes</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>{filteredPostes.length} poste{filteredPostes.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
            <option value="">Tous les départements</option>
            {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
          {permissions.canManagePostes && (
            <button onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_FORM); }}
              style={{ padding: '0.625rem 1.25rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
              + Nouveau poste
            </button>
          )}
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', color: '#111827', fontWeight: 600 }}>{editId ? '✏️ Modifier le poste' : '➕ Nouveau poste'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Nom du poste *</label>
                <input required value={form.nom} onChange={e => setForm(p => ({...p, nom: e.target.value}))} placeholder="Ex: Réceptionniste"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Département</label>
                <select value={form.departement_id} onChange={e => setForm(p => ({...p, departement_id: e.target.value}))}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                  <option value="">— Aucun —</option>
                  {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Description</label>
                <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Responsabilités du poste"
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#374151', fontWeight: 500, marginBottom: '0.375rem' }}>Niveau hiérarchique</label>
                <select value={form.niveau} onChange={e => setForm(p => ({...p, niveau: parseInt(e.target.value)}))}
                  style={{ width: '100%', padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                  {NIVEAUX_POSTE.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
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
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>Annuler</button>
              <button type="submit" disabled={saving}
                style={{ padding: '0.625rem 1.25rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                {saving ? '⏳...' : editId ? '✅ Modifier' : '➕ Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des postes groupés par niveau */}
      {filteredPostes.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div>
          <p>Aucun poste créé</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {filteredPostes.sort((a, b) => b.niveau - a.niveau).map(poste => {
            const dept = departements.find(d => d.id === poste.departement_id);
            const niveau = NIVEAUX_POSTE.find(n => n.value === poste.niveau);
            return (
              <div key={poste.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${poste.couleur || '#8b5cf6'}` }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: (poste.couleur || '#8b5cf6') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>💼</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {poste.nom}
                    {niveau && <span style={{ fontSize: '0.75rem', color: poste.couleur || '#8b5cf6', background: (poste.couleur || '#8b5cf6') + '15', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>{niveau.label}</span>}
                    {dept && <span style={{ fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>🏢 {dept.nom}</span>}
                  </div>
                  {poste.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{poste.description}</p>}
                </div>
                {permissions.canManagePostes && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleEdit(poste)} style={{ padding: '0.375rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem' }}>✏️</button>
                    <button onClick={() => toggle(poste.id, !poste.actif)} style={{ padding: '0.375rem 0.75rem', background: poste.actif ? '#fef3c7' : '#d1fae5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', color: poste.actif ? '#92400e' : '#065f46' }}>
                      {poste.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
      }
