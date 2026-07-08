// ============================================================
// src/pages/Personnel.jsx
// Redirection : la gestion des employes est desormais geree par le module Organisation
// (src/modules/organisation). Cette page ne contient plus de logique metier.
// ============================================================
import { useEffect } from 'react';

export default function Personnel() {
  useEffect(() => {
    window.location.hash = 'organisation';
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6b7280', fontSize: '0.875rem' }}>
      Redirection vers le module Organisation...
    </div>
  );
}
