// ============================================================
// src/pages/Personnel.jsx
// Redirection : la gestion des employes est desormais geree par le module Organisation
// (src/modules/organisation). Cette page ne contient plus de logique metier.
// ============================================================
import { Navigate } from 'react-router-dom'

export default function Personnel() {
  return <Navigate to="/organisation" replace />
}
