// src/modules/conges/index.jsx
// MODULE: Conges & Absences - v1.0.0
// Gestion des demandes de conges, absences et jours feries

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const TYPES_CONGE = {
  conges_payes: { label: 'Conges payes', emoji: '🌴', couleur: '#10B981' },
  rtt: { label: 'RTT', emoji: '⏰', couleur: '#3B82F6' },
  maladie: { label: 'Maladie', emoji: '🏥', couleur: '#EF4444' },
  sans_solde: { label: 'Sans solde', emoji: '📋', couleur: '#6B7280' },
  formation: { label: 'Formation', emoji: '📚', couleur: '#8B5CF6' },
  autre: { label: 'Autre', emoji: '📝', couleur: '#F59E0B' },
}

const STATUTS = {
  en_attente: { label: 'En attente', couleur: '#F59E0B', bg: '#FEF3C7' },
  approuve: { label: 'Approuve', couleur: '#10B981', bg: '#D1FAE5' },
  refuse: { label: 'Refuse', couleur: '#EF4444', bg: '#FEE2E2' },
  annule: { label: 'Annule', couleur: '#6B7280', bg: '#F3F4F6' },
}

function calculerJoursOuvres(debut, fin) {
  if (!debut || !fin) return 0
  let count = 0
  const d = new Date(debut)
  const f = new Date(fin)
  while (d <= f) {
    const jour = d.getDay()
    if (jour !== 0 && jour !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatBox({ emoji, label, valeur, couleur }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: couleur || '#1F2937' }}>{valeur}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function CongesModule({ permissions, profile }) {
  const [onglet, setOnglet] = useState('mes_conges')
  const [demandes, setDemandes] = useState([])
  const [solde, setSolde] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type_conge: 'conges_payes', date_debut: '', date_fin: '', motif: '' })
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = ['admin', 'responsable', 'super_admin'].includes(profile?.role)
  const nbJours = calculerJoursOuvres(form.date_debut, form.date_fin)

  useEffect(() => { chargerDonnees() }, [onglet])

  async function chargerDonnees() {
    setLoading(true)
    try {
      // Charger les demandes
      let query = supabase
        .from('conges')
        .select(`*, employe:profiles!conges_employe_id_fkey(prenom, nom, couleur), validateur:profiles!conges_validateur_id_fkey(prenom, nom)`)
        .order('created_at', { ascending: false })

      if (onglet === 'mes_conges') {
        query = query.eq('employe_id', profile?.id)
      }
      // Si admin + onglet equipe : pas de filtre = tout l'entreprise (RLS filtre par entreprise)

      const { data, error } = await query
      if (error) throw error
      setDemandes(data || [])

      // Charger le solde de l'utilisateur courant
      const annee = new Date().getFullYear()
      const { data: soldeData } = await supabase
        .from('soldes_conges')
        .select('*')
        .eq('employe_id', profile?.id)
        .eq('annee', annee)
        .single()
      setSolde(soldeData)
    } catch (e) {
      console.error('Erreur chargement conges:', e)
    }
    setLoading(false)
  }

  async function soumettreDemande(e) {
    e.preventDefault()
    setErreur('')
    if (!form.date_debut || !form.date_fin) return setErreur('Veuillez renseigner les dates')
    if (form.date_fin < form.date_debut) return setErreur('La date de fin doit etre apres la date de debut')
    if (nbJours === 0) return setErreur('La periode selectionnee ne contient aucun jour ouvre')

    setSaving(true)
    try {
      const { error } = await supabase.from('conges').insert({
        employe_id: profile?.id,
        entreprise_id: profile?.entreprise_id,
        type_conge: form.type_conge,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        nb_jours: nbJours,
        motif: form.motif || null,
        statut: 'en_attente',
      })
      if (error) throw error
      setSuccess('Demande envoyee avec succes !')
      setShowForm(false)
      setForm({ type_conge: 'conges_payes', date_debut: '', date_fin: '', motif: '' })
      chargerDonnees()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setErreur(e.message || 'Erreur lors de la soumission')
    }
    setSaving(false)
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from('conges').update({
      statut,
      validateur_id: profile?.id,
      validated_at: new Date().toISOString(),
    }).eq('id', id)
    if (!error) chargerDonnees()
  }

  async function annulerDemande(id) {
    const { error } = await supabase.from('conges').update({ statut: 'annule' }).eq('id', id).eq('employe_id', profile?.id)
    if (!error) chargerDonnees()
  }

  const peutApprouver = permissions?.modifier || isAdmin

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1F2937' }}>🏖️ Conges & Absences</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Gerez vos demandes de conges et absences</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: showForm ? '#F3F4F6' : '#185FA5', color: showForm ? '#374151' : '#fff',
          border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          {showForm ? '✕ Annuler' : '+ Nouvelle demande'}
        </button>
      </div>

      {/* Messages */}
      {success && <div style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>✅ {success}</div>}
      {erreur && <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>⚠️ {erreur}</div>}

      {/* Soldes */}
      {solde && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatBox emoji="🌴" label="CP restants" valeur={solde.cp_restant} couleur="#10B981" />
          <StatBox emoji="📅" label="CP acquis" valeur={solde.cp_acquis} couleur="#3B82F6" />
          <StatBox emoji="✅" label="CP pris" valeur={solde.cp_pris} couleur="#6B7280" />
          <StatBox emoji="⏰" label="RTT restants" valeur={solde.rtt_acquis - solde.rtt_pris} couleur="#8B5CF6" />
        </div>
      )}
      {!solde && !loading && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
          ℹ️ Aucun solde de conges configure pour votre compte. Contactez un administrateur.
        </div>
      )}

      {/* Formulaire nouvelle demande */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#1F2937' }}>📝 Nouvelle demande de conge</h3>
          <form onSubmit={soumettreDemande}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Type de conge</label>
                <select value={form.type_conge} onChange={e => setForm(f => ({ ...f, type_conge: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                  {Object.entries(TYPES_CONGE).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
                  {nbJours > 0 ? <span style={{ fontWeight: 700, color: '#185FA5' }}>{nbJours} jour(s) ouvre(s)</span> : 'Selectionnez les dates'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date de debut</label>
                <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date de fin</label>
                <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                  min={form.date_debut || new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Motif (optionnel)</label>
              <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                placeholder="Raison de la demande..."
                rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '10px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Annuler
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '10px 22px', border: 'none', borderRadius: 8, background: '#185FA5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Onglets */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {[['mes_conges', '👤 Mes demandes'], ['equipe', '👥 Equipe']].map(([id, label]) => (
            <button key={id} onClick={() => setOnglet(id)} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: onglet === id ? '#fff' : 'transparent',
              color: onglet === id ? '#185FA5' : '#6B7280',
              boxShadow: onglet === id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* Liste des demandes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 14 }}>Chargement...</div>
      ) : demandes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Aucune demande de conge pour le moment.</p>
          <button onClick={() => setShowForm(true)} style={{ marginTop: 8, padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            + Faire une demande
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {demandes.map(d => {
            const type = TYPES_CONGE[d.type_conge] || TYPES_CONGE.autre
            const statut = STATUTS[d.statut] || STATUTS.en_attente
            const employe = d.employe
            return (
              <div key={d.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {onglet === 'equipe' && employe && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 500 }}>
                        👤 {employe.prenom} {employe.nom}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{type.emoji}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#1F2937' }}>{type.label}</span>
                      <span style={{ background: statut.bg, color: statut.couleur, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                        {statut.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      📅 {formatDate(d.date_debut)} → {formatDate(d.date_fin)}
                      <span style={{ color: '#185FA5', fontWeight: 600, marginLeft: 8 }}>{d.nb_jours}j</span>
                    </div>
                    {d.motif && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>💬 {d.motif}</div>}
                    {d.commentaire_validateur && (
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 4, background: '#F9FAFB', borderRadius: 6, padding: '4px 8px' }}>
                        📝 Validateur : {d.commentaire_validateur}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column' }}>
                    {peutApprouver && d.statut === 'en_attente' && onglet === 'equipe' && (
                      <>
                        <button onClick={() => changerStatut(d.id, 'approuve')}
                          style={{ padding: '5px 12px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          ✅ Approuver
                        </button>
                        <button onClick={() => changerStatut(d.id, 'refuse')}
                          style={{ padding: '5px 12px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          ❌ Refuser
                        </button>
                      </>
                    )}
                    {d.statut === 'en_attente' && onglet === 'mes_conges' && (
                      <button onClick={() => annulerDemande(d.id)}
                        style={{ padding: '5px 12px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
