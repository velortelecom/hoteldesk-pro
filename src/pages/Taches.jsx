import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { construireEcheance, CATEGORIES_TACHE, CATEGORIE_TACHE_DEFAUT } from '../lib/taches'
import { useMesDepartements } from '../hooks/useMesDepartements'
import { useDepartements } from '../modules/organisation/hooks.js'
import { filtrerTachesVisibles } from '../lib/visibiliteTaches'
import { resumeVisibiliteTache } from '../lib/resumeVisibilite'
import { BUCKET_PHOTOS, cheminPhoto, nomFichierPhoto, fichierAcceptable, compresserImage } from '../lib/photoTache'
import PhotoTache from '../components/PhotoTache'
import DetailTache from '../components/DetailTache'
import { useAuth } from '../hooks/useAuth'
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function toLocalISO(str) {
  if (!str) return null
  return new Date(str).toISOString()
}

const CATS = ['menage', 'maintenance', 'accueil', 'admin', 'urgence']
const PRIOS = ['haute', 'moyenne', 'basse']
const STATUTS = ['planifiee', 'en_cours', 'terminee', 'annulee']
const RECURRENCES = ['quotidienne', 'hebdomadaire', 'mensuelle', 'annuelle']
const PRIO_COLORS = { haute: '#E24B4A', moyenne: '#EF9F27', basse: '#639922' }
const STATUT_LABELS = { planifiee: 'Planifiee', en_cours: 'En cours', terminee: 'Terminee', annulee: 'Ann.' }
const STATUT_COLORS = { planifiee: '#3B82F6', en_cours: '#F59E0B', terminee: '#10B981', annulee: '#6B7280' }

function TacheRow({ tache, enfants, profile, membres, expandedParents, setExpandedParents, onEdit, onDelete, onStatutChange, onOuvrir }) {
  const isParent = tache.recurrence_type && !tache.tache_parente_id
  const hasEnfants = isParent && enfants && enfants.length > 0
  const isExpanded = expandedParents[tache.id]

  const toggleExpand = (e) => {
    e.stopPropagation()
    setExpandedParents(prev => ({ ...prev, [tache.id]: !prev[tache.id] }))
  }

  const renderRow = (t, isChild) => (
    // Cliquer la ligne ouvre le detail : la photo et la discussion s'y
    // trouvent, comme depuis le planning. Les boutons d'action arretent
    // l'evenement pour ne pas ouvrir la fenetre en meme temps.
    <div key={t.id} onClick={() => onOuvrir && onOuvrir(t)} title="Ouvrir la tache" style={{
      cursor: 'pointer',
      background: isChild ? '#f8fafc' : 'white',
      borderLeft: isChild ? '3px solid #3B82F6' : 'none',
      marginLeft: isChild ? 20 : 0,
      border: isChild ? '1px solid #e2e8f0' : '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, flex: 1, minWidth: 120 }}>{t.titre}</span>
        {isParent && !isChild && (
          <span style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
            Recurrence: {t.recurrence_type}
          </span>
        )}
        <span style={{ background: PRIO_COLORS[t.priorite] + '22', color: PRIO_COLORS[t.priorite], borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {t.priorite}
        </span>
        <span style={{ background: STATUT_COLORS[t.statut] + '22', color: STATUT_COLORS[t.statut], borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {STATUT_LABELS[t.statut]}
        </span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{t.departement || 'Tout le monde'}</span>
        {t.date_echeance && (
          <span style={{ fontSize: 12, color: isToday(parseISO(t.date_echeance)) ? '#EF4444' : '#6B7280' }}>
            {format(parseISO(t.date_echeance), 'dd MMM', { locale: fr })}
          </span>
        )}
        {t.photo_chemin && <span onClick={e => e.stopPropagation()}><PhotoTache chemin={t.photo_chemin} /></span>}
        {t.heure_debut && <span style={{ fontSize: 11, color: '#8B5CF6' }}>{t.heure_debut.slice(0,5)}</span>}
        {t.heure_fin && <span style={{ fontSize: 11, color: '#8B5CF6' }}>fin: {t.heure_fin.slice(0,5)}</span>}
        {(profile?.role === 'admin' || profile?.role === 'responsable' || t.assigne_a === profile?.id) && (
          <select
            value={t.statut}
            onChange={e => onStatutChange(t.id, e.target.value)}
            style={{ fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', padding: '2px 4px' }}
            onClick={e => e.stopPropagation()}
          >
            {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </select>
        )}
        {/* Modifier : l'admin et le responsable. Supprimer : l'admin seul.
            La base applique exactement cette regle ; offrir un bouton que la
            base refuse produirait un clic sans effet et sans message --
            l'echec muet qu'on chasse partout. */}
        {(profile?.role === 'admin' || profile?.role === 'responsable') && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(t) }} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Edit</button>
        )}
        {profile?.role === 'admin' && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(t.id, isParent) }} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Sup</button>
        )}
      </div>
      {t.description && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{t.description}</div>}
      {t.assigne_a && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
          Assigne: {membres.find(m => m.id === t.assigne_a)?.prenom || 'Inconnu'}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ position: 'relative' }}>
        {renderRow(tache, false)}
        {hasEnfants && (
          <button
            onClick={toggleExpand}
            style={{
              position: 'absolute', right: 60, top: 10,
              background: isExpanded ? '#DBEAFE' : '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 10,
              padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#1D4ED8',
            }}
          >
            {isExpanded ? 'Reduire' : enfants.length + ' occurrences'}
          </button>
        )}
      </div>
      {hasEnfants && isExpanded && (
        <div style={{ marginTop: 2 }}>
          {enfants.map(enf => renderRow(enf, true))}
        </div>
      )}
    </div>
  )
}

export default function Taches() {
  const { profile } = useAuth()
  const [taches, setTaches] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTache, setEditTache] = useState(null)
  const [tacheOuverte, setTacheOuverte] = useState(null)
  // La photo n'est pas un champ comme les autres : elle part vers le
  // stockage APRES que la tache existe, puisque son chemin contient
  // l'identifiant de la tache.
  const [photoFichier, setPhotoFichier] = useState(null)
  const [photoApercu, setPhotoApercu] = useState(null)
  const [photoErreur, setPhotoErreur] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [expandedParents, setExpandedParents] = useState({})
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [filtreCat, setFiltreCat] = useState('toutes')
  const [filtrePrio, setFiltrePrio] = useState('toutes')
  const [form, setForm] = useState({
    titre: '', description: '', departement: '', priorite: 'moyenne',
    statut: 'planifiee', date_echeance: '', heure_debut: '', heure_fin: '',
    assigne_a: '', recurrence_type: '', recurrence_fin: '', chambre: '',
  })

  useEffect(() => { fetchTaches(); fetchMembres() }, [profile])

  async function fetchMembres() {
    const { data } = await supabase.from('profiles').select('id, prenom, nom, role, departement')
    if (data) setMembres(data)
  }

  async function fetchTaches() {
    setLoading(true)
    // Plus de filtrage par categorie cote serveur : la visibilite se decide
    // par assignation et par departement, avec la meme regle que le
    // planning (voir src/lib/visibiliteTaches.js). La RLS continue de
    // garantir l'isolation entre entreprises.
    const query = supabase.from('taches').select('*').order('date_echeance', { ascending: true })
    const { data } = await query
    if (data) setTaches(data)
    setLoading(false)
  }

  const { codesDepartements } = useMesDepartements()
  const { departements } = useDepartements(profile?.entreprise_id)

  const tachesVisibles = filtrerTachesVisibles(taches, {
    id: profile?.id,
    role: profile?.role,
    isSuperAdmin: profile?.is_super_admin,
    codesDepartements,
  })

  const parents = tachesVisibles.filter(t => !t.tache_parente_id)
  const enfantsMap = {}
  tachesVisibles.filter(t => t.tache_parente_id).forEach(t => {
    if (!enfantsMap[t.tache_parente_id]) enfantsMap[t.tache_parente_id] = []
    enfantsMap[t.tache_parente_id].push(t)
  })

  const filtered = parents.filter(t => {
    if (filtreStatut !== 'tous' && t.statut !== filtreStatut) return false
    if (filtreCat !== 'toutes' && t.departement !== filtreCat) return false
    if (filtrePrio !== 'toutes' && t.priorite !== filtrePrio) return false
    return true
  })

  function openCreate() {
    setEditTache(null)
    setForm({ titre: '', description: '', departement: '', priorite: 'moyenne', statut: 'planifiee', date_echeance: '', heure_debut: '', heure_fin: '', assigne_a: '', recurrence_type: '', recurrence_fin: '', chambre: '' })
    setShowForm(true)
  }

  function openEdit(t) {
    setEditTache(t)
    setForm({
      titre: t.titre || '', description: t.description || '', departement: t.departement || '',
      priorite: t.priorite || 'moyenne', statut: t.statut || 'planifiee',
      date_echeance: t.date_echeance ? t.date_echeance.slice(0, 10) : '',
      heure_debut: t.heure_debut ? t.heure_debut.slice(0, 5) : '',
      heure_fin: t.heure_fin ? t.heure_fin.slice(0, 5) : '',
      assigne_a: t.assigne_a || '', recurrence_type: t.recurrence_type || '',
      recurrence_fin: t.recurrence_fin ? t.recurrence_fin.slice(0, 10) : '',
      chambre: t.chambre || '',
    })
    setShowForm(true)
  }

  async function handleDelete(id, isParent) {
    const msg = isParent
      ? 'Supprimer cette tache recurrente et toutes ses occurrences ?'
      : 'Supprimer cette tache ?'
    if (!window.confirm(msg)) return
    if (isParent) {
      await supabase.from('taches').delete().eq('tache_parente_id', id)
    }
    await supabase.from('taches').delete().eq('id', id)
    fetchTaches()
  }

  async function handleStatutChange(id, statut) {
    await supabase.from('taches').update({ statut }).eq('id', id)
    fetchTaches()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      titre: form.titre,
      description: form.description || null,
      departement: form.departement || null,
      // categorie est NOT NULL avec une contrainte CHECK : on continue de la
      // remplir pour la base, l'ecran ne s'en sert plus.
      categorie: CATEGORIES_TACHE.indexOf(form.departement) !== -1 ? form.departement : CATEGORIE_TACHE_DEFAUT,
      priorite: form.priorite,
      statut: form.statut,
      date_echeance: construireEcheance(form.date_echeance, form.heure_debut),
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      assigne_a: form.assigne_a || null,
      recurrence_type: form.recurrence_type || null,
      recurrence_fin: form.recurrence_fin || null,
      chambre: form.chambre || null,
    }
    setEnregistrement(true)
    setPhotoErreur('')
    try {
      let tacheId = editTache ? editTache.id : null

      if (editTache) {
        // .select() sans quoi une ligne filtree par les regles d'acces
        // passerait pour un enregistrement reussi.
        const { data, error } = await supabase.from('taches').update(payload).eq('id', editTache.id).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error("Modification refusee : vous n'avez pas le droit de modifier cette tache.")
      } else {
        const { data, error } = await supabase.from('taches')
          .insert({ ...payload, cree_par: profile.id, entreprise_id: profile.entreprise_id })
          .select('id')
          .single()
        if (error) throw error
        tacheId = data.id
      }

      if (photoFichier && tacheId) {
        await envoyerPhoto(tacheId, photoFichier)
      }

      setShowForm(false)
      setPhotoFichier(null)
      setPhotoApercu(null)
      fetchTaches()
    } catch (err) {
      setPhotoErreur(err.message || 'Enregistrement impossible.')
    } finally {
      setEnregistrement(false)
    }
  }

  // La tache existe deja quand on arrive ici : son identifiant fait partie
  // du chemin, et le premier dossier est l'entreprise -- c'est lui que la
  // regle d'acces du stockage verifie.
  async function envoyerPhoto(tacheId, fichier) {
    const compressee = await compresserImage(fichier)
    const chemin = cheminPhoto(profile.entreprise_id, tacheId, nomFichierPhoto())
    if (!chemin) throw new Error('Chemin de photo incomplet : envoi annule.')

    const { error: erreurEnvoi } = await supabase.storage
      .from(BUCKET_PHOTOS)
      .upload(chemin, compressee, { contentType: 'image/jpeg', upsert: true })
    if (erreurEnvoi) throw new Error('Photo non envoyee : ' + erreurEnvoi.message)

    // La tache est deja enregistree : si ce rattachement echoue, on le dit
    // plutot que de laisser un fichier orphelin passer pour une reussite.
    const { data, error } = await supabase.from('taches')
      .update({ photo_chemin: chemin }).eq('id', tacheId).select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Photo envoyee mais non rattachee a la tache.')
  }

  function choisirPhoto(fichier) {
    setPhotoErreur('')
    if (!fichier) { setPhotoFichier(null); setPhotoApercu(null); return }

    const verdict = fichierAcceptable(fichier)
    if (!verdict.ok) { setPhotoErreur(verdict.motif); setPhotoFichier(null); setPhotoApercu(null); return }

    setPhotoFichier(fichier)
    setPhotoApercu(URL.createObjectURL(fichier))
  }

  // Creer une tache n'etait offert qu'aux administrateurs et aux
  // responsables sur cet ecran, alors que le planning l'ouvre a tout le
  // monde : un employe devait passer par le calendrier pour faire ce que
  // l'onglet Taches lui refusait. Deux ecrans, deux droits, sans raison.
  //
  // Ce qu'il peut en faire reste borne par la meme regle qu'ailleurs : sa
  // tache n'est visible que par son destinataire, lui-meme et
  // l'administrateur.

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Chargement...</div>

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1F2937' }}>Taches</h1>
        <button onClick={openCreate} style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}>
          + Nouvelle tache
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 10px' }}>
          <option value='tous'>Tous statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </select>
        <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)} style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 10px' }}>
          <option value='toutes'>Tous departements</option>
          {(departements || []).filter(d => d.actif !== false).map(d => (
            <option key={d.id} value={d.code}>{d.nom}</option>
          ))}
        </select>
        <select value={filtrePrio} onChange={e => setFiltrePrio(e.target.value)} style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 10px' }}>
          <option value='toutes'>Toutes priorites</option>
          {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>Aucune tache trouvee.</div>
      ) : (
        <div>
          {filtered.map(t => (
            <TacheRow
              key={t.id}
              tache={t}
              enfants={enfantsMap[t.id] || []}
              profile={profile}
              membres={membres}
              expandedParents={expandedParents}
              setExpandedParents={setExpandedParents}
              onEdit={openEdit}
              onDelete={handleDelete}
              onStatutChange={handleStatutChange}
              onOuvrir={setTacheOuverte}
            />
          ))}
        </div>
      )}

      {tacheOuverte && (
        <DetailTache
          tache={tacheOuverte}
          profile={profile}
          employes={membres}
          departements={departements}
          onFermer={() => setTacheOuverte(null)}
          onChangement={fetchTaches}
        />
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 12, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>{editTache ? 'Modifier la tache' : 'Nouvelle tache'}</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre</label>
              <input required value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Departement</label>
                <select value={form.departement} onChange={e => setForm(f => ({ ...f, departement: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  <option value=''>Tout le monde</option>
                  {(departements || []).filter(d => d.actif !== false).map(d => (
                    <option key={d.id} value={d.code}>{d.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Priorite</label>
                <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Chambre</label>
                <input value={form.chambre} onChange={e => setForm(f => ({ ...f, chambre: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date echeance</label>
                <input type='date' value={form.date_echeance} onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Heure debut</label>
                <input type='time' value={form.heure_debut} onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Heure fin</label>
                <input type='time' value={form.heure_fin} onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Recurrence</label>
                <select value={form.recurrence_type} onChange={e => setForm(f => ({ ...f, recurrence_type: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                  <option value=''>Aucune</option>
                  {RECURRENCES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.recurrence_type && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fin recurrence</label>
                  <input type='date' value={form.recurrence_fin} onChange={e => setForm(f => ({ ...f, recurrence_fin: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Assigner a</label>
              <select value={form.assigne_a} onChange={e => setForm(f => ({ ...f, assigne_a: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
                <option value=''>{form.departement ? 'Tout le departement' : 'Tout le monde'}</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom} ({m.role})</option>)}
              </select>
            </div>

            {(() => {
              // Meme phrase que sur le planning : la regle ne doit pas
              // s'apprendre ecran par ecran.
              const resume = resumeVisibiliteTache({
                departement: form.departement,
                assigneA: form.assigne_a,
                employes: membres, departements, moiId: profile?.id,
              })
              const couleurs = {
                personne:    { fond: '#EEF2FF', bord: '#C7D2FE', texte: '#3730A3' },
                departement: { fond: '#ECFDF5', bord: '#A7F3D0', texte: '#065F46' },
                entreprise:  { fond: '#FEF3C7', bord: '#FCD34D', texte: '#92400E' },
              }[resume.portee]
              return (
                <div style={{ background: couleurs.fond, border: '1px solid ' + couleurs.bord, color: couleurs.texte, borderRadius: 8, padding: '8px 11px', fontSize: 12, marginBottom: 20 }}>
                  {resume.texte}
                </div>
              )
            })()}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Photo (facultatif)</label>
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                onChange={e => choisirPhoto(e.target.files && e.target.files[0])}
                style={{ fontSize: 12 }}
              />
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                Elle est reduite avant l'envoi : une photo de telephone passe de plusieurs Mo a environ 200 Ko.
              </div>
              {photoApercu && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={photoApercu} alt='Ce qui sera joint a la tache' style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <button type='button' onClick={() => choisirPhoto(null)} style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Retirer</button>
                </div>
              )}
            </div>

            {photoErreur && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 14 }}>
                {photoErreur}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type='button' onClick={() => { setShowForm(false); choisirPhoto(null) }} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
              <button type='submit' disabled={enregistrement} style={{ background: enregistrement ? '#93C5FD' : '#3B82F6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: enregistrement ? 'default' : 'pointer' }}>
                {enregistrement ? 'Enregistrement...' : (editTache ? 'Modifier' : 'Creer')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
      }
