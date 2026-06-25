// ============================================================
// MODULE ORGANISATION — hooks.js
// React hooks pour le module Organisation
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  getDepartements, getPostes, getEmployes, getEmployeById,
  createDepartement, updateDepartement, toggleDepartementActif,
  createPoste, updatePoste, togglePosteActif,
  updateEmploye, desactiverEmploye, reactiversEmploye,
  setEmployeDepartements, getStatsOrganisation,
} from './services.js';

// ============================================================
// Hook : useDepartements
// ============================================================
export function useDepartements(entrepriseId) {
  const [departements, setDepartements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!entrepriseId) return;
    setLoading(true);
    try {
      const data = await getDepartements(entrepriseId);
      setDepartements(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entrepriseId]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload) => {
    const d = await createDepartement(entrepriseId, payload);
    setDepartements(prev => [...prev, d].sort((a, b) => a.ordre - b.ordre));
    return d;
  };

  const update = async (id, payload) => {
    const d = await updateDepartement(id, payload);
    setDepartements(prev => prev.map(x => x.id === id ? d : x));
    return d;
  };

  const toggle = async (id, actif) => {
    await toggleDepartementActif(id, actif);
    setDepartements(prev => prev.map(x => x.id === id ? { ...x, actif } : x));
  };

  return { departements, loading, error, reload: load, create, update, toggle };
}

// ============================================================
// Hook : usePostes
// ============================================================
export function usePostes(entrepriseId, departementId = null) {
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!entrepriseId) return;
    setLoading(true);
    try {
      const data = await getPostes(entrepriseId, departementId);
      setPostes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entrepriseId, departementId]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload) => {
    const p = await createPoste(entrepriseId, payload);
    setPostes(prev => [...prev, p]);
    return p;
  };

  const update = async (id, payload) => {
    const p = await updatePoste(id, payload);
    setPostes(prev => prev.map(x => x.id === id ? p : x));
    return p;
  };

  const toggle = async (id, actif) => {
    await togglePosteActif(id, actif);
    setPostes(prev => prev.map(x => x.id === id ? { ...x, actif } : x));
  };

  return { postes, loading, error, reload: load, create, update, toggle };
}

// ============================================================
// Hook : useEmployes
// ============================================================
export function useEmployes(entrepriseId, options = {}) {
  const [employes, setEmployes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!entrepriseId) return;
    setLoading(true);
    try {
      const data = await getEmployes(entrepriseId, options);
      setEmployes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entrepriseId, options.departementId, options.includeInactif]);

  useEffect(() => { load(); }, [load]);

  const update = async (id, payload) => {
    const e = await updateEmploye(id, payload);
    setEmployes(prev => prev.map(x => x.id === id ? { ...x, ...e } : x));
    return e;
  };

  const desactiver = async (id) => {
    await desactiverEmploye(id);
    setEmployes(prev => prev.map(x => x.id === id ? { ...x, actif: false } : x));
  };

  const reactiver = async (id) => {
    await reactiversEmploye(id);
    setEmployes(prev => prev.map(x => x.id === id ? { ...x, actif: true } : x));
  };

  const updateDepartements = async (profileId, departementIds, principalId) => {
    const result = await setEmployeDepartements(profileId, entrepriseId, departementIds, principalId);
    await load(); // Recharger pour avoir les données fraîches avec joins
    return result;
  };

  return { employes, loading, error, reload: load, update, desactiver, reactiver, updateDepartements };
}

// ============================================================
// Hook : useEmployeDetail
// ============================================================
export function useEmployeDetail(employeId) {
  const [employe, setEmploye] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!employeId) return;
    setLoading(true);
    getEmployeById(employeId)
      .then(setEmploye)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [employeId]);

  return { employe, loading, error };
}

// ============================================================
// Hook : useStatsOrganisation (pour widgets dashboard)
// ============================================================
export function useStatsOrganisation(entrepriseId) {
  const [stats, setStats] = useState({ totalEmployes: 0, totalDepartements: 0, totalPostes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entrepriseId) return;
    getStatsOrganisation(entrepriseId)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entrepriseId]);

  return { stats, loading };
}
