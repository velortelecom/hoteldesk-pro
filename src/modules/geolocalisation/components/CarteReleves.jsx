// src/modules/geolocalisation/components/CarteReleves.jsx
// =====================================================================
// OU LE TRAVAIL A ETE FAIT.
//
// PAR PERSONNE ET PAR JOUR, PAS EN VRAC
//   Trois cents points bruts ne repondent a aucune question. « Paul,
//   jeudi, six releves, tous chez le client » y repond.
//
// LES CONNEXIONS SONT COMPTEES A PART
//   Un releve de connexion dit « l'application a ete ouverte ici », pas
//   « le travail a ete fait ici ». Les melanger ferait ressembler une
//   consultation depuis le parking a une intervention. Un filtre permet
//   de ne garder que les actes de travail.
//
// PAS DE CARTE INTEGREE, ET C'EST UN CHOIX
//   Une bibliotheque de cartographie ajouterait des centaines de
//   kilo-octets, une cle d'API, et un tiers qui verrait passer les
//   positions des salaries de nos clients a chaque ouverture de
//   l'ecran. Un lien ouvert a la demande repond a la meme question --
//   et rien ne part nulle part tant que personne ne clique.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { getReleves } from '../services.js'
import {
  LIBELLES_ACTIONS, coordonneesLisibles, estActeDeTravail,
  grouperParPersonneEtJour, heureLocale, lienCarte, resumeReleves,
} from '../carte.js'

const carte = { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }
const th = { textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '6px 8px', fontSize: 13, borderTop: '1px solid #F3F4F6' }

const PERIODES = [
  { jours: 1, label: "Aujourd'hui" },
  { jours: 7, label: '7 jours' },
  { jours: 30, label: '30 jours' },
]

export default function CarteReleves({ profile }) {
  const [jours, setJours] = useState(7)
  const [actesSeulement, setActesSeulement] = useState(false)
  const [releves, setReleves] = useState([])
  const [noms, setNoms] = useState({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [ouverts, setOuverts] = useState({})

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const lignes = await getReleves(profile, { depuisJours: jours })
      setReleves(lignes)

      const ids = [...new Set(lignes.map((r) => r.profile_id).filter(Boolean))]
      if (ids.length > 0) {
        const { data } = await supabase.from('profiles').select('id, prenom, nom').in('id', ids)
        const table = {}
        ;(data || []).forEach((p) => {
          table[p.id] = [p.prenom, p.nom].filter(Boolean).join(' ').trim() || p.id
        })
        setNoms(table)
      } else {
        setNoms({})
      }
    } catch (err) {
      // Pas de liste vide silencieuse : « aucun releve » et « la lecture
      // a echoue » ne se ressemblent que pour la machine.
      setErreur(err?.message || 'Lecture impossible.')
      setReleves([])
    }
    setChargement(false)
  }, [profile?.entreprise_id, jours]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger() }, [charger])

  const visibles = useMemo(
    () => (actesSeulement ? releves.filter(estActeDeTravail) : releves),
    [releves, actesSeulement],
  )
  const resume = useMemo(() => resumeReleves(visibles), [visibles])
  const groupes = useMemo(() => grouperParPersonneEtJour(visibles, noms), [visibles, noms])

  const basculer = (cle) => setOuverts((o) => ({ ...o, [cle]: !o[cle] }))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={carte}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Où le travail a été fait</h2>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#6B7280', lineHeight: 1.6 }}>
          Une position est relevée au moment d&apos;une action &mdash; tâche terminée,
          photo, visite &mdash; et à la connexion, uniquement pour les personnes
          inscrites au module et pendant leur temps de travail. Aucun suivi continu
          n&apos;existe : entre deux actions, personne n&apos;est localisé.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {PERIODES.map((p) => (
            <button
              key={p.jours}
              type="button"
              onClick={() => setJours(p.jours)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                border: '1px solid ' + (jours === p.jours ? '#0F766E' : '#D1D5DB'),
                background: jours === p.jours ? '#0F766E' : 'white',
                color: jours === p.jours ? 'white' : '#374151',
                fontWeight: jours === p.jours ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}

          <label style={{ fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <input
              type="checkbox"
              checked={actesSeulement}
              onChange={(e) => setActesSeulement(e.target.checked)}
            />
            Actes de travail seulement
          </label>
        </div>
      </div>

      {erreur ? (
        <div style={{ ...carte, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}>
          Les relevés n&apos;ont pas pu être lus : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>Lecture des relevés...</div>
      ) : (
        <>
          <div style={{ ...carte, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <Chiffre titre="Personnes" valeur={String(resume.personnes)} />
            <Chiffre titre="Actes de travail" valeur={String(resume.actes)} />
            {!actesSeulement && <Chiffre titre="Connexions" valeur={String(resume.connexions)} />}
            {resume.horsZone > 0 && (
              <Chiffre titre="Hors zone du site" valeur={String(resume.horsZone)} couleur="#B45309" />
            )}
          </div>

          {groupes.length === 0 ? (
            <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>
              Aucun relevé sur la période. Si personne n&apos;est inscrit au module, c&apos;est
              le résultat attendu.
            </div>
          ) : (
            groupes.map((personne) => (
              <div key={personne.profileId} style={carte}>
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>{personne.nom}</h3>

                <div style={{ display: 'grid', gap: 8 }}>
                  {personne.jours.map((j) => {
                    const cle = personne.profileId + '@' + j.jour
                    const ouvert = !!ouverts[cle]
                    return (
                      <div key={cle} style={{ border: '1px solid #F3F4F6', borderRadius: 8 }}>
                        <button
                          type="button"
                          onClick={() => basculer(cle)}
                          style={{
                            width: '100%', textAlign: 'left', background: j.horsZone > 0 ? '#FFFBEB' : '#FAFAFA',
                            border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
                            fontSize: 13,
                          }}
                        >
                          <span>
                            <strong>{formaterJour(j.jour)}</strong>
                            <span style={{ color: '#6B7280' }}>
                              {' '}&mdash; {j.actes} acte{j.actes > 1 ? 's' : ''} de travail
                              {j.connexions > 0 && ', ' + j.connexions + ' connexion' + (j.connexions > 1 ? 's' : '')}
                              {j.premier && ' · de ' + heureLocale(j.premier.releve_le) + ' à ' + heureLocale(j.dernier.releve_le)}
                            </span>
                            {j.horsZone > 0 && (
                              <span style={{ color: '#B45309', fontWeight: 600 }}>
                                {' '}· {j.horsZone} hors zone
                              </span>
                            )}
                          </span>
                          <span style={{ color: '#9CA3AF' }}>{ouvert ? '▾' : '▸'}</span>
                        </button>

                        {ouvert && (
                          <div style={{ overflowX: 'auto', padding: '0 4px 4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={th}>Heure</th>
                                  <th style={th}>Action</th>
                                  <th style={th}>Position</th>
                                  <th style={th}>Précision</th>
                                  <th style={th}>Site</th>
                                  <th style={th} />
                                </tr>
                              </thead>
                              <tbody>
                                {j.releves.map((r) => {
                                  const lien = lienCarte(r.latitude, r.longitude)
                                  return (
                                    <tr key={r.id} style={{ background: r.dans_le_rayon === false ? '#FFFBEB' : undefined }}>
                                      <td style={td}>{heureLocale(r.releve_le)}</td>
                                      <td style={td}>{LIBELLES_ACTIONS[r.action_type] || r.action_type}</td>
                                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                                        {coordonneesLisibles(r.latitude, r.longitude)}
                                      </td>
                                      <td style={td}>
                                        {r.precision_metres == null ? '—' : Math.round(r.precision_metres) + ' m'}
                                      </td>
                                      <td style={td}>
                                        {r.distance_site_metres == null
                                          ? <span style={{ color: '#9CA3AF' }}>non comparé</span>
                                          : (
                                            <span style={{ color: r.dans_le_rayon ? '#047857' : '#B45309' }}>
                                              {Math.round(r.distance_site_metres)} m
                                              {r.dans_le_rayon ? ' (dans la zone)' : ' (hors zone)'}
                                            </span>
                                          )}
                                      </td>
                                      <td style={td}>
                                        {lien && (
                                          <a
                                            href={lien}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#0F766E', fontSize: 12.5 }}
                                          >
                                            Voir sur la carte
                                          </a>
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
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}

function formaterJour(jour) {
  const bouts = String(jour || '').split('-')
  if (bouts.length !== 3) return jour
  return bouts[2] + '/' + bouts[1] + '/' + bouts[0]
}

function Chiffre({ titre, valeur, couleur }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {titre}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: couleur || '#111827' }}>{valeur}</div>
    </div>
  )
}
