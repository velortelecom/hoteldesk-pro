// src/pages/SuperAdminFacturationProrata.jsx
// =====================================================================
// FACTURER LES CLIENTS, AU JOUR CHOISI.
//
// CE QUE CET ECRAN FAIT
//   Il demande a la base « qu'est-ce que je dois facturer a chacun, si
//   j'arrete au tel jour ». Il n'invente aucun montant : tout vient de
//   facturation_clients_global(). Le jour ou deux calculs coexisteraient,
//   ils finiraient par ne plus dire la meme chose.
//
// CE QU'IL NE FIGE PAS
//   Regarder ne change rien. Enregistrer avance le repere « facture
//   jusqu'au », et ce repere s'annule. Une periode annulee redevient
//   facturable a l'identique.
//
// DEUX ETATS QU'ON NE CONFOND PAS
//   « A jour » et « 0,00 EUR » ne se disent pas pareil. Un zero se lit
//   « ce client ne doit rien » ; la verite est « il est deja paye
//   jusqu'au 30 ». Les clients sans rien a facturer sont donc affiches
//   a part, pas melanges a la liste avec un montant nul.
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { telechargerXlsx } from '../lib/xlsx'
import { MESSAGE_EXPORT_REFUSE, peutExporter } from '../lib/droitsExport'
import {
  LARGEURS_FACTURATION, aujourdhui, construireLignesFacturation, euros,
  jjmmaaaa, libelleRienAFacturer, nomFichierFacturation, totauxFacturation,
  trierFacturation,
} from './facturationProrata'

const carte = { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #F3F4F6', verticalAlign: 'top' }

export default function SuperAdminFacturationProrata({ profile = null }) {
  const [jusquAu, setJusquAu] = useState(() => aujourdhui())
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [message, setMessage] = useState(null)

  const autorise = peutExporter(profile)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    const { data, error } = await supabase.rpc('facturation_clients_global', { p_jusqu_au: jusquAu })

    if (error) {
      // Pas de liste vide silencieuse : « aucun client a facturer » et
      // « la lecture a echoue » ne se ressemblent que pour la machine.
      console.error(
        '[facturation] lecture impossible. '
        + 'code=' + (error.code || '-')
        + ' message=' + (error.message || '-')
        + ' details=' + (error.details || '-')
        + ' hint=' + (error.hint || '-'),
      )
      setErreur(error.message || 'Lecture impossible.')
      setLignes([])
    } else {
      setLignes(data || [])
    }
    setChargement(false)
  }, [jusquAu])

  useEffect(() => { charger() }, [charger])

  const enregistrer = async (ligne) => {
    setEnCours(ligne.entreprise_id)
    setMessage(null)
    const { data, error } = await supabase.rpc('enregistrer_facturation_client', {
      p_entreprise_id: ligne.entreprise_id,
      p_jusqu_au: jusquAu,
    })
    setEnCours(null)

    if (error) {
      console.error('[facturation] enregistrement refuse : ' + (error.message || '-'))
      setMessage({ type: 'erreur', texte: error.message || 'Enregistrement impossible.' })
      return
    }
    setMessage({
      type: 'succes',
      texte: ligne.nom + ' : ' + euros(ligne.montant) + ' enregistres jusqu’au '
             + jjmmaaaa(jusquAu) + ' (reference ' + String(data).slice(0, 8) + ').',
    })
    charger()
  }

  const exporter = () => {
    // Le refus est ici, pas sur le bouton : `disabled` s'enleve en trois
    // secondes avec la console du navigateur.
    if (!peutExporter(profile)) return
    telechargerXlsx(
      nomFichierFacturation(jusquAu),
      'Facturation au ' + jjmmaaaa(jusquAu),
      construireLignesFacturation(lignes),
      { largeurs: LARGEURS_FACTURATION },
    )
  }

  const { aFacturer, ajour } = trierFacturation(lignes)
  const totaux = totauxFacturation(lignes)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={carte}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Facturation des clients</h2>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#6B7280', lineHeight: 1.6 }}>
          Chaque client est facture de son inscription &mdash; ou du lendemain de sa
          derniere facture &mdash; jusqu&apos;a la date choisie. Un mois complet coute
          toujours exactement le prix du pack ; une periode partielle est calculee au
          jour. Regarder ne change rien : seul le bouton <strong>Enregistrer</strong> avance
          le repere, et il s&apos;annule.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13 }}>
            Facturer jusqu&apos;au{' '}
            <input
              type="date"
              value={jusquAu}
              onChange={(e) => setJusquAu(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}
            />
          </label>

          <button
            type="button"
            onClick={exporter}
            disabled={!autorise || aFacturer.length === 0 || !!erreur}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13,
              background: (!autorise || aFacturer.length === 0 || !!erreur) ? '#D1D5DB' : '#0F766E',
              color: 'white',
              cursor: (!autorise || aFacturer.length === 0 || !!erreur) ? 'not-allowed' : 'pointer',
            }}
          >
            Exporter vers Excel
          </button>

          {!autorise && (
            <span style={{ fontSize: 12.5, color: '#6B7280' }}>{MESSAGE_EXPORT_REFUSE}</span>
          )}
        </div>
      </div>

      {message && (
        <div style={{
          ...carte,
          background: message.type === 'succes' ? '#ECFDF5' : '#FEF2F2',
          border: '1px solid ' + (message.type === 'succes' ? '#6EE7B7' : '#FCA5A5'),
          color: message.type === 'succes' ? '#065F46' : '#991B1B',
          fontSize: 13,
        }}>
          {message.texte}
        </div>
      )}

      {erreur ? (
        <div style={{ ...carte, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}>
          La facturation n&apos;a pas pu etre lue : {erreur}
        </div>
      ) : chargement ? (
        <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>Calcul en cours...</div>
      ) : (
        <>
          <div style={{ ...carte, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <Chiffre titre="Clients a facturer" valeur={String(totaux.clients)} />
            <Chiffre titre="Abonnements" valeur={euros(totaux.abonnement)} />
            <Chiffre titre="Supplements utilisateurs" valeur={euros(totaux.utilisateurs)} />
            <Chiffre titre="Total" valeur={euros(totaux.total)} couleur="#0F766E" />
            {totaux.aVerifier > 0 && (
              <Chiffre
                titre="A verifier avant envoi"
                valeur={String(totaux.aVerifier)}
                couleur="#B45309"
              />
            )}
          </div>

          {aFacturer.length === 0 ? (
            <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>
              Aucun client n&apos;a de periode a facturer au {jjmmaaaa(jusquAu)}.
            </div>
          ) : (
            <div style={{ ...carte, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Client</th>
                    <th style={th}>Pack</th>
                    <th style={th}>Periode</th>
                    <th style={th}>Jours</th>
                    <th style={th}>Abonnement</th>
                    <th style={th}>Supplement</th>
                    <th style={th}>Total</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {aFacturer.map((l) => (
                    <tr key={l.entreprise_id} style={{ background: l.remarque ? '#FFFBEB' : undefined }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {l.nom}
                        <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>
                          inscrit le {jjmmaaaa(l.inscrite_le)}
                          {l.deja_facture_au
                            ? ' · facture jusqu’au ' + jjmmaaaa(l.deja_facture_au)
                            : ' · jamais facture'}
                        </div>
                        {l.remarque && (
                          <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 4, lineHeight: 1.5 }}>
                            {l.remarque}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        {l.plan || '—'}
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {l.inclus == null ? 'sans forfait' : l.inclus + ' inclus'}
                        </div>
                      </td>
                      <td style={td}>
                        {jjmmaaaa(l.periode_debut)}
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>au {jjmmaaaa(l.periode_fin)}</div>
                      </td>
                      <td style={td}>{l.jours}</td>
                      <td style={td}>{euros(l.montant_abonnement)}</td>
                      <td style={td}>{euros(l.montant_utilisateurs)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{euros(l.montant)}</td>
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => enregistrer(l)}
                          disabled={enCours === l.entreprise_id}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: '1px solid #0F766E',
                            background: 'white', color: '#0F766E', fontSize: 12.5,
                            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {enCours === l.entreprise_id ? '...' : 'Enregistrer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ajour.length > 0 && (
            <div style={carte}>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>
                Deja a jour ({ajour.length})
              </h3>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                Ces clients ne sont pas oublies : ils n&apos;ont simplement rien a facturer
                a cette date. Les afficher a 0,00 &euro; laisserait croire qu&apos;ils ne
                doivent rien, ce qui n&apos;est pas la meme chose.
              </p>
              <div style={{ display: 'grid', gap: 6 }}>
                {ajour.map((l) => (
                  <div key={l.entreprise_id} style={{ fontSize: 13, color: '#374151' }}>
                    <strong>{l.nom}</strong>
                    <span style={{ color: '#6B7280' }}> — {libelleRienAFacturer(l)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
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
