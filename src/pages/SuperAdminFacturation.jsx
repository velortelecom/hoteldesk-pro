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
import { FONDATEURS_MAX } from '../lib/offres'
import {
  LARGEURS_EXPORT, LARGEURS_EXPORT_ENTREPRISE, construireLignesExport,
  construireLignesExportEntreprise, etatFondateurs, euros, libellePeriode,
  lignesFacture, nomFichierExport, nomFichierExportEntreprise, nomFormule,
  periodesProposees, premierDuMois, repartirUtilisateurs, totauxFacturation,
} from './facturationExport'

// Pastille « Fondateur » : le tarif a 29 EUR est reserve aux cinq
// premieres entreprises et bloque a vie. Sans marque visible, une ligne a
// 29 EUR au milieu de lignes a 39 passe pour une erreur de prix.
function PastilleFondateur({ petite }) {
  return (
    <span style={{
      background: '#FEF3C7', color: '#92400E', borderRadius: 999,
      fontSize: petite ? 10 : 11, fontWeight: 700,
      padding: petite ? '1px 6px' : '2px 8px', whiteSpace: 'nowrap',
    }}>
      Fondateur
    </span>
  )
}

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
  // Detail d'une entreprise : l'entreprise choisie, ses comptes et tout
  // son historique fige.
  const [detail, setDetail] = useState(null)
  // Places de fondateur restantes. Lu en base (places_fondateur_restantes)
  // et pas deduit du tableau : une entreprise supprimee libererait sinon
  // une place dans l'affichage sans en liberer une dans le compteur.
  const [placesFondateur, setPlacesFondateur] = useState(null)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)

    const [globalRes, relevesRes, placesRes] = await Promise.all([
      supabase.rpc('etat_facturation_global', { p_periode: periode }),
      supabase
        .from('releves_facturation')
        .select('entreprise_id, periode, plan, utilisateurs, inclus, surplus, prix_base, supplement, prix_total, sur_devis, fige_le, entreprises(nom)')
        .eq('periode', periode)
        .order('fige_le', { ascending: true }),
      supabase.rpc('places_fondateur_restantes'),
    ])

    // Le compteur de fondateurs n'est pas vital pour l'ecran : s'il
    // echoue, on l'ecrit en console et on masque la vignette plutot que
    // de faire tomber toute la page.
    if (placesRes.error) {
      console.warn('[facturation] places_fondateur_restantes a echoue : '
        + (placesRes.error.message || '-'))
      setPlacesFondateur(null)
    } else {
      setPlacesFondateur(placesRes.data)
    }

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

  // DETAIL D'UNE ENTREPRISE.
  //
  // Le tableau donne un total ; le detail donne QUI est compte. C'est ce
  // qu'on montre au client qui appelle en disant « je ne suis que dix »,
  // et sans ca le chiffre n'est pas defendable.
  const ouvrirDetail = async (ligne) => {
    setDetail({ ligne, chargement: true, profils: [], historique: [], erreur: null })

    const [profilsRes, histoRes] = await Promise.all([
      supabase
        .from('profiles_with_email')
        .select('id, prenom, nom, role, email, actif, is_super_admin')
        .eq('entreprise_id', ligne.entreprise_id)
        .order('nom'),
      supabase
        .from('releves_facturation')
        .select('periode, plan, utilisateurs, inclus, surplus, prix_base, supplement, prix_total, sur_devis, fige_le')
        .eq('entreprise_id', ligne.entreprise_id)
        .order('periode', { ascending: false }),
    ])

    const echec = profilsRes.error || histoRes.error
    if (echec) {
      console.error(
        '[facturation] detail illisible pour ' + ligne.nom + '. '
        + 'code=' + (echec.code || '-')
        + ' message=' + (echec.message || '-')
        + ' details=' + (echec.details || '-')
        + ' hint=' + (echec.hint || '-'),
      )
      setDetail({ ligne, chargement: false, profils: [], historique: [], erreur: echec.message || 'Lecture refusee.' })
      return
    }

    setDetail({
      ligne,
      chargement: false,
      profils: profilsRes.data || [],
      historique: histoRes.data || [],
      erreur: null,
    })
  }

  const exporterEntreprise = () => {
    if (!detail) return
    telechargerXlsx(
      nomFichierExportEntreprise(detail.ligne.nom),
      'Facturation',
      construireLignesExportEntreprise(detail.historique),
      { largeurs: LARGEURS_EXPORT_ENTREPRISE },
    )
  }

  const { totalDirect, totalReleve, nbDevis, nbDebordement, resteAFiger, periodeFigee } =
    totauxFacturation(direct, releves)
  const fondateurs = etatFondateurs(placesFondateur, FONDATEURS_MAX)

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
            {fondateurs && (
              <Chiffre
                titre={'Fondateurs a ' + fondateurs.tarif + ' \u20ac a vie'}
                valeur={fondateurs.libelle}
                couleur="#92400E"
              />
            )}
            <Chiffre titre="Sur devis" valeur={String(nbDevis)} couleur="#8B5CF6" />
          </div>

          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            Calcul en direct <span style={{ fontWeight: 400, color: '#9CA3AF' }}>&mdash; bouge a chaque embauche.
            Cliquez une ligne pour le detail de ce qu&apos;elle doit.</span>
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
                  <tr
                    key={l.entreprise_id}
                    onClick={() => ouvrirDetail(l)}
                    title={'Voir le detail de ' + l.nom}
                    style={{ cursor: 'pointer', background: Number(l.supplement || 0) > 0 ? '#FFFBEB' : undefined }}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>
                      <span style={{ color: '#1D4ED8', textDecoration: 'underline dotted' }}>{l.nom}</span>
                      {l.tarif_fondateur && <span style={{ marginLeft: 6 }}><PastilleFondateur petite /></span>}
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

      {detail && (
        <PanneauDetail
          detail={detail}
          periode={periode}
          onFermer={() => setDetail(null)}
          onExporter={exporterEntreprise}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// LE DETAIL D'UNE ENTREPRISE
// ---------------------------------------------------------------------
function PanneauDetail({ detail, periode, onFermer, onExporter }) {
  const l = detail.ligne
  const { comptes, exclus } = repartirUtilisateurs(detail.profils)
  const lignes = lignesFacture(l)

  // Si la liste lue ici ne donne pas le meme nombre que la base, on le
  // DIT. Un ecart vient d'une lecture partielle (RLS) ou d'une regle de
  // comptage qui a divergé ; dans les deux cas, le cacher serait pire
  // que l'afficher -- c'est le chiffre qu'on facture.
  const ecart = !detail.chargement && !detail.erreur
    && comptes.length !== Number(l.utilisateurs)

  const totalHistorique = detail.historique.reduce(
    (s, r) => s + (r && r.prix_total != null ? Number(r.prix_total) : 0), 0,
  )

  return (
    <div
      onClick={onFermer}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 1002 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: '100%', maxWidth: 620, height: '100%', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              {l.nom}
              {l.tarif_fondateur && <PastilleFondateur />}
            </div>
            <div style={{ fontSize: 12.5, color: '#6B7280' }}>
              {nomFormule(l.plan)}
              {l.inclus != null && ' \u00b7 ' + l.inclus + ' utilisateurs compris'}
              {l.actif === false && ' \u00b7 entreprise inactive'}
            </div>
          </div>
          <button onClick={onFermer} style={{ border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: '#6B7280' }}>&times;</button>
        </div>

        {/* CE QU'ELLE DOIT, LIGNE PAR LIGNE */}
        <div style={{ ...carte, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em', marginBottom: 10 }}>
            CE QU&apos;ELLE DOIT EN {libellePeriode(periode).toUpperCase()}
          </div>
          {lignes.map(ligne => (
            <div
              key={ligne.cle}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '7px 0', fontSize: 13.5,
                borderTop: ligne.total ? '1px solid #E5E7EB' : undefined,
                marginTop: ligne.total ? 6 : 0,
                fontWeight: ligne.total ? 700 : 400,
                color: ligne.montant == null && !ligne.total ? '#92400E' : '#374151',
              }}
            >
              <span>
                {ligne.libelle}
                {ligne.mention && (
                  <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>{ligne.mention}</div>
                )}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>
                {ligne.montant == null
                  ? (l.sur_devis && ligne.total ? 'Sur devis' : '\u2014')
                  : euros(ligne.montant)}
              </span>
            </div>
          ))}
        </div>

        {detail.erreur && (
          <div style={{ ...carte, marginTop: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}>
            Les comptes de cette entreprise n&apos;ont pas pu etre lus : {detail.erreur}
          </div>
        )}

        {ecart && (
          <div style={{ ...carte, marginTop: 16, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, lineHeight: 1.6 }}>
            La base facture <strong>{l.utilisateurs}</strong> utilisateurs, mais cette liste
            en montre <strong>{comptes.length}</strong>. C&apos;est le chiffre de la base qui
            est facture. A verifier avant d&apos;envoyer la facture.
          </div>
        )}

        {/* QUI EST COMPTE */}
        <div style={{ ...carte, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em', marginBottom: 4 }}>
            LES {comptes.length} COMPTES FACTURES
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
            Comptes actifs, hors compte de supervision Velor.
          </div>
          {detail.chargement ? (
            <div style={{ fontSize: 13, color: '#6B7280' }}>Lecture des comptes...</div>
          ) : (
            <>
              {comptes.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 13, borderTop: i === 0 ? undefined : '1px solid #F3F4F6' }}>
                  <span>{(p.prenom || '') + ' ' + (p.nom || '')}</span>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>{p.role}</span>
                </div>
              ))}
              {comptes.length === 0 && (
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>Aucun compte actif.</div>
              )}

              {exclus.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 6 }}>
                    NON FACTURES ({exclus.length})
                  </div>
                  {exclus.map(x => (
                    <div key={x.profil.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 12.5, color: '#9CA3AF' }}>
                      <span style={{ textDecoration: 'line-through' }}>{(x.profil.prenom || '') + ' ' + (x.profil.nom || '')}</span>
                      <span>{x.raison}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* CE QU'ON LUI A DEJA FACTURE */}
        <div style={{ ...carte, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em' }}>
                HISTORIQUE FIGE
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {detail.historique.length === 0
                  ? 'Aucune periode figee pour cette entreprise.'
                  : detail.historique.length + ' periode(s), ' + euros(totalHistorique) + ' au total'}
              </div>
            </div>
            <button
              onClick={onExporter}
              disabled={detail.historique.length === 0}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12.5,
                background: '#fff', whiteSpace: 'nowrap',
                color: detail.historique.length === 0 ? '#9CA3AF' : '#374151',
                cursor: detail.historique.length === 0 ? 'default' : 'pointer',
              }}
            >
              Exporter vers Excel
            </button>
          </div>

          {detail.historique.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Periode</th>
                  <th style={th}>Utilisateurs</th>
                  <th style={th}>Au-dela</th>
                  <th style={th}>Tarif</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.historique.map(r => (
                  <tr key={r.periode}>
                    <td style={td}>{libellePeriode(r.periode)}</td>
                    <td style={td}>{r.utilisateurs}</td>
                    <td style={td}>{Number(r.surplus) > 0 ? '+' + r.surplus : '\u2014'}</td>
                    <td style={td}>{r.tarif_fondateur ? <PastilleFondateur petite /> : 'public'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {r.sur_devis ? <span style={{ color: '#8B5CF6' }}>Sur devis</span> : euros(r.prix_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
