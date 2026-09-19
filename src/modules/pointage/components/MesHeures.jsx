// src/modules/pointage/components/MesHeures.jsx
// =====================================================================
// LE SALARIE CONSULTE SES HEURES -- LES SIENNES, ET RIEN D'AUTRE.
//
// POURQUOI CET ECRAN EXISTE
//   Un decompte d'heures que l'interesse ne peut pas verifier n'est pas
//   un decompte, c'est une affirmation. L'article D.3171-8 demande que
//   le salarie puisse consulter le sien. Sans cet ecran, il ne voyait
//   que sa journee en cours : impossible de contester le mois passe, et
//   impossible de s'apercevoir qu'un depart a saute.
//
// POURQUOI PAS L'ONGLET HISTORIQUE
//   Historique montre les journees de toute l'equipe. Donner a chacun
//   les horaires de ses collegues pour qu'il puisse lire les siens
//   serait un drole d'echange.
//
// LE FILTRE EST EXPLICITE, MEME S'IL FAIT DOUBLON
//   La base filtre deja : pointages_select n'autorise un salarie a lire
//   que ses propres lignes. Mais un responsable ou un admin ouvre le
//   meme ecran et recoit, lui, toute l'equipe. Filtrer ici sur
//   profileId n'est donc pas une precaution de securite -- c'est ce qui
//   fait que « Mes heures » dit bien MES heures pour tout le monde.
//
// AUCUNE JOURNEE INCOMPLETE NE VAUT ZERO
//   Comme a l'export de paie : une journee dont on ne connait pas la
//   duree s'affiche sans duree, avec sa raison, et le total annonce
//   combien de journees n'y sont pas. Un total qui les avale en silence
//   est un total faux dont rien ne dit qu'il est faux.
// =====================================================================
import React, { useMemo, useState } from 'react'
import { formaterDuree } from '../journees.js'
import { libelleMois } from '../exportPaie.js'

const carte = { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }
const th = { padding: '0.75rem 0.5rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }
const td = { padding: '0.75rem 0.5rem', verticalAlign: 'top' }

function periodeCourante() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

export default function MesHeures({ journees = [], profile, chargement = false, erreur = null }) {
  const miennes = useMemo(
    () => (journees || []).filter((j) => j && j.profileId && j.profileId === profile?.id),
    [journees, profile?.id],
  )

  // Les mois ou il s'est passe quelque chose, du plus recent au plus
  // ancien. On n'invente pas de mois vides : proposer « juillet » a
  // quelqu'un embauche en septembre ne l'aide pas.
  const periodes = useMemo(() => {
    const vues = [...new Set(miennes.map((j) => j.periode).filter(Boolean))]
    return vues.sort().reverse()
  }, [miennes])

  const [periodeChoisie, setPeriodeChoisie] = useState(null)
  // Recalcule plutot que memorise : si le mois choisi disparait des
  // donnees, on retombe sur un mois qui existe au lieu d'un ecran vide.
  const periode = periodes.includes(periodeChoisie)
    ? periodeChoisie
    : (periodes.includes(periodeCourante()) ? periodeCourante() : periodes[0] || periodeCourante())

  const duMois = useMemo(
    () => miennes.filter((j) => j.periode === periode).slice().sort((a, b) => String(a.jour).localeCompare(String(b.jour))),
    [miennes, periode],
  )

  const completes = duMois.filter((j) => j.complete && j.minutesTravaillees != null)
  const minutes = completes.reduce((somme, j) => somme + j.minutesTravaillees, 0)
  const nonCalculees = duMois.length - completes.length

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={carte}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Mes heures</h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
              Temps de travail = depart &minus; arrivee &minus; pauses. Vous ne voyez ici
              que vos propres journees.
            </p>
          </div>

          {periodes.length > 0 && (
            <label style={{ fontSize: '0.875rem', color: '#374151' }}>
              Mois{' '}
              <select
                value={periode}
                onChange={(e) => setPeriodeChoisie(e.target.value)}
                style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
              >
                {periodes.map((p) => (
                  <option key={p} value={p}>{libelleMois(p)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {erreur ? (
        <div style={{ ...carte, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '0.875rem' }}>
          Vos heures n&apos;ont pas pu etre lues : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ ...carte, color: '#6b7280', fontSize: '0.875rem' }}>Lecture de vos pointages...</div>
      ) : duMois.length === 0 ? (
        <div style={{ ...carte, color: '#6b7280', fontSize: '0.875rem' }}>
          Aucune journee enregistree sur {libelleMois(periode)}.
        </div>
      ) : (
        <>
          <div style={{ ...carte, display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total {libelleMois(periode)}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f766e' }}>{formaterDuree(minutes)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Journees comptees</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{completes.length}</div>
            </div>
            {nonCalculees > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#92400E' }}>Journees non calculees</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#92400E' }}>{nonCalculees}</div>
                <div style={{ fontSize: '0.75rem', color: '#92400E' }}>
                  elles ne sont PAS dans le total
                </div>
              </div>
            )}
          </div>

          <div style={carte}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Arrivee</th>
                    <th style={th}>Depart</th>
                    <th style={th}>Pause</th>
                    <th style={th}>Temps</th>
                    <th style={th}>Etat</th>
                  </tr>
                </thead>
                <tbody>
                  {duMois.map((journee) => {
                    const calculable = journee.complete && journee.minutesTravaillees != null
                    return (
                      <tr
                        key={journee.id}
                        style={{ borderTop: '1px solid #e5e7eb', background: calculable ? undefined : '#FFFBEB' }}
                      >
                        <td style={td}>{journee.date}</td>
                        <td style={td}>{journee.entree}</td>
                        <td style={td}>{journee.sortie}</td>
                        <td style={td}>{journee.pause}</td>
                        {/* Case vide, jamais « 0h00 » : un zero se paie zero. */}
                        <td style={{ ...td, fontWeight: 600 }}>{calculable ? journee.duree : ''}</td>
                        <td style={{ ...td, color: calculable ? '#6b7280' : '#92400E' }}>
                          {calculable ? '' : (journee.anomaliesLisibles || []).join(' ; ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {nonCalculees > 0 && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.6 }}>
                Une journee en jaune n&apos;a pas pu etre calculee &mdash; il y manque un
                pointage. Signalez-la a votre responsable : vous ne pouvez pas corriger
                vos propres heures, c&apos;est ce qui leur donne leur valeur.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
