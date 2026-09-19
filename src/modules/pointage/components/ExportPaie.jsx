// src/modules/pointage/components/ExportPaie.jsx
// =====================================================================
// Le bout de la chaine : le classeur qu'on envoie en paie.
//
// L'ecran montre CE QU'IL VA EXPORTER avant de l'exporter, et il annonce
// en rouge les journees qui ne sont pas calculables. Exporter d'abord et
// decouvrir ensuite qu'il manquait trois journees, c'est decouvrir apres
// avoir paye.
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react'
import { telechargerXlsx } from '../../../lib/xlsx'
import { MESSAGE_EXPORT_REFUSE, peutExporter } from '../../../lib/droitsExport.js'
import { getEvenementsMois } from '../services.js'
import { formaterDuree } from '../journees.js'
import {
  LARGEURS_PAIE, construireLignesPaie, journeesDuMois, libelleMois,
  nomFichierPaie, recapitulerParSalarie,
} from '../exportPaie.js'

const carte = { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }
const th = { textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '0.5rem', fontSize: '0.875rem', borderTop: '1px solid #f3f4f6' }

function moisProposes(aujourdhui = new Date()) {
  const out = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1)
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
  }
  return out
}

export default function ExportPaie({ profile }) {
  const [periode, setPeriode] = useState(() => {
    const d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
  })
  const [recap, setRecap] = useState([])
  const [journees, setJournees] = useState([])
  const [noms, setNoms] = useState({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  // Le droit d'exporter ne se lit PAS dans un objet `permissions` recu
  // en props : celui-la est fabrique par l'appelant et pourrait, un
  // jour, dependre de l'offre souscrite. Il se lit sur le profil, et
  // nulle part ailleurs -- quelle que soit l'offre du client.
  const autorise = peutExporter(profile)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const { evenements, noms: nomsLus } = await getEvenementsMois(profile, periode)
      const duMois = journeesDuMois(evenements, periode)
      setJournees(duMois)
      setNoms(nomsLus)
      setRecap(recapitulerParSalarie(duMois, nomsLus))
    } catch (err) {
      // Pas de liste vide silencieuse : « aucune heure ce mois-ci » et
      // « la lecture a echoue » ne se ressemblent que pour la machine.
      setErreur(err?.message || 'Lecture impossible.')
      setRecap([])
      setJournees([])
    } finally {
      setChargement(false)
    }
  }, [profile?.entreprise_id, periode])

  useEffect(() => { charger() }, [charger])

  const exporter = () => {
    // LE REFUS EST ICI, pas sur le bouton. `disabled` est un attribut du
    // DOM : on l'enleve en trois secondes avec la console du navigateur.
    if (!peutExporter(profile)) return

    telechargerXlsx(
      nomFichierPaie(periode),
      'Heures ' + libelleMois(periode),
      construireLignesPaie(journees, noms),
      { largeurs: LARGEURS_PAIE },
    )
  }

  const totalMinutes = recap.reduce((s, r) => s + r.minutes, 0)
  const totalNonCalcule = recap.reduce((s, r) => s + r.joursNonCalcules, 0)

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={carte}>
        <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Heures a payer</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
          Le total ne compte que les journees completes. Une journee dont il manque un
          pointage n&apos;est pas comptee pour zero &mdash; elle est signalee, et elle reste a
          corriger avant la paie.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
          >
            {moisProposes().map(m => <option key={m} value={m}>{libelleMois(m)}</option>)}
          </select>

          <button
            type="button"
            onClick={exporter}
            disabled={!autorise || journees.length === 0 || !!erreur}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none', fontWeight: 600,
              fontSize: '0.875rem',
              background: (!autorise || journees.length === 0 || !!erreur) ? '#d1d5db' : '#0f766e',
              color: 'white',
              cursor: (!autorise || journees.length === 0 || !!erreur) ? 'not-allowed' : 'pointer',
            }}
          >
            Exporter vers Excel
          </button>

          {!autorise && (
            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
              {MESSAGE_EXPORT_REFUSE}
            </span>
          )}
        </div>
      </div>

      {erreur ? (
        <div style={{ ...carte, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '0.875rem' }}>
          Les pointages du mois n&apos;ont pas pu etre lus : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ ...carte, color: '#6b7280', fontSize: '0.875rem' }}>Lecture des pointages...</div>
      ) : recap.length === 0 ? (
        <div style={{ ...carte, color: '#6b7280', fontSize: '0.875rem' }}>
          Aucun pointage en {libelleMois(periode)}.
        </div>
      ) : (
        <>
          {totalNonCalcule > 0 && (
            <div style={{ ...carte, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>{totalNonCalcule} journee{totalNonCalcule > 1 ? 's' : ''}</strong> ne
              {totalNonCalcule > 1 ? ' sont' : ' est'} pas calculable
              {totalNonCalcule > 1 ? 's' : ''} et n&apos;entre
              {totalNonCalcule > 1 ? 'nt' : ''} pas dans ces totaux. Corrigez-les dans
              l&apos;onglet « A corriger » avant d&apos;envoyer la paie &mdash; sinon un salarie
              sera paye en moins sans que personne s&apos;en apercoive.
            </div>
          )}

          <div style={{ ...carte, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Salarie</th>
                  <th style={th}>Jours comptes</th>
                  <th style={th}>Heures</th>
                  <th style={th}>Non calcule</th>
                </tr>
              </thead>
              <tbody>
                {recap.map(r => (
                  <tr key={r.profileId} style={{ background: r.joursNonCalcules > 0 ? '#FFFBEB' : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.nom}</td>
                    <td style={td}>{r.joursComptes}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{formaterDuree(r.minutes)}</td>
                    <td style={td}>
                      {r.joursNonCalcules > 0
                        ? <span style={{ color: '#92400E' }}>{r.joursNonCalcules} journee(s)</span>
                        : '—'}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>TOTAL</td>
                  <td style={{ ...td, borderTop: '2px solid #e5e7eb' }} />
                  <td style={{ ...td, fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>{formaterDuree(totalMinutes)}</td>
                  <td style={{ ...td, borderTop: '2px solid #e5e7eb' }} />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
