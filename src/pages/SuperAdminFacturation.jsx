// src/pages/SuperAdminFacturation.jsx
// =====================================================================
// FACTURATION -- L'ARRET DES COMPTEURS, A LA MAIN.
//
// POURQUOI UN BOUTON ET PAS UNE TACHE AUTOMATIQUE
//   Figer une periode, c'est decider ce qu'on facture. Une tache
//   automatique le ferait la nuit du 1er, sur l'effectif de cette
//   nuit-la, sans que personne ait regarde -- et si une entreprise venait
//   de passer sur devis, le montant partait faux. Ici, on voit la liste
//   AVANT de figer.
//
// CE QU'ON VOIT
//   - a gauche du bouton : le calcul EN DIRECT, qui bouge a chaque
//     embauche ;
//   - apres le clic : le RELEVE, qui ne bouge plus.
//   Les deux sont affiches ensemble exprès. Un ecran qui ne montrerait
//   que le direct laisserait croire qu'une facture peut encore changer ;
//   un ecran qui ne montrerait que le releve cacherait les embauches du
//   mois en cours.
//
// LE CALCUL N'EST PAS REFAIT ICI. Les montants viennent de
// etat_facturation_global(), qui appelle la meme fonction que la page
// Offres du client et que le figeage. Aucun euro n'est calcule dans le
// navigateur.
// =====================================================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { telechargerXlsx } from '../lib/xlsx'
import {
  LARGEURS_EXPORT, construireLignesExport, euros,
  libellePeriode, nomFichierExport, periodesProposees, premierDuMois,
  totauxFacturation,
} from './facturationExport'

const carte = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 16 }
const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
const td = { fontSize: 13, padding: '9px 10px', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }

export default function SuperAdminFacturation() {
  const [periode, setPeriode] = useState(premierDuMois(new Date()))
  const [direct, setDirect] = useState([])
  const [releves, setReleves] = useState([])
  const [chargement, setChargement] = useState(true)
  // Une erreur ne se remplace JAMAIS par une liste vide : sans ca, l'ecran
  // afficherait "aucune entreprise" alors que la lecture a echoue.
  const [erreur, setErreur] = useState(null)
  const [figeage, setFigeage] = useState(false)
  const [retour, setRetour] = useState(null)
  const [confirmation, setConfirmation] = useState(false)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)

    const [globalRes, relevesRes] = await Promise.all([
      supabase.rpc('etat_facturation_global', { p_periode: periode }),
      supabase
        .from('releves_facturation')
        .select('entreprise_id, periode, plan, utilisateurs, inclus, surplus, prix_base, supplement, prix_total, sur_devis, fige_le, entreprises(nom)')
        .eq('periode', periode)
        .order('fige_le', { ascending: true }),
    ])

    const echec = globalRes.error || relevesRes.error
    if (echec) {
      console.error(
        '[facturation] lecture impossible. '
        + 'code=' + (echec.code || '-')
        + ' message=' + (echec.message || '-')
        + ' details=' + (echec.details || '-')
        + ' hint=' + (echec.hint || '-'),
      )
      setErreur(echec.message || 'Lecture impossible.')
      setChargement(false)
      return
    }

    setDirect(globalRes.data || [])
    setReleves(relevesRes.data || [])
    setChargement(false)
  }, [periode])

  useEffect(() => { charger() }, [charger])

  const figer = async () => {
    setConfirmation(false)
    setFigeage(true)
    setRetour(null)

    const { data, error } = await supabase.rpc('figer_releves_facturation', { p_periode: periode })

    if (error) {
      console.error(
        '[facturation] figeage impossible. '
        + 'code=' + (error.code || '-')
        + ' message=' + (error.message || '-')
        + ' details=' + (error.details || '-')
        + ' hint=' + (error.hint || '-'),
      )
      setRetour({ type: 'erreur', texte: 'Le figeage a echoue : ' + (error.message || 'erreur inconnue') })
      setFigeage(false)
      return
    }

    const crees = Number(data || 0)
    setRetour({
      type: crees > 0 ? 'ok' : 'neutre',
      texte: crees > 0
        ? crees + ' releve' + (crees > 1 ? 's' : '') + ' fige' + (crees > 1 ? 's' : '') + ' pour ' + libellePeriode(periode) + '.'
        : 'Rien de nouveau : ' + libellePeriode(periode) + ' etait deja fige pour toutes les entreprises. Les montants existants n\'ont pas ete touches.',
    })
    setFigeage(false)
    charger()
  }

  const exporter = () => {
    // On exporte le RELEVE FIGE, pas le calcul en direct : un export sert
    // a facturer, et le direct change encore a chaque embauche. Tant que
    // la periode n'est pas figee, il n'y a rien a exporter.
    telechargerXlsx(
      nomFichierExport(periode),
      'Facturation ' + libellePeriode(periode),
      construireLignesExport(releves),
      { largeurs: LARGEURS_EXPORT },
    )
  }

  const { totalDirect, totalReleve, nbDevis, nbDebordement, resteAFiger, periodeFigee } =
    totauxFacturation(direct, releves)

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Facturation</h2>
      <p style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
        Le montant d&apos;une entreprise depend de son effectif, qui bouge en cours de mois.
        <strong> Figer</strong> une periode arrete le compteur : c&apos;est ce montant-la qu&apos;on
        facture, et il ne changera plus, meme si l&apos;entreprise embauche ensuite.
        Une periode deja figee n&apos;est jamais reecrite.
      </p>

      {erreur && (
        <div style={{ ...carte, borderLeft: '3px solid #EF4444', background: '#FEF2F2', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
          {erreur}
          <div style={{ fontSize: 12, marginTop: 6, color: '#7F1D1D' }}>
            Si le message parle d&apos;une fonction inexistante, la migration
            20260917_0007 (et 0008) n&apos;a pas encore ete appliquee.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={periode}
          onChange={e => { setPeriode(e.target.value); setRetour(null) }}
          style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}
        >
          {periodesProposees().map(p => <option key={p} value={p}>{libellePeriode(p)}</option>)}
        </select>

        <button
          onClick={() => setConfirmation(true)}
          disabled={figeage || chargement || !!erreur || resteAFiger === 0}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13,
            background: (figeage || chargement || !!erreur || resteAFiger === 0) ? '#BFDBFE' : '#3B82F6',
            color: '#fff', cursor: (figeage || chargement || !!erreur || resteAFiger === 0) ? 'default' : 'pointer',
          }}
        >
          {figeage ? 'Figeage...' : resteAFiger === 0 ? 'Periode figee' : 'Figer ' + libellePeriode(periode) + ' (' + resteAFiger + ')'}
        </button>

        <button
          onClick={exporter}
          disabled={releves.length === 0}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13,
            background: '#fff', color: releves.length === 0 ? '#9CA3AF' : '#374151',
            cursor: releves.length === 0 ? 'default' : 'pointer',
          }}
          title={releves.length === 0 ? 'Rien a exporter : la periode n\'est pas encore figee' : 'Telecharger le releve fige au format .xlsx'}
        >
          Exporter vers Excel
        </button>

        {periodeFigee && (
          <span style={{ fontSize: 12, fontWeight: 700, background: '#ECFDF5', color: '#065F46', borderRadius: 999, padding: '4px 10px' }}>
            Periode figee
          </span>
        )}
      </div>

      {retour && (
        <div style={{
          ...carte, marginBottom: 16, fontSize: 13,
          borderLeft: '3px solid ' + (retour.type === 'erreur' ? '#EF4444' : retour.type === 'ok' ? '#10B981' : '#9CA3AF'),
          background: retour.type === 'erreur' ? '#FEF2F2' : retour.type === 'ok' ? '#ECFDF5' : '#F9FAFB',
          color: retour.type === 'erreur' ? '#991B1B' : '#374151',
        }}>
          {retour.texte}
        </div>
      )}

      {confirmation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 460, width: '100%' }}>
            <h3 style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 10 }}>
              Figer {libellePeriode(periode)} ?
            </h3>
            <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
              {resteAFiger} entreprise{resteAFiger > 1 ? 's' : ''} sera{resteAFiger > 1 ? 'nt' : ''} figee
              {resteAFiger > 1 ? 's' : ''} sur leur effectif d&apos;aujourd&apos;hui, pour un total
              de <strong>{euros(totalDirect)}</strong>.
            </p>
            <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.7, marginBottom: 20 }}>
              Les entreprises deja figees pour cette periode ne seront pas touchees.
              Un releve fige ne peut pas etre modifie depuis cet ecran.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmation(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={figer} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Figer la periode</button>
            </div>
          </div>
        </div>
      )}

      {chargement ? (
        <div style={{ ...carte, color: '#6B7280', fontSize: 13 }}>Lecture des montants...</div>
      ) : erreur ? null : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
            <Chiffre titre="Total en direct" valeur={euros(totalDirect)} couleur="#3B82F6" />
            <Chiffre titre={'Total fige (' + releves.length + ')'} valeur={releves.length ? euros(totalReleve) : '—'} couleur="#10B981" />
            <Chiffre titre="En debordement" valeur={String(nbDebordement)} couleur="#F59E0B" />
            <Chiffre titre="Sur devis" valeur={String(nbDevis)} couleur="#8B5CF6" />
          </div>

          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            Calcul en direct <span style={{ fontWeight: 400, color: '#9CA3AF' }}>&mdash; bouge a chaque embauche</span>
          </h3>
          <div style={{ ...carte, padding: 0, overflowX: 'auto', marginBottom: 22 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Entreprise</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Utilisateurs</th>
                  <th style={th}>Inclus</th>
                  <th style={th}>Au-dela</th>
                  <th style={th}>Base</th>
                  <th style={th}>Supplement</th>
                  <th style={th}>Total</th>
                  <th style={th}>Periode</th>
                </tr>
              </thead>
              <tbody>
                {direct.length === 0 && (
                  <tr><td style={{ ...td, color: '#9CA3AF' }} colSpan={9}>Aucune entreprise.</td></tr>
                )}
                {direct.map(l => (
                  <tr key={l.entreprise_id} style={{ background: Number(l.supplement || 0) > 0 ? '#FFFBEB' : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {l.nom}
                      {!l.actif && <span style={{ marginLeft: 6, fontSize: 11, color: '#9CA3AF' }}>(inactive)</span>}
                    </td>
                    <td style={td}>{l.plan || '—'}</td>
                    <td style={td}>{l.utilisateurs}</td>
                    <td style={td}>{l.inclus == null ? '—' : l.inclus}</td>
                    <td style={{ ...td, fontWeight: Number(l.surplus) > 0 ? 700 : 400 }}>{Number(l.surplus) > 0 ? '+' + l.surplus : '—'}</td>
                    <td style={td}>{euros(l.prix_base)}</td>
                    <td style={td}>{Number(l.supplement || 0) > 0 ? euros(l.supplement) : '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {l.sur_devis ? <span style={{ color: '#8B5CF6' }}>Sur devis</span> : euros(l.prix_total)}
                    </td>
                    <td style={td}>
                      {l.fige
                        ? <span style={{ fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#065F46', borderRadius: 999, padding: '2px 8px' }}>figee</span>
                        : <span style={{ fontSize: 11, color: '#9CA3AF' }}>ouverte</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            Releve fige de {libellePeriode(periode)} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>&mdash; ce qu&apos;on facture</span>
          </h3>
          <div style={{ ...carte, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Entreprise</th>
                  <th style={th}>Utilisateurs</th>
                  <th style={th}>Au-dela</th>
                  <th style={th}>Base</th>
                  <th style={th}>Supplement</th>
                  <th style={th}>Total</th>
                  <th style={th}>Fige le</th>
                </tr>
              </thead>
              <tbody>
                {releves.length === 0 && (
                  <tr>
                    <td style={{ ...td, color: '#9CA3AF' }} colSpan={7}>
                      Cette periode n&apos;est pas figee. Rien n&apos;est facturable tant qu&apos;elle ne l&apos;est pas.
                    </td>
                  </tr>
                )}
                {releves.map(r => (
                  <tr key={r.entreprise_id + r.periode}>
                    <td style={{ ...td, fontWeight: 600 }}>{(r.entreprises && r.entreprises.nom) || r.entreprise_id}</td>
                    <td style={td}>{r.utilisateurs}</td>
                    <td style={td}>{Number(r.surplus) > 0 ? '+' + r.surplus : '—'}</td>
                    <td style={td}>{euros(r.prix_base)}</td>
                    <td style={td}>{Number(r.supplement || 0) > 0 ? euros(r.supplement) : '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {r.sur_devis ? <span style={{ color: '#8B5CF6' }}>Sur devis</span> : euros(r.prix_total)}
                    </td>
                    <td style={{ ...td, color: '#6B7280', fontSize: 12 }}>
                      {r.fige_le ? new Date(r.fige_le).toLocaleString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Chiffre({ titre, valeur, couleur }) {
  return (
    <div style={{ ...carte, borderLeft: '3px solid ' + couleur }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>{titre}</div>
    </div>
  )
}
