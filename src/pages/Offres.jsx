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
import { getModuleById } from '../modules/registry'
import {
  PLAN_1_LABEL, PLAN_1_PRIX_MENSUEL, PLAN_1_MAX_UTILISATEURS,
  PLAN_1_SOCLE, PLAN_1_MODULES_DETAIL, PACKS_SUPERIEURS, STATUT_SUR_DEMANDE,
} from '../lib/plan1'

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
  const [demandes, setDemandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [packOuvert, setPackOuvert] = useState(null)
  const [message, setMessage] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [retour, setRetour] = useState(null)

  const estAdmin = profile?.role === 'admin' || profile?.is_super_admin

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
    if (!packOuvert || !entrepriseId || !profile?.id) return
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
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>{PLAN_1_LABEL}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {PLAN_1_PRIX_MENSUEL} &euro; / mois &middot; jusqu&apos;a {PLAN_1_MAX_UTILISATEURS} utilisateurs
            </div>
          </div>
          <Pastille bg="#ECFDF5" fg="#065F46">Actif</Pastille>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginTop: 18 }}>
          {[...PLAN_1_SOCLE, ...PLAN_1_MODULES_DETAIL].map(m => (
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

      {/* PACKS SUPERIEURS */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Packs superieurs</h2>
      <p style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14, lineHeight: 1.6 }}>
        Ces modules sont en cours de developpement chez Velor One. Ils ne sont pas activables en ligne :
        votre demande nous parvient, nous vous recontactons, et l&apos;activation se fait manuellement une fois
        le module disponible.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {PACKS_SUPERIEURS.map(pack => {
          const demande = demandeParPack[pack.id]
          const st = demande ? (STATUT_LABEL[demande.statut] || STATUT_LABEL.nouvelle) : null
          return (
            <div key={pack.id} style={{ ...carte, borderLeft: '3px solid ' + pack.couleur }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{pack.nom}</span>
                    <Pastille bg="#F3F4F6" fg="#6B7280">{STATUT_SUR_DEMANDE}</Pastille>
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
                  {st && <Pastille bg={st.bg} fg={st.fg}>{st.texte}</Pastille>}
                  <button
                    type="button"
                    onClick={() => ouvrirDemande(pack)}
                    disabled={!estAdmin || loading || (demande && demande.statut !== 'refusee')}
                    title={!estAdmin ? "Seul l'administrateur de l'entreprise peut faire cette demande" : undefined}
                    style={{
                      border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
                      cursor: (!estAdmin || (demande && demande.statut !== 'refusee')) ? 'not-allowed' : 'pointer',
                      background: (!estAdmin || (demande && demande.statut !== 'refusee')) ? '#E5E7EB' : '#185FA5',
                      color: (!estAdmin || (demande && demande.statut !== 'refusee')) ? '#9CA3AF' : '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {demande && demande.statut !== 'refusee' ? 'Demande en cours' : 'Contacter Velor One'}
                  </button>
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
            const pack = PACKS_SUPERIEURS.find(p => p.id === d.pack_demande)
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
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Demander le {packOuvert.nom}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
              Votre demande est transmise a Velor One avec le nom de votre entreprise. Aucun module n&apos;est
              active automatiquement et aucun paiement n&apos;est demande a ce stade.
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
