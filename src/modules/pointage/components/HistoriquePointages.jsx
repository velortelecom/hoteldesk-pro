// src/modules/pointage/components/HistoriquePointages.jsx
// =====================================================================
// Une ligne = UNE JOURNEE de travail.
//
// Avant, une ligne = un evenement : l'arrivee remplissait la colonne
// « Entree » et laissait « Sortie » vide, le depart faisait l'inverse.
// Deux lignes a moitie vides par journee, et la duree nulle part. Ce
// tableau ne pouvait servir ni de feuille d'heures, ni de preuve.
//
// L'appariement vient de journees.js ; cet ecran ne calcule rien.
// =====================================================================
import React from 'react'

const th = { padding: '0.75rem 0.5rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }
const td = { padding: '0.75rem 0.5rem', verticalAlign: 'top' }

export default function HistoriquePointages({ pointages = [], chargement = false, erreur = null }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Historique des journees</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
        Temps de travail = sortie &minus; entree &minus; pauses. Une journee incomplete
        n&apos;affiche pas de duree : elle en a une, on ne la connait pas.
      </p>

      {erreur ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '0.625rem 0.75rem', fontSize: '0.8125rem' }}>
          L&apos;historique n&apos;a pas pu etre lu : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Lecture des pointages...</div>
      ) : pointages.length === 0 ? (
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Aucun pointage enregistre.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Employe</th>
                <th style={th}>Site</th>
                <th style={th}>Date</th>
                <th style={th}>Entree</th>
                <th style={th}>Sortie</th>
                <th style={th}>Pause</th>
                <th style={th}>Temps</th>
                <th style={th}>Etat</th>
              </tr>
            </thead>
            <tbody>
              {pointages.map((journee) => (
                <tr
                  key={journee.id}
                  style={{ borderTop: '1px solid #e5e7eb', background: journee.complete ? undefined : '#FFFBEB' }}
                >
                  <td style={td}>{journee.employe}</td>
                  <td style={td}>{journee.site}</td>
                  <td style={td}>{journee.date}</td>
                  <td style={td}>{journee.entree}</td>
                  <td style={td}>{journee.sortie}</td>
                  <td style={td}>{journee.pause}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{journee.duree}</td>
                  <td style={td}>
                    {journee.complete ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#ECFDF5', color: '#065F46', borderRadius: 999, padding: '2px 8px' }}>
                        Complete
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#92400E' }}>
                        {journee.anomaliesLisibles.join(' · ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
