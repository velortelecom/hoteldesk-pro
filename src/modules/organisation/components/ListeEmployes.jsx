// ============================================================
// MODULE ORGANISATION — ListeEmployes.jsx
// Liste des employes avec recherche, filtres, vues (cartes/tableau) et actions
// ============================================================
import React, { useState } from 'react';
import { useEmployes, useDepartements, usePostes } from '../hooks.js';
import { ROLE_COLORS } from '../config.js';

const ROLE_LABELS = {
  admin: 'Admin',
  responsable: 'Responsable',
  chef_equipe: 'Chef d équipe',
  employe: 'Employe',
  super_admin: 'Super Admin',
};

export default function ListeEmployes({ entrepriseId, permissions, profile, onViewEmploye }) {
  const { employes, loading, error, desactiver, reactiver, supprimer, reinitialiserMotDePasse, creer } = useEmployes(entrepriseId, { includeInactif: false });
  const { employes: tous } = useEmployes(entrepriseId, { includeInactif: true });
  const { departements } = useDepartements(entrepriseId);
  const { postes } = usePostes(entrepriseId);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPoste, setFilterPoste] = useState('');
  const [showInactif, setShowInactif] = useState(false);
  const [vue, setVue] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('organisation_vue_employes')) || 'cartes');
  const [showCreate, setShowCreate] = useState(false);
  const [creds, setCreds] = useState(null);

  const isSuperAdmin = profile?.is_super_admin === true;
  const isAdminEntreprise = profile?.role === 'admin' || isSuperAdmin;
  // Actions sensibles (creation, suppression, reset mdp, role, actif) : reservees a Admin + Super Admin.
  // Responsable et Employe sont de toute facon refuses cote serveur (Edge Functions), ceci est la coherence cote UI.
  const canManageSensible = isAdminEntreprise;

  const changerVue = (v) => {
    setVue(v);
    if (typeof window !== 'undefined') window.localStorage.setItem('organisation_vue_employes', v);
  };

  const list = (showInactif ? tous : employes).filter(e => {
    const fullName = `${e.prenom} ${e.nom}`.toLowerCase();
    const tel = (e.telephone || '').toLowerCase();
    const posteNom = (e.poste?.nom || '').toLowerCase();
    const searchLower = search.toLowerCase();
    const depts = e.employe_departements || [];
    const matchSearch = !search
      || fullName.includes(searchLower)
      || tel.includes(searchLower)
      || posteNom.includes(searchLower)
      || depts.some(d => (d.departement?.nom || '').toLowerCase().includes(searchLower));
    const matchDept = !filterDept || depts.some(d => d.departement?.id === filterDept);
    const matchRole = !filterRole || e.role === filterRole;
    const matchPoste = !filterPoste || e.poste_id === filterPoste;
    return matchSearch && matchDept && matchRole && matchPoste;
  });

  const allDepts = [];
  tous.forEach(e => {
    (e.employe_departements || []).forEach(ed => {
      if (ed.departement && !allDepts.find(d => d.id === ed.departement.id)) {
        allDepts.push(ed.departement);
      }
    });
  });

  const handleCreer = async (payload) => {
    const result = await creer(payload);
    setShowCreate(false);
    setCreds({ action: 'created', prenom: payload.prenom, nom: payload.nom, role: payload.role, email: result.email, temp_password: result.temp_password });
    return result;
  };

  const handleReinitialiser = async (employe) => {
    if (!window.confirm(`Reinitialiser le mot de passe de ${employe.prenom} ${employe.nom} ?`)) return;
    try {
      const result = await reinitialiserMotDePasse(employe.id);
      setCreds({ action: 'reset', prenom: employe.prenom, nom: employe.nom, email: result.email, temp_password: result.temp_password });
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  const handleSupprimer = async (employe) => {
    if (!window.confirm(`Supprimer definitivement ${employe.prenom} ${employe.nom} ? Cette action est irreversible.`)) return;
    try {
      await supprimer(employe.id);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <div style={{ color: '#6b7280' }}>Chargement des employes...</div>
    </div>
  );
  if (error) return (
    <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', color: '#ef4444' }}>
      Erreur : {error}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => changerVue('cartes')}
            style={{
              padding: '0.5rem 0.875rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem',
              border: vue === 'cartes' ? '1px solid #6366f1' : '1px solid #d1d5db',
              background: vue === 'cartes' ? '#eef2ff' : 'white', color: vue === 'cartes' ? '#6366f1' : '#374151', fontWeight: 500,
            }}
          >
            Cartes
          </button>
          <button
            onClick={() => changerVue('tableau')}
            style={{
              padding: '0.5rem 0.875rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8125rem',
              border: vue === 'tableau' ? '1px solid #6366f1' : '1px solid #d1d5db',
              background: vue === 'tableau' ? '#eef2ff' : 'white', color: vue === 'tableau' ? '#6366f1' : '#374151', fontWeight: 500,
            }}
          >
            Tableau
          </button>
        </div>
        {canManageSensible && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '0.625rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            + Nouvel employe
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Rechercher (nom, telephone, poste, departement)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '240px', padding: '0.625rem 1rem',
            border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem',
          }}
        />
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
        >
          <option value="">Tous les departements</option>
          {allDepts.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <select
          value={filterPoste}
          onChange={e => setFilterPoste(e.target.value)}
          style={{ padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
        >
          <option value="">Tous les postes</option>
          {postes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
        >
          <option value="">Tous les roles</option>
          <option value="admin">Admin</option>
          <option value="responsable">Responsable</option>
          <option value="chef_equipe">Chef d équipe</option>
          <option value="employe">Employe</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactif} onChange={e => setShowInactif(e.target.checked)} />
          Inclure inactifs
        </label>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: 'auto' }}>
          {list.length} employe{list.length !== 1 ? 's' : ''}
        </span>
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>...</div>
          <p>Aucun employe trouve</p>
        </div>
      ) : vue === 'cartes' ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {list.map(employe => (
            <EmployeCard
              key={employe.id}
              employe={employe}
              canManageSensible={canManageSensible}
              onView={() => onViewEmploye(employe.id)}
              onDesactiver={() => desactiver(employe.id)}
              onReactiver={() => reactiver(employe.id)}
              onReinitialiser={() => handleReinitialiser(employe)}
              onSupprimer={() => handleSupprimer(employe)}
            />
          ))}
        </div>
      ) : (
        <TableauEmployes
          list={list}
          canManageSensible={canManageSensible}
          onView={onViewEmploye}
          onDesactiver={id => desactiver(id)}
          onReactiver={id => reactiver(id)}
          onReinitialiser={handleReinitialiser}
          onSupprimer={handleSupprimer}
        />
      )}

      {showCreate && (
        <ModalCreation
          departements={departements}
          postes={postes}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowCreate(false)}
          onCreer={handleCreer}
        />
      )}

      {creds && (
        <ModalCredentials creds={creds} onClose={() => setCreds(null)} />
      )}
    </div>
  );
}

function EmployeCard({ employe, canManageSensible, onView, onDesactiver, onReactiver, onReinitialiser, onSupprimer }) {
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
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: employe.couleur || '#6366f1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
      }}>
        {employe.photo_url ? (
          <img src={employe.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initiales}
      </div>
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
          {poste && <span>{poste.nom}</span>}
          {depts.length > 0 && (
            <span>
              {depts.slice(0, 2).map(d => d.departement?.nom).filter(Boolean).join(', ')}
              {depts.length > 2 && ` +${depts.length - 2}`}
            </span>
          )}
          {employe.telephone && <span>{employe.telephone}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '260px' }} onClick={e => e.stopPropagation()}>
        <BoutonAction label="Voir fiche" bg="#6366f1" text="white" onClick={onView} />
        {canManageSensible && (
          employe.actif ? (
            <BoutonAction label="Desactiver" bg="#f3f4f6" text="#374151" border="#d1d5db" onClick={onDesactiver} />
          ) : (
            <BoutonAction label="Reactiver" bg="#d1fae5" text="#065f46" border="#6ee7b7" onClick={onReactiver} />
          )
        )}
        {canManageSensible && (
          <BoutonAction label="Reinit. mdp" bg="#fef3c7" text="#92400e" border="#fde68a" onClick={onReinitialiser} />
        )}
        {canManageSensible && (
          <BoutonAction label="Supprimer" bg="#fef2f2" text="#dc2626" border="#fecaca" onClick={onSupprimer} />
        )}
      </div>
    </div>
  );
}

function BoutonAction({ label, onClick, bg, text, border }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.375rem 0.625rem', background: bg, color: text,
        border: border ? `1px solid ${border}` : 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function TableauEmployes({ list, canManageSensible, onView, onDesactiver, onReactiver, onReinitialiser, onSupprimer }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Nom</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Role</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Poste</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Departements</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Telephone</th>
            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Statut</th>
            <th style={{ textAlign: 'right', padding: '0.75rem 1rem', color: '#6b7280', fontWeight: 600 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map(employe => {
            const roleColor = ROLE_COLORS[employe.role] || '#6b7280';
            const depts = employe.employe_departements || [];
            return (
              <tr key={employe.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: employe.actif ? 1 : 0.55 }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#111827', cursor: 'pointer' }} onClick={() => onView(employe.id)}>
                  {employe.prenom} {employe.nom}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', background: roleColor + '20', color: roleColor, fontWeight: 500 }}>
                    {ROLE_LABELS[employe.role] || employe.role}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{employe.poste?.nom || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                  {depts.map(d => d.departement?.nom).filter(Boolean).join(', ') || '-'}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{employe.telephone || '-'}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {employe.actif ? (
                    <span style={{ fontSize: '0.75rem', color: '#065f46', background: '#d1fae5', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>Actif</span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f3f4f6', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>Inactif</span>
                  )}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <BoutonAction label="Voir" bg="#6366f1" text="white" onClick={() => onView(employe.id)} />
                    {canManageSensible && (employe.actif ? (
                      <BoutonAction label="Desact." bg="#f3f4f6" text="#374151" border="#d1d5db" onClick={() => onDesactiver(employe.id)} />
                    ) : (
                      <BoutonAction label="React." bg="#d1fae5" text="#065f46" border="#6ee7b7" onClick={() => onReactiver(employe.id)} />
                    ))}
                    {canManageSensible && (
                      <BoutonAction label="Mdp" bg="#fef3c7" text="#92400e" border="#fde68a" onClick={() => onReinitialiser(employe)} />
                    )}
                    {canManageSensible && (
                      <BoutonAction label="Suppr." bg="#fef2f2" text="#dc2626" border="#fecaca" onClick={() => onSupprimer(employe)} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const LANGUES = [
  { value: 'fr', label: 'Francais' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'ar', label: 'Arabe' },
];

function ModalCreation({ departements, postes, isSuperAdmin, onClose, onCreer }) {
  const [form, setForm] = useState({
    prenom: '', nom: '', telephone: '', email: '', langue: 'fr',
    role: 'employe', poste_id: '', poste_secondaire_id: '', actif: true,
  });
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const toggleDept = (deptId) => {
    setSelectedDepts(prev => prev.includes(deptId) ? prev.filter(d => d !== deptId) : [...prev, deptId]);
  };

  const handleSubmit = async () => {
    if (!form.prenom || !form.nom) { setErreur('Prenom et nom sont requis.'); return; }
    setSaving(true);
    setErreur(null);
    try {
      await onCreer({ ...form, departement_ids: selectedDepts });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>Nouvel employe</h3>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Aucun mot de passe a saisir : un mot de passe temporaire sera genere automatiquement et affiche une seule fois.
        </p>
        {erreur && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.625rem 0.875rem', borderRadius: '8px', fontSize: '0.8125rem', marginBottom: '1rem' }}>{erreur}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <Champ label="Prenom *"><input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} style={inputStyle} /></Champ>
          <Champ label="Nom *"><input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inputStyle} /></Champ>
          <Champ label="Telephone"><input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} style={inputStyle} /></Champ>
          <Champ label="Email (optionnel)"><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></Champ>
          <Champ label="Langue">
            <select value={form.langue} onChange={e => setForm(f => ({ ...f, langue: e.target.value }))} style={inputStyle}>
              {LANGUES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Champ>
          <Champ label="Role">
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
              <option value="employe">Employe</option>
              <option value="responsable">Responsable</option>
              {isSuperAdmin && <option value="admin">Admin</option>}
            </select>
          </Champ>
          <Champ label="Poste principal">
            <select value={form.poste_id} onChange={e => setForm(f => ({ ...f, poste_id: e.target.value }))} style={inputStyle}>
              <option value="">-- Aucun --</option>
              {postes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Poste secondaire">
            <select value={form.poste_secondaire_id} onChange={e => setForm(f => ({ ...f, poste_secondaire_id: e.target.value }))} style={inputStyle}>
              <option value="">-- Aucun --</option>
              {postes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Champ>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem' }}>Departements</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '140px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem' }}>
            {departements.map(dept => {
              const isSelected = selectedDepts.includes(dept.id);
              return (
                <label key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: isSelected ? (dept.couleur + '15') : 'transparent', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleDept(dept.id)} />
                  {dept.nom}
                </label>
              );
            })}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', marginBottom: '1.25rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} />
          Compte actif des la creation
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '0.625rem 1.25rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>Annuler</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '0.625rem 1.25rem', border: 'none', background: '#6366f1', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            {saving ? 'Creation...' : 'Creer l\'employe'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Champ({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' };

function ModalCredentials({ creds, onClose }) {
  const titre = creds.action === 'reset' ? 'Mot de passe reinitialise' : 'Compte cree';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '420px' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>{titre} !</h3>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>
          Notez ces identifiants maintenant : ils ne seront plus jamais affiches.
        </p>
        <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', fontSize: '0.875rem', display: 'grid', gap: '0.5rem' }}>
          {creds.prenom && <div><strong>Nom :</strong> {creds.prenom} {creds.nom}</div>}
          <div><strong>Email :</strong> {creds.email}</div>
          <div><strong>Mot de passe temporaire :</strong> <code style={{ background: '#eef2ff', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{creds.temp_password}</code></div>
          {creds.role && <div><strong>Role :</strong> {ROLE_LABELS[creds.role] || creds.role}</div>}
        </div>
        <button onClick={onClose} style={{ marginTop: '1.25rem', width: '100%', padding: '0.625rem', border: 'none', background: '#6366f1', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          J'ai note les identifiants
        </button>
      </div>
    </div>
  );
}
