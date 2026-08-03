// ============================================================
// MODULE ORGANISATION — FicheEmploye.jsx
// Fiche complète d'un employé
// ============================================================

import React, { useState, useEffect } from 'react';
import { useEmployeDetail, useDepartements, usePostes } from '../hooks.js';
import { ROLE_COLORS, NIVEAUX_POSTE } from '../config.js';
import { updateEmploye, setEmployeDepartements, desactiverEmploye, reactiversEmploye, changerRoleEmploye, supprimerEmploye, reinitialiserMotDePasseEmploye, getSites } from '../services.js';

const ROLE_LABELS = { admin: 'Admin', responsable: 'Responsable', chef_equipe: 'Chef d équipe', employe: 'Employé', super_admin: 'Super Admin' };
const LANGUE_LABELS = { fr: 'Français', en: 'English', es: 'Español', ar: 'Arabe' };

export default function FicheEmploye({ employeId, entrepriseId, permissions, profile, onBack }) {
  const { employe, loading, error } = useEmployeDetail(employeId);
  const { departements } = useDepartements(entrepriseId);
  const { postes } = usePostes(entrepriseId);
  const [sites, setSites] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [principalDept, setPrincipalDept] = useState(null);

  React.useEffect(() => {
    if (employe) {
      setForm({
        prenom: employe.prenom || '',
        nom: employe.nom || '',
        telephone: employe.telephone || '',
        poste_id: employe.poste_id || '',
        poste_secondaire_id: employe.poste_secondaire_id || '',
        site_id: employe.site_id || '',
        date_entree: employe.date_entree || '',
        notes_internes: employe.notes_internes || '',
        langue: employe.langue || 'fr',
        photo_url: employe.photo_url || '',
      });
      const depts = (employe.employe_departements || []).map(ed => ed.departement_id);
      setSelectedDepts(depts);
      const principal = (employe.employe_departements || []).find(ed => ed.est_principal);
      setPrincipalDept(principal?.departement_id || depts[0] || null);
    }
  }, [employe]);

        useEffect(() => {
          let cancelled = false;
          if (entrepriseId) {
            getSites(entrepriseId)
            .then((data) => { if (!cancelled) setSites(data); })
            .catch((err) => { console.error('FicheEmploye: erreur chargement sites', err); });
          }
          return () => { cancelled = true; };
        }, [entrepriseId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEmploye(employeId, form);
      await setEmployeDepartements(employeId, entrepriseId, selectedDepts, principalDept);
      setEditMode(false);
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDept = (deptId) => {
    setSelectedDepts(prev => {
      const next = prev.includes(deptId) ? prev.filter(d => d !== deptId) : [...prev, deptId];
      if (!next.includes(principalDept)) setPrincipalDept(next[0] || null);
      return next;
    });
  };

  const [actionSaving, setActionSaving] = useState(false);
  const [nouveauRole, setNouveauRole] = useState('');
  const [creds, setCreds] = useState(null);

  const isSuperAdmin = profile?.is_super_admin === true;
  const isAdminEntreprise = profile?.role === 'admin' || isSuperAdmin;
  const canManageSensible = isAdminEntreprise;

  const handleToggleActif = async () => {
    if (!employe) return;
    setActionSaving(true);
    try {
      if (employe.actif) await desactiverEmploye(employeId);
      else await reactiversEmploye(employeId);
      window.location.reload();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setActionSaving(false);
    }
  };

  const handleChangerRole = async () => {
    if (!nouveauRole || nouveauRole === employe.role) return;
    if (!window.confirm(`Changer le rôle de ${employe.prenom} ${employe.nom} en "${ROLE_LABELS[nouveauRole] || nouveauRole}" ?`)) return;
    setActionSaving(true);
    try {
      await changerRoleEmploye(employeId, nouveauRole);
      window.location.reload();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setActionSaving(false);
    }
  };

  const handleReinitialiserMdp = async () => {
    if (!window.confirm(`Réinitialiser le mot de passe de ${employe.prenom} ${employe.nom} ?`)) return;
    setActionSaving(true);
    try {
      const result = await reinitialiserMotDePasseEmploye(employeId);
      setCreds({ prenom: employe.prenom, nom: employe.nom, email: result.email });
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setActionSaving(false);
    }
  };

  const handleSupprimer = async () => {
    if (!window.confirm(`Supprimer définitivement ${employe.prenom} ${employe.nom} ? Cette action est irréversible.`)) return;
    setActionSaving(true);
    try {
      await supprimerEmploye(employeId);
      onBack();
    } catch (err) {
      alert('Erreur : ' + err.message);
      setActionSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>⏳ Chargement...</div>;
  if (error) return <div style={{ padding: '1rem', color: '#ef4444' }}>❌ {error}</div>;
  if (!employe) return null;

  const initiales = `${employe.prenom?.[0] || ''}${employe.nom?.[0] || ''}`.toUpperCase();
  const roleColor = ROLE_COLORS[employe.role] || '#6b7280';

  return (
    <div>
      {/* Bouton retour */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: 500, marginBottom: '1.5rem', padding: 0 }}>
        ← Retour à la liste
      </button>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Header de la fiche */}
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.5rem', flexShrink: 0 }}>
            {employe.photo_url ? <img src={employe.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initiales}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>{employe.prenom} {employe.nom}</h2>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8125rem', fontWeight: 500 }}>
                {ROLE_LABELS[employe.role] || employe.role}
              </span>
              {employe.poste && <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8125rem' }}>💼 {employe.poste.nom}</span>}
            </div>
          </div>
          {permissions.canEdit && (
            <button onClick={() => editMode ? handleSave() : setEditMode(true)} disabled={saving}
              style={{ padding: '0.625rem 1.25rem', background: 'white', color: '#6366f1', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              {saving ? '⏳ Sauvegarde...' : editMode ? '✅ Enregistrer' : '✏️ Modifier'}
            </button>
          )}
          {editMode && <button onClick={() => setEditMode(false)} style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>Annuler</button>}
        </div>

        {/* Corps de la fiche */}
        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Infos personnelles */}
          <div>
            <h3 style={{ color: '#111827', fontWeight: 600, marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>👤 Informations personnelles</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Prénom" value={form?.prenom} onChange={v => setForm(p => ({...p, prenom: v}))} edit={editMode} />
              <Field label="Nom" value={form?.nom} onChange={v => setForm(p => ({...p, nom: v}))} edit={editMode} />
              <Field label="Email" value={employe.email} edit={false} />
              <Field label="Téléphone" value={form?.telephone} onChange={v => setForm(p => ({...p, telephone: v}))} edit={editMode} />
              <Field label="Date d'entrée" value={form?.date_entree} onChange={v => setForm(p => ({...p, date_entree: v}))} edit={editMode} type="date" />
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>Langue</label>
              {editMode ? (
                <select value={form?.langue || 'fr'} onChange={e => setForm(p => ({...p, langue: e.target.value}))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="ar">Arabe</option>
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{LANGUE_LABELS[employe.langue] || 'Français'}</span>
              )}
            </div>
            <Field label="Photo (URL)" value={form?.photo_url} onChange={v => setForm(p => ({...p, photo_url: v}))} edit={editMode} />
            </div>
          </div>

          {/* Organisation */}
          <div>
            <h3 style={{ color: '#111827', fontWeight: 600, marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🏢 Organisation</h3>
            
            {/* Postes */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem' }}>Poste principal</label>
              {editMode ? (
                <select value={form?.poste_id} onChange={e => setForm(p => ({...p, poste_id: e.target.value}))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
                  <option value="">— Aucun —</option>
                  {postes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{employe.poste?.nom || '—'}</span>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem' }}>Poste secondaire</label>
              {editMode ? (
                <select value={form?.poste_secondaire_id} onChange={e => setForm(p => ({...p, poste_secondaire_id: e.target.value}))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
                  <option value="">— Aucun —</option>
                  {postes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{employe.poste_secondaire?.nom || '—'}</span>
              )}
            </div>
                        <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem' }}>Site de pointage</label>
              {editMode ? (
                <select value={form?.site_id} onChange={e => setForm(p => ({...p, site_id: e.target.value}))} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
                  <option value="">— Aucun —</option>
                  {sites.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{sites.find(s => s.id === employe.site_id)?.nom || '—'}</span>
              )}
            </div>

            {/* Départements multi-sélection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem' }}>Départements {editMode && <span style={{ color: '#9ca3af' }}>(cochez pour affecter)</span>}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {departements.map(dept => {
                  const isSelected = selectedDepts.includes(dept.id);
                  const isPrincipal = principalDept === dept.id;
                  return (
                    <div key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem', borderRadius: '6px', background: isSelected ? dept.couleur + '15' : 'transparent' }}>
                      {editMode && <input type="checkbox" checked={isSelected} onChange={() => toggleDept(dept.id)} />}
                      <span style={{ fontSize: '0.875rem', color: isSelected ? '#111827' : '#9ca3af', flex: 1 }}>
                        {dept.icone || '🏢'} {dept.nom}
                      </span>
                      {isSelected && editMode && (
                        <button onClick={() => setPrincipalDept(dept.id)} style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px solid', cursor: 'pointer', background: isPrincipal ? dept.couleur : 'transparent', color: isPrincipal ? 'white' : dept.couleur, borderColor: dept.couleur }}>
                          {isPrincipal ? '⭐ Principal' : 'Définir principal'}
                        </button>
                      )}
                      {isSelected && !editMode && isPrincipal && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>⭐ Principal</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes internes */}
          {permissions.canViewNotes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ color: '#111827', fontWeight: 600, marginTop: 0, marginBottom: '0.75rem' }}>📝 Notes internes</h3>
              {editMode ? (
                <textarea value={form?.notes_internes} onChange={e => setForm(p => ({...p, notes_internes: e.target.value}))} rows={4}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
                  placeholder="Notes réservées aux administrateurs..."
                />
              ) : (
                <p style={{ color: employe.notes_internes ? '#374151' : '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                  {employe.notes_internes || 'Aucune note'}
                </p>
              )}
            </div>
          )}
        </div>

        {canManageSensible && (
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem', paddingTop: '1.5rem' }}>
            <h3 style={{ color: '#111827', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>Actions</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={handleToggleActif} disabled={actionSaving}
                style={{ padding: '0.5rem 1rem', background: employe.actif ? '#f3f4f6' : '#d1fae5', color: employe.actif ? '#374151' : '#065f46', border: '1px solid ' + (employe.actif ? '#d1d5db' : '#6ee7b7'), borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                {employe.actif ? 'Désactiver' : 'Réactiver'}
              </button>
              <button onClick={handleReinitialiserMdp} disabled={actionSaving}
                style={{ padding: '0.5rem 1rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Réinitialiser mot de passe
              </button>
              <select value={nouveauRole} onChange={e => setNouveauRole(e.target.value)}
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.8125rem' }}>
                <option value="">-- Changer le rôle --</option>
                <option value="employe">Employé</option>
                <option value="chef_equipe">Chef d équipe</option>
                <option value="responsable">Responsable</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
              </select>
              <button onClick={handleChangerRole} disabled={actionSaving || !nouveauRole}
                style={{ padding: '0.5rem 1rem', background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Appliquer le rôle
              </button>
              <button onClick={handleSupprimer} disabled={actionSaving}
                style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem', marginLeft: 'auto' }}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        )}

      </div>

        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>Utilisateur créé !</h3>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>Un email a été envoyé avec le lien d'activation et instructions de sécurité.</p>
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', fontSize: '0.875rem', display: 'grid', gap: '0.5rem' }}>
              <div><strong>Nom :</strong> {creds.prenom} {creds.nom}</div>
              <div><strong>Email :</strong> {creds.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>Pas de mot de passe affiché ici pour des raisons de sécurité. L'utilisateur doit suivre le lien d'activation dans l'email reçu.</div>
            </div>
            <button onClick={() => setCreds(null)} style={{ marginTop: '1.25rem', width: '100%', padding: '0.625rem', border: 'none', background: '#6366f1', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, edit, type = 'text' }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</label>
      {edit ? (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
        />
      ) : (
        <span style={{ fontSize: '0.875rem', color: value ? '#111827' : '#9ca3af' }}>{value || '—'}</span>
      )}
    </div>
  );
    }
