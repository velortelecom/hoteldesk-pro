// src/pages/Offres.jsx
// =====================================================================
// OFFRES & PACKS - espace client
//
// Regle produit : un client ne peut JAMAIS activer un pack superieur
// lui-meme. Les modules non developpes sont presentes en "Disponible sur
// demande" avec un bouton de contact. La seule ecriture possible ici est
// une ligne dans demandes_pack (statut 'nouvelle'), que le Super Admin
// Velor One traite manuellement.
// =====================================================================
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useModules } from '../hooks/useModules'
import { PLANS, PLAN_ORDER } from '../lib/modules'
import { etatFinAbonnement, texteDecompte } from '../lib/abonnement'
import { getModuleById, MODULES_REGISTRY } from '../modules/registry'
import {
  PLAN_1_LABEL, PLAN_1_PRIX_MENSUEL, PLAN_1_MAX_UTILISATEURS,
  PLAN_1_SOCLE, PLAN_1_MODULES_DETAIL, STATUT_SUR_DEMANDE,
} from '../lib/plan1'
import { OFFRES_VENDUES, PLAFOND_FORFAIT, TARIF_FONDATEUR } from '../lib/offres'

const STATUT_LABEL = {
  nouvelle: { texte: 'Demande envoyee', bg: '#EEF2FF', fg: '#3730A3' },
  en_cours: { texte: 'En cours de traitement', bg: '#FFFBEB', fg: '#92400E' },
  traitee: { texte: 'Traitee', bg: '#ECFDF5', fg: '#065F46' },
  refusee: { texte: 'Non retenue', bg: '#FEF2F2', fg: '#991B1B' },
}

const carte = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }

function Pastille({ children, bg, fg }) {
  return (
    <span style={{ background: bg, color: fg, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export default function Offres() {
  const { profile, user, entrepriseId } = useAuth()

  // Le bloc "VOTRE PLAN" affichait PLAN_1_LABEL / 29 EUR / 10 utilisateurs en
  // dur : quel que soit le pack accorde par le Super Admin, le client lisait
  // toujours Plan 1. Ces valeurs viennent maintenant de sa vraie ligne
  // entreprises, et la liste des modules de ses modules reellement actifs.
  const { entreprise, getActiveModuleIds, loading: chargementModules } = useModules()

  const [demandes, setDemandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [packOuvert, setPackOuvert] = useState(null)
  const [message, setMessage] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [retour, setRetour] = useState(null)

  const estAdmin = profile?.role === 'admin' || profile?.is_super_admin

  const planId = entreprise?.plan || 'starter'
  const planInfo = PLANS[planId] || null
  // La formule de base garde son nom commercial (Pack Starter) ; les autres
  // prennent celui du catalogue PLANS.
  const planLabel = planId === 'starter' ? PLAN_1_LABEL : (planInfo?.nom || planId)
  const planPrix = entreprise?.prix_mensuel != null ? entreprise.prix_mensuel : (planInfo?.prix != null ? planInfo.prix : PLAN_1_PRIX_MENSUEL)
  const planMaxUsers = entreprise?.max_utilisateurs != null ? entreprise.max_utilisateurs : (planInfo?.max_utilisateurs != null ? planInfo.max_utilisateurs : PLAN_1_MAX_UTILISATEURS)

  // Tarif fondateur : les premieres entreprises gardent leur prix a vie.
  // On ne stocke aucun indicateur pour ca -- le prix fige dans la ligne
  // entreprises SUFFIT, puisque l'affichage le lit en priorite sur la
  // grille. Si un jour PRIX_STANDARD change, cette entreprise ne bouge pas.
  const estFondateur = planId === 'starter'
    && entreprise?.prix_mensuel != null
    && Number(entreprise.prix_mensuel) === TARIF_FONDATEUR

  // Modules reellement actifs, presentes avec le libelle du registre. On
  // retombe sur la liste Plan 1 tant que les modules n'ont pas fini de
  // charger, pour ne pas faire clignoter un encart vide.
  const idsActifs = getActiveModuleIds()
  const modulesAffiches = chargementModules
    ? PLAN_1_MODULES_DETAIL
    : idsActifs
        .map(id => MODULES_REGISTRY.find(m => m.id === id))
        .filter(Boolean)
        .map(m => ({ id: m.id, label: m.nom, icone: m.icone, detail: m.description }))

  // Toutes les formules, pas seulement celles au-dessus : un client doit
  // pouvoir demander a REDESCENDRE. Sans ca, la seule sortie possible etait
  // de nous ecrire en dehors de l'outil.
  //
  // La liste vient d'offres.js, source unique. Elle etait auparavant
  // reconstituee ici a partir de PACKS_SUPERIEURS avec un cas particulier
  // pour le Plan 1 -- ce qui a cesse de fonctionner des qu'une formule est
  // apparue EN DESSOUS du Starter.
  const formules = OFFRES_VENDUES.map(offre => ({
    id: offre.id,
    nom: offre.id === 'starter' ? PLAN_1_LABEL : offre.nom,
    couleur: offre.couleur,
    resume: offre.resume,
    modules: offre.modules,
    prix: offre.prix,
    maxUtilisateurs: offre.maxUtilisateurs,
    debordement: offre.debordement,
  }))

  const rangActuel = PLAN_ORDER.indexOf(planId)

  // Fin d'abonnement proche, et seulement si le renouvellement mensuel n'est
  // pas actif : dans le cas contraire la date avance toute seule et il n'y a
  // rien a anticiper.
  const finProche = etatFinAbonnement(entreprise)

  // Une demande ne bloque le bouton que TANT QU'ELLE EST EN COURS. Avant,
  // le test etait `statut !== 'refusee'` : une demande traitee laissait donc
  // le bouton grise definitivement, et le client ne pouvait plus jamais rien
  // demander pour ce pack.
  const enAttente = (demande) => !!demande && (demande.statut === 'nouvelle' || demande.statut === 'en_cours')

  const charger = useCallback(async () => {
    if (!entrepriseId) { setDemandes([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('demandes_pack')
      .select('*')
      .eq('entreprise_id', entrepriseId)
      .order('created_at', { ascending: false })
    setDemandes(data || [])
    setLoading(false)
  }, [entrepriseId])

  useEffect(() => { charger() }, [charger])

  function ouvrirDemande(pack) {
    setRetour(null)
    setMessage('')
    setPackOuvert(pack)
  }

  async function envoyerDemande() {
    if (!packOuvert) return
    // Plus de retour silencieux : si quelque chose manque, on le dit.
    if (!entrepriseId || !profile?.id) {
      setRetour({ type: 'error', texte: "Votre compte n'est rattache a aucune entreprise. Reconnectez-vous, et si cela persiste contactez Velor One." })
      setPackOuvert(null)
      return
    }
    setEnvoi(true)
    setRetour(null)
    const { error } = await supabase.from('demandes_pack').insert({
      entreprise_id: entrepriseId,
      demandeur_id: profile.id,
      pack_demande: packOuvert.id,
      modules_demandes: packOuvert.modules,
      message: message.trim() || null,
      contact_email: user?.email || null,
      contact_telephone: profile.telephone || null,
      statut: 'nouvelle',
    })
    setEnvoi(false)
    if (error) {
      setRetour({ type: 'error', texte: "La demande n'a pas pu etre envoyee : " + error.message })
      return
    }
    setPackOuvert(null)
    setRetour({ type: 'success', texte: 'Demande envoyee. Velor One vous recontacte pour la suite.' })
    charger()
  }

  const demandeParPack = {}
  demandes.forEach(d => { if (!demandeParPack[d.pack_demande]) demandeParPack[d.pack_demande] = d })

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Offres &amp; modules</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Ce qui est actif dans votre abonnement, et ce que Velor One peut activer pour vous.
      </p>

      {retour && (
        <div style={{
          borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16,
          background: retour.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: '1px solid ' + (retour.type === 'success' ? '#A7F3D0' : '#FECACA'),
          color: retour.type === 'success' ? '#065F46' : '#DC2626',
        }}>
          {retour.texte}
        </div>
      )}

      {/* PLAN ACTUEL */}
      <div style={{ ...carte, marginBottom: 20, borderLeft: '3px solid #185FA5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em' }}>VOTRE PLAN</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>{planLabel}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {planPrix != null ? planPrix + ' \u20ac / mois' : 'Tarif sur mesure'}
              {planMaxUsers != null ? ' \u00b7 jusqu\u2019a ' + planMaxUsers + ' utilisateurs' : ' \u00b7 utilisateurs illimites'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Le tarif fondateur se lit sur le prix REEL de l'entreprise, pas
                sur la grille : c'est justement ce qui le rend permanent. */}
            {estFondateur && <Pastille bg="#FEF3C7" fg="#92400E">Tarif fondateur &mdash; bloque a vie</Pastille>}
            {finProche && finProche.niveau === 'expire'
              ? <Pastille bg="#FEF2F2" fg="#991B1B">Lecture seule</Pastille>
              : <Pastille bg="#ECFDF5" fg="#065F46">Actif</Pastille>}
          </div>
        </div>

        {estFondateur && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.6, marginTop: 14 }}>
            Vous faites partie des premieres entreprises inscrites. Votre tarif de{' '}
            <strong>{TARIF_FONDATEUR} &euro; / mois</strong> est bloque <strong>a vie</strong> sur
            le perimetre souscrit &mdash; le socle, Organisation &amp; RH, Conges et Pointage &mdash;
            quelle que soit l&apos;evolution de nos tarifs publics. Les modules publies
            ulterieurement pourront faire l&apos;objet d&apos;une option.
          </div>
        )}

        {finProche && (
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            background: finProche.niveau === 'expire' ? '#FEF2F2' : '#FFFBEB',
            border: '1px solid ' + (finProche.niveau === 'expire' ? '#FECACA' : '#FDE68A'),
            color: finProche.niveau === 'expire' ? '#991B1B' : '#92400E',
          }}>
            <span style={{
              flexShrink: 0, fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 10px',
              background: finProche.niveau === 'expire' ? '#991B1B' : '#92400E', color: '#fff',
            }}>
              {texteDecompte(finProche)}
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {finProche.niveau === 'expire' ? (
                <>
                  <strong>Votre abonnement a pris fin le {finProche.fin.toLocaleDateString('fr-FR')}.</strong>{' '}
                  Votre espace est en lecture seule : tout reste consultable, seules les modifications
                  sont suspendues. Vos donnees sont intactes et reviennent des la reactivation.
                </>
              ) : (
                <>
                  <strong>Votre abonnement prend fin le {finProche.fin.toLocaleDateString('fr-FR')}.</strong>{' '}
                  Le renouvellement automatique n&apos;est pas actif : sans reconduction, votre espace
                  passera en lecture seule a cette date. Contactez Velor One pour le reconduire.
                </>
              )}
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginTop: 18 }}>
          {[...PLAN_1_SOCLE, ...modulesAffiches].map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, lineHeight: '18px' }}>{m.icone}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{m.label}</div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{m.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TOUTES LES FORMULES */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Les formules</h2>
      <p style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14, lineHeight: 1.6 }}>
        Aucun changement de formule ne se fait en ligne : votre demande nous parvient, nous vous
        recontactons, et la modification est appliquee a la main. Vous pouvez demander une formule
        superieure comme revenir a une formule inferieure.
        {' '}Au-dela de {PLAFOND_FORFAIT} utilisateurs, aucune formule ne s&apos;applique au
        forfait : nous etablissons un devis avec vous.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {formules.map(pack => {
          const demande = demandeParPack[pack.id]
          const estActuelle = pack.id === planId
          const rang = PLAN_ORDER.indexOf(pack.id)
          const descend = rang < rangActuel
          const attente = enAttente(demande)
          return (
            <div key={pack.id} style={{ ...carte, borderLeft: '3px solid ' + pack.couleur, background: estActuelle ? '#F8FAFC' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{pack.nom}</span>
                    {estActuelle
                      ? <Pastille bg="#ECFDF5" fg="#065F46">Votre formule</Pastille>
                      : <Pastille bg="#F3F4F6" fg="#6B7280">{STATUT_SUR_DEMANDE}</Pastille>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 4 }}>
                    {pack.prix == null
                      ? 'Tarif sur mesure'
                      : pack.prix === 0
                        ? 'Gratuit'
                        : pack.prix + ' € / mois'}
                    {pack.maxUtilisateurs != null && (
                      <span style={{ fontWeight: 400, color: '#6B7280' }}>
                        {' · jusqu’a ' + pack.maxUtilisateurs + ' utilisateurs'}
                        {/* 1.5 doit s'ecrire 1,50 : un prix affiche "1.5 EUR"
                            fait douter du serieux de la grille. */}
                        {pack.debordement != null && ', puis '
                          + pack.debordement.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
                          + ' € par utilisateur'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 3 }}>{pack.resume}</div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {pack.modules.map(id => {
                      const mod = getModuleById(id)
                      if (!mod) return null
                      return (
                        <span key={id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          border: '1px solid #E5E7EB', borderRadius: 8, padding: '3px 9px',
                          fontSize: 11.5, color: '#6B7280', background: '#FAFAFA',
                        }}>
                          <span>{mod.icone}</span>{mod.nom}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  {!estActuelle && (() => {
                    const inactif = !estAdmin || loading || attente
                    return (
                      <button
                        type="button"
                        onClick={() => ouvrirDemande(pack)}
                        disabled={inactif}
                        title={!estAdmin
                          ? "Seul l'administrateur de l'entreprise peut faire cette demande"
                          : attente ? 'Une demande est deja en cours de traitement pour cette formule' : undefined}
                        style={{
                          border: descend ? '1px solid #D1D5DB' : 'none',
                          borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                          cursor: inactif ? 'not-allowed' : 'pointer',
                          background: inactif ? '#E5E7EB' : (descend ? '#fff' : '#185FA5'),
                          color: inactif ? '#9CA3AF' : (descend ? '#374151' : '#fff'),
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {attente ? 'Demande en cours' : (descend ? 'Revenir a cette formule' : 'Demander cette formule')}
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* HISTORIQUE */}
      {demandes.length > 0 && (
        <div style={carte}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 0, marginBottom: 12 }}>
            Vos demandes ({demandes.length})
          </h3>
          {demandes.map(d => {
            const st = STATUT_LABEL[d.statut] || STATUT_LABEL.nouvelle
            const pack = formules.find(p => p.id === d.pack_demande)
            return (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{pack?.nom || d.pack_demande}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    {d.message ? ' - ' + d.message : ''}
                  </div>
                </div>
                <Pastille bg={st.bg} fg={st.fg}>{st.texte}</Pastille>
              </div>
            )
          })}
        </div>
      )}

      {/* MODALE DE DEMANDE */}
      {packOuvert && (
        <div
          onClick={() => setPackOuvert(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 400 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
              {PLAN_ORDER.indexOf(packOuvert.id) < rangActuel
                ? 'Revenir au ' + packOuvert.nom
                : 'Demander le ' + packOuvert.nom}
            </div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
              {PLAN_ORDER.indexOf(packOuvert.id) < rangActuel
                ? "Votre demande est transmise a Velor One. Rien n'est modifie automatiquement : nous vous recontactons pour convenir de la date et des consequences sur vos modules. Vos donnees ne sont pas supprimees."
                : "Votre demande est transmise a Velor One avec le nom de votre entreprise. Aucun module n'est active automatiquement et aucun paiement n'est demande a ce stade."}
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', margin: '16px 0 6px' }}>
              Votre besoin (facultatif)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Ex : nous avons 3 vehicules de service a suivre..."
              style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '9px 11px', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setPackOuvert(null)} style={{ flex: 1, padding: 11, background: 'none', border: '1px solid #E5E7EB', borderRadius: 9, fontSize: 13, color: '#6B7280', cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="button" onClick={envoyerDemande} disabled={envoi} style={{ flex: 1, padding: 11, background: envoi ? '#93C5FD' : '#185FA5', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#fff', cursor: envoi ? 'not-allowed' : 'pointer' }}>
                {envoi ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
