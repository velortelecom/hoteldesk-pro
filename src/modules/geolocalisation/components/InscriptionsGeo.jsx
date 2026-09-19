// src/modules/geolocalisation/components/InscriptionsGeo.jsx
// =====================================================================
// QUI EST SUIVI, ET SELON QUELLE REGLE HORAIRE.
//
// DEUX CASES PAR PERSONNE
//   « Suivi » : cette personne est-elle geolocalisee ?
//   « Suit son pointage » : ses bornes sont-elles son arrivee et son
//   depart, ou la plage horaire de l'entreprise ?
//
//   Un commercial en rendez-vous toute la journee ne pointe peut-etre
//   jamais : la plage horaire lui convient. Un chauffeur pointe : ses
//   bornes reelles valent mieux qu'une approximation.
//
// LA SECONDE CASE NE SERT A RIEN SANS LA PREMIERE
//   Elle est donc desactivee tant que la personne n'est pas suivie.
//   Laisser cocher un mode pour quelqu'un qui n'est pas geolocalise
//   donnerait l'impression d'avoir regle quelque chose.
//
// ON MONTRE DEPUIS QUAND
//   « Suivi depuis le 19/09 » n'est pas de la decoration : c'est la
//   reponse a la premiere question que posera un salarie, et celle
//   qu'un inspecteur demandera. L'ecran doit pouvoir la donner sans
//   qu'on aille fouiller la base.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { ORIGINES_MODE, etatActuelParProfil, getInscriptions, getModes, inscrire } from '../services.js'

const carte = { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #F3F4F6' }

export default function InscriptionsGeo({ profile }) {
  const [membres, setMembres] = useState([])
  const [etats, setEtats] = useState([])
  const [modes, setModes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [message, setMessage] = useState(null)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const [{ data: profils, error: errProfils }, inscriptions, modesEffectifs] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, prenom, nom, role, actif, is_super_admin')
          .eq('entreprise_id', profile?.entreprise_id)
          .order('nom'),
        getInscriptions(profile),
        // Le mode qui S'APPLIQUERA, calcule par la base. L'ecran ne
        // refait pas la cascade des replis de son cote : c'est comme ca
        // qu'il en etait venu a afficher le contraire de la realite.
        getModes(profile),
      ])
      if (errProfils) throw errProfils

      // Le super admin n'est pas un salarie de l'entreprise : il n'a
      // rien a faire dans une liste de personnes a geolocaliser.
      setMembres((profils || []).filter((p) => p.is_super_admin !== true))
      setEtats(etatActuelParProfil(inscriptions))
      setModes(modesEffectifs)
    } catch (err) {
      setErreur(err?.message || 'Lecture impossible.')
      setMembres([])
      setEtats([])
      setModes([])
    }
    setChargement(false)
  }, [profile?.entreprise_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger() }, [charger])

  const parProfil = useMemo(() => {
    const table = {}
    etats.forEach((e) => { table[e.profileId] = e })
    return table
  }, [etats])

  const modeParProfil = useMemo(() => {
    const table = {}
    modes.forEach((m) => { table[m.profileId] = m })
    return table
  }, [modes])

  const appliquer = async (membre, champs) => {
    const etat = parProfil[membre.id] || {}
    setEnCours(membre.id)
    setMessage(null)

    const res = await inscrire(
      membre.id,
      champs.inscrit !== undefined ? champs.inscrit : etat.inscrit === true,
      {
        motif: champs.motif || null,
        // Attention au `??` : `false` est une valeur choisie, pas une
        // absence de choix. Un `||` ici transformerait « plage horaire »
        // en « pas de choix », et la case decochee ne servirait a rien.
        suivrePointage: champs.suivrePointage !== undefined
          ? champs.suivrePointage
          : (etat.suivrePointage ?? null),
      },
    )

    setEnCours(null)

    if (!res.ok) {
      setMessage({ type: 'erreur', texte: res.message })
      return
    }
    if (res.sansChangement) {
      // Ne pas annoncer un enregistrement qui n'a rien enregistre.
      setMessage({ type: 'info', texte: 'Rien n’a changé pour ' + nomComplet(membre) + '.' })
      return
    }
    setMessage({ type: 'succes', texte: nomComplet(membre) + ' : modification enregistrée.' })
    charger()
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={carte}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
          Personnes suivies
        </h2>
        <p style={{ margin: 0, fontSize: 12.5, color: '#6B7280', lineHeight: 1.6 }}>
          On inscrit des personnes, pas l&apos;entreprise : quelqu&apos;un au bureau n&apos;a
          pas besoin d&apos;être géolocalisé. Une personne inscrite voit en permanence
          un bandeau le lui disant &mdash; c&apos;est ce qui rend les relevés opposables.
          Chaque décision est datée et garde le nom de son auteur.
        </p>
      </div>

      {message && (
        <div style={{
          ...carte,
          background: message.type === 'erreur' ? '#FEF2F2' : message.type === 'succes' ? '#ECFDF5' : '#F9FAFB',
          border: '1px solid ' + (message.type === 'erreur' ? '#FCA5A5' : message.type === 'succes' ? '#6EE7B7' : '#E5E7EB'),
          color: message.type === 'erreur' ? '#991B1B' : message.type === 'succes' ? '#065F46' : '#374151',
          fontSize: 13,
        }}>
          {message.texte}
        </div>
      )}

      {erreur ? (
        <div style={{ ...carte, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}>
          La liste n&apos;a pas pu être lue : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>Lecture...</div>
      ) : membres.length === 0 ? (
        <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>Aucun salarié dans cette entreprise.</div>
      ) : (
        <div style={{ ...carte, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Salarié</th>
                <th style={th}>Rôle</th>
                <th style={th}>Suivi</th>
                <th style={th}>Suit son pointage</th>
                <th style={th}>Depuis</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => {
                const etat = parProfil[m.id] || {}
                const mode = modeParProfil[m.id] || { suivrePointage: true, origine: 'defaut' }
                const suivi = etat.inscrit === true
                const occupe = enCours === m.id

                return (
                  <tr key={m.id} style={{ background: suivi ? '#F0FDFA' : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {nomComplet(m)}
                      {m.actif === false && (
                        <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · compte désactivé</span>
                      )}
                    </td>
                    <td style={{ ...td, color: '#6B7280' }}>{m.role || 'employe'}</td>

                    <td style={td}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: occupe ? 'wait' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={suivi}
                          disabled={occupe}
                          onChange={(e) => appliquer(m, {
                            inscrit: e.target.checked,
                            motif: e.target.checked ? 'Inscrit depuis l’écran' : 'Retiré depuis l’écran',
                          })}
                        />
                        {suivi ? 'Oui' : 'Non'}
                      </label>
                    </td>

                    <td style={td}>
                      {/* Desactivee tant que la personne n'est pas suivie :
                          regler un mode pour quelqu'un qui n'est pas
                          geolocalise donnerait l'impression d'avoir regle
                          quelque chose. */}
                      {/* La case montre le mode QUI S'APPLIQUERA, calcule
                          par la base, pas la seule valeur stockee. Elle
                          affichait « reglage de l'entreprise » decochee a
                          quelqu'un dont le mode effectif etait « suit son
                          pointage » : elle disait le contraire de ce qui
                          allait se passer.
                          La ligne du dessous dit d'ou vient ce mode, ce
                          que la case seule ne peut pas exprimer. */}
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, opacity: suivi ? 1 : 0.4 }}>
                        <input
                          type="checkbox"
                          checked={suivi && mode.suivrePointage === true}
                          disabled={!suivi || occupe}
                          onChange={(e) => appliquer(m, { suivrePointage: e.target.checked })}
                        />
                        <span style={{ fontSize: 12.5 }}>
                          {!suivi ? '—' : (mode.suivrePointage ? 'son arrivée et son départ' : 'plage horaire')}
                          {suivi && (
                            <span style={{ display: 'block', fontSize: 11, color: '#9CA3AF' }}>
                              {ORIGINES_MODE[mode.origine] || mode.origine}
                            </span>
                          )}
                        </span>
                      </label>
                    </td>

                    <td style={{ ...td, color: '#6B7280', fontSize: 12.5 }}>
                      {suivi && etat.depuis ? formaterDate(etat.depuis) : '—'}
                      {etat.motif && (
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{etat.motif}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function nomComplet(m) {
  return [m?.prenom, m?.nom].filter(Boolean).join(' ').trim() || m?.id || '—'
}

function formaterDate(valeur) {
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) return '—'
  return String(d.getDate()).padStart(2, '0')
    + '/' + String(d.getMonth() + 1).padStart(2, '0')
    + '/' + d.getFullYear()
}
