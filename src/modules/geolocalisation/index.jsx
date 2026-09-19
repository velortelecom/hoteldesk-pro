// src/modules/geolocalisation/index.jsx
// =====================================================================
// LE MODULE GEOLOCALISATION.
//
// DEUX ONGLETS, ET PAS POUR TOUT LE MONDE
//   « Relevés » : ou le travail a ete fait. Admin et responsable.
//   « Personnes suivies » : qui est geolocalise. ADMIN SEULEMENT --
//   decider de suivre quelqu'un est une decision d'employeur, et le
//   responsable la prend depuis la fiche de son equipe, pas ici.
//
// UN SALARIE N'A RIEN A FAIRE DANS CE MODULE
//   Il n'a pas a consulter les positions de ses collegues, ni meme
//   l'ecran qui dirait lesquels sont suivis. Ce qui le concerne -- le
//   fait qu'il soit lui-meme suivi -- lui est dit par le bandeau, en
//   permanence, sur tous les ecrans.
// =====================================================================
import React, { useMemo, useState } from 'react'
import CarteReleves from './components/CarteReleves.jsx'
import InscriptionsGeo from './components/InscriptionsGeo.jsx'

const ROLES_ENCADREMENT = ['responsable', 'admin', 'super_admin']

/** Le role qui compte : le PROFIL, pas la seule colonne role. */
export function roleGeo(profile) {
  if (profile?.is_super_admin === true) return 'super_admin'
  const r = profile?.role
  return ['employe', 'responsable', 'admin'].includes(r) ? r : 'employe'
}

export const ONGLETS = [
  { id: 'releves', label: 'Relevés', icon: '📍', roles: ROLES_ENCADREMENT },
  // Inscrire quelqu'un est une decision d'employeur : l'ecran est
  // reserve a l'admin. Le responsable peut le faire pour son equipe,
  // mais depuis la fiche de l'employe, pas depuis un tableau general.
  { id: 'inscriptions', label: 'Personnes suivies', icon: '👥', roles: ['admin', 'super_admin'] },
]

export function ongletsPourRole(role) {
  return ONGLETS.filter((o) => o.roles.includes(role))
}

export default function GeolocalisationModule({ profile }) {
  const role = roleGeo(profile)
  const onglets = useMemo(() => ongletsPourRole(role), [role])
  const [demande, setDemande] = useState(null)

  // L'onglet affiche est RECALCULE contre la liste autorisee a chaque
  // rendu : un onglet interdit ne peut pas rester actif apres un
  // changement de profil. Meme mecanique que pour le pointage.
  const actif = onglets.some((o) => o.id === demande) ? demande : (onglets[0]?.id || null)

  if (onglets.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6B7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2>Accès non autorisé</h2>
        <p>
          Ce module est réservé à l&apos;encadrement. Si votre position est relevée,
          un bandeau vous l&apos;indique en haut de chaque écran.
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F9FAFB' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '1.25rem 2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          📍 Géolocalisation
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: '#6B7280', fontSize: '0.875rem' }}>
          Où le travail a été fait, pour les personnes inscrites au module.
        </p>
      </div>

      {onglets.length > 1 && (
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 2rem', display: 'flex' }}>
          {onglets.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setDemande(o.id)}
              style={{
                padding: '0.875rem 1.25rem', border: 'none', background: 'transparent',
                borderBottom: actif === o.id ? '2px solid #0F766E' : '2px solid transparent',
                color: actif === o.id ? '#0F766E' : '#6B7280',
                fontWeight: actif === o.id ? 600 : 400,
                cursor: 'pointer', fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              <span>{o.icon}</span>{o.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
        {actif === 'releves' && <CarteReleves profile={profile} />}
        {actif === 'inscriptions' && <InscriptionsGeo profile={profile} />}
      </div>
    </div>
  )
}
