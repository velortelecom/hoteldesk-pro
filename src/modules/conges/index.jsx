// src/modules/conges/index.jsx
// MODULE: Conges & Absences - v2.0.0
// Gestion des demandes, soldes personnalisables par admin, decompte auto + planning

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const TYPES_CONGE = {
  conges_payes: { label: 'Conges payes', emoji: '🌴', couleur: '#10B981', decompte: 'cp' },
  rtt:          { label: 'RTT',           emoji: '⏰', couleur: '#3B82F6', decompte: 'rtt' },
  maladie:      { label: 'Maladie',       emoji: '🏥', couleur: '#EF4444', decompte: null },
  sans_solde:   { label: 'Sans solde',    emoji: '📋', couleur: '#6B7280', decompte: null },
  formation:    { label: 'Formation',     emoji: '📚', couleur: '#8B5CF6', decompte: null },
  autre:        { label: 'Autre',         emoji: '📝', couleur: '#F59E0B', decompte: null },
}

const STATUTS = {
  en_attente: { label: 'En attente', couleur: '#F59E0B', bg: '#FEF3C7', emoji: '⏳' },
  approuve:   { label: 'Approuve',   couleur: '#10B981', bg: '#D1FAE5', emoji: '✅' },
  refuse:     { label: 'Refuse',     couleur: '#EF4444', bg: '#FEE2E2', emoji: '❌' },
  annule:     { label: 'Annule',     couleur: '#6B7280', bg: '#F3F4F6', emoji: '🚫' },
}

function calculerJoursOuvres(debut, fin) {
  if (!debut || !fin) return 0
  let count = 0
  const d = new Date(debut + 'T00:00:00')
  const f = new Date(fin + 'T00:00:00')
  while (d <= f) {
    const j = d.getDay()
    if (j !== 0 && j !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function formatDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ---- Composants UI ----
function StatBox({ emoji, label, valeur, sousLabel, couleur, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '14px 16px', flex: 1, minWidth: 90,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .15s',
    }}>
      <div style={{ fontSize: 20, marginBottom: 2 }}>{emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: couleur || '#1F2937' }}>{valeur ?? '—'}</div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{label}</div>
      {sousLabel && <div style={{ fontSize: 10, color: '#9CA3AF' }}>{sousLabel}</div>}
    </div>
  )
}

function Badge({ statut }) {
  const s = STATUTS[statut] || STATUTS.en_attente
  return (
    <span style={{ background: s.bg, color: s.couleur, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.emoji} {s.label}
    </span>
  )
}

// ============================================================
export default function CongesModule({ permissions, profile }) {
  const [onglet, setOnglet] = useState('mes_conges')
  const [demandes, setDemandes] = useState([])
  const [maSolde, setMaSolde] = useState(null)
  const [tousLesSoldes, setTousLesSoldes] = useState([])
  const [employes, setEmployes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type_conge: 'conges_payes', date_debut: '', date_fin: '', motif: '' })
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [success, setSuccess] = useState('')
  const [editSolde, setEditSolde] = useState(null) // { employe_id, cp_acquis, rtt_acquis }

  const isAdmin = ['admin', 'responsable', 'super_admin'].includes(profile?.role)
  const nbJours = calculerJoursOuvres(form.date_debut, form.date_fin)
  const annee = new Date().getFullYear()

  useEffect(() => { chargerDonnees() }, [onglet])

  async function chargerDonnees() {
    setLoading(true)
    try {
      // Demandes
      let q = supabase
        .from('conges')
        .select(`*, employe:profiles!conges_employe_id_fkey(id,prenom,nom,couleur,departement), validateur:profiles!conges_validateur_id_fkey(prenom,nom)`)
        .order('created_at', { ascending: false })
      if (onglet === 'mes_conges') q = q.eq('employe_id', profile?.id)
      const { data: dem } = await q
      setDemandes(dem || [])

      // Mon solde
      const { data: s } = await supabase
        .from('soldes_conges').select('*')
        .eq('employe_id', profile?.id).eq('annee', annee).single()
      setMaSolde(s)

      // Soldes equipe (admin)
      if (isAdmin) {
        const { data: tous } = await supabase
          .from('soldes_conges')
          .select(`*, employe:profiles!soldes_conges_employe_id_fkey(id,prenom,nom,couleur,departement)`)
          .eq('annee', annee)
          .order('created_at')
        setTousLesSoldes(tous || [])

        const { data: emps } = await supabase
          .from('profiles')
          .select('id,prenom,nom,couleur,departement,role')
          .eq('entreprise_id', profile?.entreprise_id)
          .neq('is_super_admin', true)
          .order('nom')
        setEmployes(emps || [])
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  // Initialiser le solde d'un employe qui n'en a pas encore
  async function initialiserSolde(emp) {
    await supabase.from('soldes_conges').upsert({
      employe_id: emp.id,
      entreprise_id: profile?.entreprise_id,
      annee,
      cp_acquis: 25,
      cp_pris: 0,
      rtt_acquis: 10,
      rtt_pris: 0,
    }, { onConflict: 'employe_id,annee' })
    chargerDonnees()
  }

  // Sauvegarder le solde modifie par l'admin
  async function sauvegarderSolde() {
    if (!editSolde) return
    setSaving(true)
    const { error } = await supabase.from('soldes_conges').upsert({
      employe_id: editSolde.employe_id,
      entreprise_id: profile?.entreprise_id,
      annee,
      cp_acquis: parseFloat(editSolde.cp_acquis) || 0,
      rtt_acquis: parseFloat(editSolde.rtt_acquis) || 0,
    }, { onConflict: 'employe_id,annee' })
    if (!error) {
      setSuccess('Solde mis a jour !')
      setEditSolde(null)
      chargerDonnees()
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function soumettreDemande(e) {
    e.preventDefault()
    setErreur('')
    if (!form.date_debut || !form.date_fin) return setErreur('Veuillez renseigner les dates')
    if (form.date_fin < form.date_debut) return setErreur('La date de fin doit etre apres la date de debut')
    if (nbJours === 0) return setErreur('Aucun jour ouvre dans cette periode')

    // Verification solde disponible
    if (maSolde && form.type_conge === 'conges_payes' && nbJours > maSolde.cp_restant) {
      return setErreur(`Solde insuffisant : ${maSolde.cp_restant}j CP disponibles, ${nbJours}j demandes`)
    }
    if (maSolde && form.type_conge === 'rtt' && nbJours > (maSolde.rtt_acquis - maSolde.rtt_pris)) {
      return setErreur(`Solde RTT insuffisant : ${maSolde.rtt_acquis - maSolde.rtt_pris}j disponibles`)
    }

    setSaving(true)
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
    if (error) { setErreur(error.message); setSaving(false); return }
    setSuccess('Demande envoyee ! Elle apparaitra dans le planning apres validation.')
    setShowForm(false)
    setForm({ type_conge: 'conges_payes', date_debut: '', date_fin: '', motif: '' })
    chargerDonnees()
    setTimeout(() => setSuccess(''), 5000)
    setSaving(false)
  }

  async function changerStatut(id, statut) {
    setSaving(true)
    const { error } = await supabase.from('conges').update({
      statut,
      validateur_id: profile?.id,
      validated_at: new Date().toISOString(),
    }).eq('id', id)
    if (!error) {
      const msg = statut === 'approuve'
        ? '✅ Conge approuve - solde debite + ajout au planning automatiquement !'
        : '❌ Demande refusee.'
      setSuccess(msg)
      setTimeout(() => setSuccess(''), 5000)
      chargerDonnees()
    }
    setSaving(false)
  }

  async function annulerDemande(id) {
    const { error } = await supabase.from('conges').update({ statut: 'annule' })
      .eq('id', id).eq('employe_id', profile?.id)
    if (!error) { chargerDonnees(); setSuccess('Demande annulee - solde restitue si elle etait approuvee.'); setTimeout(() => setSuccess(''), 4000) }
  }

  const ONGLETS = isAdmin
    ? [['mes_conges','👤 Mes demandes'],['equipe','👥 Equipe'],['soldes','💰 Soldes']]
    : [['mes_conges','👤 Mes demandes']]

  // ---- RENDER ----
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:0, color:'#1F2937' }}>🏖️ Conges & Absences</h1>
          <p style={{ fontSize:13, color:'#6B7280', margin:'4px 0 0' }}>Solde auto mis a jour - planning rempli a l approbation</p>
        </div>
        {onglet !== 'soldes' && (
          <button onClick={() => setShowForm(v => !v)} style={{
            background: showForm ? '#F3F4F6' : '#185FA5', color: showForm ? '#374151' : '#fff',
            border:'none', borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer',
          }}>
            {showForm ? '✕ Annuler' : '+ Nouvelle demande'}
          </button>
        )}
      </div>

      {/* Toasts */}
      {success && <div style={{ background:'#D1FAE5', color:'#065F46', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, fontWeight:500 }}>{success}</div>}
      {erreur  && <div style={{ background:'#FEE2E2', color:'#991B1B', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13 }}>⚠️ {erreur}</div>}

      {/* Mon solde */}
      {maSolde && (
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <StatBox emoji="🌴" label="CP restants"  valeur={maSolde.cp_restant}  sousLabel={`sur ${maSolde.cp_acquis} acquis`}  couleur="#10B981" />
          <StatBox emoji="✅" label="CP pris"       valeur={maSolde.cp_pris}     couleur="#6B7280" />
          <StatBox emoji="⏰" label="RTT restants"  valeur={maSolde.rtt_acquis - maSolde.rtt_pris} sousLabel={`sur ${maSolde.rtt_acquis} acquis`} couleur="#3B82F6" />
        </div>
      )}
      {!maSolde && !loading && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#92400E' }}>
          ℹ️ Aucun solde configure. Contactez votre administrateur.
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px', color:'#1F2937' }}>📝 Nouvelle demande</h3>
          <form onSubmit={soumettreDemande}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Type</label>
                <select value={form.type_conge} onChange={e => setForm(f => ({...f, type_conge:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                  {Object.entries(TYPES_CONGE).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                <div style={{ fontSize:12, color: nbJours>0 ? '#185FA5' : '#9CA3AF', fontWeight:700 }}>
                  {nbJours > 0 ? `${nbJours} jour(s) ouvre(s)` : 'Choisissez les dates'}
                  {maSolde && form.type_conge === 'conges_payes' && nbJours > 0 &&
                    <div style={{ fontWeight:400, color: nbJours > maSolde.cp_restant ? '#EF4444' : '#10B981', fontSize:11 }}>
                      Solde : {maSolde.cp_restant}j CP disponibles
                    </div>
                  }
                </div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Debut</label>
                <input type="date" value={form.date_debut} min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({...f, date_debut:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Fin</label>
                <input type="date" value={form.date_fin} min={form.date_debut || new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({...f, date_fin:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <textarea value={form.motif} onChange={e => setForm(f => ({...f, motif:e.target.value}))}
              placeholder="Motif (optionnel)..." rows={2}
              style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, resize:'vertical', boxSizing:'border-box', marginBottom:12 }} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding:'9px 16px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Annuler</button>
              <button type="submit" disabled={saving}
                style={{ padding:'9px 20px', border:'none', borderRadius:8, background:'#185FA5', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:saving?0.6:1 }}>
                {saving ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'#F3F4F6', borderRadius:10, padding:4 }}>
        {ONGLETS.map(([id,label]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{
            flex:1, padding:'8px 0', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
            background: onglet===id ? '#fff' : 'transparent',
            color: onglet===id ? '#185FA5' : '#6B7280',
            boxShadow: onglet===id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {/* == ONGLET SOLDES (admin) == */}
      {onglet === 'soldes' && (
        <div>
          <div style={{ fontSize:13, color:'#6B7280', marginBottom:14 }}>
            Personnalisez les soldes CP et RTT de chaque employe pour l annee {annee}. Le decompte se fait automatiquement a l approbation.
          </div>

          {/* Modal edition solde */}
          {editSolde && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ background:'#fff', borderRadius:16, padding:28, minWidth:320, boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
                <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>✏️ Modifier le solde</h3>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>CP acquis (jours)</label>
                  <input type="number" min="0" max="100" step="0.5" value={editSolde.cp_acquis}
                    onChange={e => setEditSolde(s => ({...s, cp_acquis:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, boxSizing:'border-box' }} />
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>RTT acquis (jours)</label>
                  <input type="number" min="0" max="50" step="0.5" value={editSolde.rtt_acquis}
                    onChange={e => setEditSolde(s => ({...s, rtt_acquis:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, boxSizing:'border-box' }} />
                </div>
                <div style={{ background:'#FEF3C7', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#92400E', marginBottom:16 }}>
                  ⚠️ Seuls les jours acquis sont modifiables. Les jours pris sont calcules automatiquement.
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setEditSolde(null)}
                    style={{ flex:1, padding:'9px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Annuler</button>
                  <button onClick={sauvegarderSolde} disabled={saving}
                    style={{ flex:1, padding:'9px', border:'none', borderRadius:8, background:'#185FA5', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tableau des soldes */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {employes.map(emp => {
              const s = tousLesSoldes.find(sl => sl.employe_id === emp.id)
              const initiales = ((emp.prenom?.[0]||'')+(emp.nom?.[0]||'')).toUpperCase()
              const couleur = emp.couleur || '#185FA5'
              return (
                <div key={emp.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:couleur+'22', border:'2px solid '+couleur, color:couleur, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>
                    {initiales}
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:'#1F2937' }}>{emp.prenom} {emp.nom}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'capitalize' }}>{emp.role} · {emp.departement}</div>
                  </div>
                  {s ? (
                    <>
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:16, fontWeight:700, color:'#10B981' }}>{s.cp_restant}</div>
                          <div style={{ fontSize:10, color:'#6B7280' }}>CP restants</div>
                          <div style={{ fontSize:10, color:'#9CA3AF' }}>/{s.cp_acquis} acquis</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:16, fontWeight:700, color:'#3B82F6' }}>{s.rtt_acquis - s.rtt_pris}</div>
                          <div style={{ fontSize:10, color:'#6B7280' }}>RTT restants</div>
                          <div style={{ fontSize:10, color:'#9CA3AF' }}>/{s.rtt_acquis} acquis</div>
                        </div>
                      </div>
                      <button onClick={() => setEditSolde({ employe_id:emp.id, cp_acquis:s.cp_acquis, rtt_acquis:s.rtt_acquis })}
                        style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', fontWeight:500, color:'#374151' }}>
                        ✏️ Modifier
                      </button>
                    </>
                  ) : (
                    <button onClick={() => initialiserSolde(emp)}
                      style={{ padding:'7px 14px', border:'none', borderRadius:8, background:'#185FA5', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:500 }}>
                      + Initialiser solde
                    </button>
                  )}
                </div>
              )
            })}
            {employes.length === 0 && !loading && (
              <div style={{ textAlign:'center', padding:30, color:'#9CA3AF', fontSize:13 }}>Aucun employe trouve.</div>
            )}
          </div>
        </div>
      )}

      {/* == ONGLETS DEMANDES == */}
      {onglet !== 'soldes' && (
        loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#9CA3AF', fontSize:14 }}>Chargement...</div>
        ) : demandes.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, background:'#fff', borderRadius:14, border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
            <p style={{ color:'#6B7280', fontSize:14, margin:0 }}>Aucune demande de conge.</p>
            <button onClick={() => setShowForm(true)}
              style={{ marginTop:12, padding:'8px 16px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>
              + Faire une demande
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {demandes.map(d => {
              const type = TYPES_CONGE[d.type_conge] || TYPES_CONGE.autre
              const emp = d.employe
              const isMine = d.employe_id === profile?.id
              return (
                <div key={d.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      {onglet === 'equipe' && emp && (
                        <div style={{ fontSize:12, color:'#6B7280', marginBottom:4, fontWeight:500 }}>
                          <span style={{ display:'inline-block', width:20, height:20, borderRadius:'50%', background:(emp.couleur||'#185FA5')+'22', border:'1.5px solid '+(emp.couleur||'#185FA5'), color:emp.couleur||'#185FA5', fontSize:9, fontWeight:700, textAlign:'center', lineHeight:'18px', marginRight:6 }}>
                            {((emp.prenom?.[0]||'')+(emp.nom?.[0]||'')).toUpperCase()}
                          </span>
                          {emp.prenom} {emp.nom} · {emp.departement}
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:16 }}>{type.emoji}</span>
                        <span style={{ fontWeight:600, fontSize:14, color:'#1F2937' }}>{type.label}</span>
                        <Badge statut={d.statut} />
                        {type.decompte && <span style={{ fontSize:10, color:'#9CA3AF', background:'#F3F4F6', borderRadius:10, padding:'1px 7px' }}>Decompte {type.decompte === 'cp' ? 'CP' : 'RTT'}</span>}
                      </div>
                      <div style={{ fontSize:13, color:'#374151' }}>
                        📅 {formatDate(d.date_debut)} → {formatDate(d.date_fin)}
                        <span style={{ color:'#185FA5', fontWeight:700, marginLeft:8 }}>{d.nb_jours}j</span>
                      </div>
                      {d.motif && <div style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>💬 {d.motif}</div>}
                      {d.statut === 'approuve' && (
                        <div style={{ fontSize:11, color:'#10B981', marginTop:4 }}>✅ Solde debite · 📅 Visible dans le planning</div>
                      )}
                      {d.commentaire_validateur && (
                        <div style={{ fontSize:12, color:'#374151', marginTop:4, background:'#F9FAFB', borderRadius:6, padding:'4px 8px' }}>
                          Validateur : {d.commentaire_validateur}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:6, flexDirection:'column', flexShrink:0 }}>
                      {isAdmin && d.statut === 'en_attente' && onglet === 'equipe' && (
                        <>
                          <button onClick={() => changerStatut(d.id, 'approuve')} disabled={saving}
                            style={{ padding:'6px 14px', background:'#D1FAE5', color:'#065F46', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                            ✅ Approuver
                          </button>
                          <button onClick={() => changerStatut(d.id, 'refuse')} disabled={saving}
                            style={{ padding:'6px 14px', background:'#FEE2E2', color:'#991B1B', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                            ❌ Refuser
                          </button>
                        </>
                      )}
                      {isMine && d.statut === 'en_attente' && (
                        <button onClick={() => annulerDemande(d.id)}
                          style={{ padding:'6px 14px', background:'#F3F4F6', color:'#6B7280', border:'none', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
