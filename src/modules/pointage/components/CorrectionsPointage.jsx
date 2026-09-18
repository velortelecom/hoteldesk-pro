// src/modules/pointage/components/CorrectionsPointage.jsx
// =====================================================================
// CE QUE CET ECRAN AFFICHAIT AVANT
//
//   'Correction de journée pour Sophie Martin – 15 min de retard'
//   'Vérification du pointage sur le site Résidence Le Parc'
//   'Rapprochement des horaires de sortie avec le service RH'
//
// Trois chaines ecrites en dur. Aucune Sophie Martin dans la base,
// aucune Residence Le Parc : l'ecran inventait du travail a faire. Un
// responsable qui s'y fiait cherchait des corrections qui n'existaient
// pas, et surtout ne voyait pas celles qui existaient vraiment.
//
// Il affiche desormais les journees que journees.js a marquees en
// anomalie -- et rien d'autre. Quand il n'y a rien, il le dit.
// =====================================================================
import React from 'react'

const carte = { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }

export default function CorrectionsPointage({ journees = [], chargement = false, erreur = null }) {
  const aCorriger = (journees || []).filter(j => j && j.anomalies && j.anomalies.length > 0)

  return (
    <div style={carte}>
      <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>
        A corriger{aCorriger.length > 0 ? ' (' + aCorriger.length + ')' : ''}
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
        Les journees qu&apos;on ne peut pas compter en l&apos;etat. Tant qu&apos;elles ne sont pas
        corrigees, leur temps de travail reste inconnu &mdash; il n&apos;est ni estime, ni compte
        pour zero.
      </p>

      {erreur && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '0.625rem 0.75rem', fontSize: '0.8125rem' }}>
          Les pointages n&apos;ont pas pu etre lus : {erreur}
        </div>
      )}

      {!erreur && chargement && (
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Lecture des pointages...</div>
      )}

      {!erreur && !chargement && aCorriger.length === 0 && (
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Aucune journee a corriger.
        </div>
      )}

      {!erreur && !chargement && aCorriger.length > 0 && (
        <div style={{ display: 'grid', gap: '0.625rem' }}>
          {aCorriger.map(journee => (
            <div
              key={journee.id}
              style={{
                border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: 8,
                padding: '0.625rem 0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{journee.employe}</strong>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                  {journee.date} &middot; {journee.site}
                </span>
              </div>

              <div style={{ fontSize: '0.8125rem', color: '#374151', marginTop: '0.25rem' }}>
                Entree {journee.entree} &rarr; Sortie {journee.sortie} &middot; temps retenu{' '}
                <strong>{journee.duree}</strong>
              </div>

              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: '#92400E' }}>
                {journee.anomaliesLisibles.map(libelle => (
                  <li key={libelle}>{libelle}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
