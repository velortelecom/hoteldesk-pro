import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, isPast, isToday, isTomorrow, parseISO, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'

// Horaires des 3 rappels quotidiens (heures locales)
const HORAIRES_RAPPEL = [8, 13, 18] // matin, midi, soir

// Cle localStorage pour stocker les rappels deja envoyes aujourd'hui
const STORAGE_KEY = 'hoteldesk_rappels_taches'

function toLocalISO(str) {
  if (!str) return null
  return new Date(str).toISOString()
}

const PRIO_CFG = {
  urgente: { bg: '#FCEBEB', text: '#A32D2D', border: '#e24b4a', icon: String.fromCodePoint(0x1F6A8) },
  normale: { bg: '#FAEEDA', text: '#854F0B', border: '#EF9F27', icon: String.fromCodePoint(0x1F514) },
  basse:   { bg: '#EAF3DE', text: '#3B6D11', border: '#7fb83a', icon: String.fromCodePoint(0x1F4CC) }
}

const empty = { titre: '', description: '', priorite: 'normale', date_rappel: '', assigne_a: '' }

// Recupere l'etat des rappels envoyes aujourd'hui depuis localStorage
function getRappelsAujourdhui() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const today = format(new Date(), 'yyyy-MM-dd')
    return stored[today] || {}
  } catch { return {} }
}

// Sauvegarde qu'un rappel a ete envoye a un certain creneau
function marquerRappelEnvoye(tacheId, creneau) {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (!stored[today]) stored[today] = {}
    if (!stored[today][tacheId]) stored[today][tacheId] = []
    if (!stored[today][tacheId].includes(creneau)) {
      stored[today][tacheId].push(creneau)
    }
    // Garder seulement aujourd'hui (nettoyage auto)
    const nouveau = { [today]: stored[today] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nouveau))
  } catch {}
}

// Combien de rappels ont ete envoyes aujourd'hui pour une tache
function getNbRappelsEnvoyes(tacheId) {
  return (getRappelsAujourdhui()[tacheId] || []).length
}

// Quel est le prochain creneau de rappel
function getProchainCreneau(hNow) {
  const next = HORAIRES_RAPPEL.find(h => h > hNow)
  if (!next) return null
  return next
}

export default function Rappels() {
  const { profile } = useAuth()
  const [rappels, setRappels] = useState([])
  const [tachesNonFaites, setTachesNonFaites] = useState([])
  const [employes, setEmployes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(new Date())
  const [notifStatus, setNotifStatus] = useState('')
  const intervalRef = useRef(null)

  const userRole = profile?.role || 'employe'

  useEffect(() => {
    fetchAll()
    requestNotifPermission()

    // Horloge interne + verification rappels toutes les 60s
    intervalRef.current = setInterval(() => {
      setNow(new Date())
      verifierEtEnvoyerRappels()
    }, 60000)

    // Verification immediate au demarrage
    setTimeout(() => verifierEtEnvoyerRappels(), 2000)

    return () => clearInterval(intervalRef.current)
  }, [])

  async function fetchAll() {
    // Rappels manuels
    const { data: rData } = await supabase.from('rappels')
      .select('*, assignee:profiles!rappels_assigne_a_fkey(nom,prenom), createur:profiles!rappels_cree_par_fkey(nom,prenom)')
      .or('cree_par.eq.' + profile.id + ',assigne_a.eq.' + profile.id)
      .order('date_rappel', { ascending: true })
    setRappels(rData || [])

    // Taches non effectuees (planifiee uniquement, pas en_cours ni terminee)
    let q = supabase.from('taches')
      .select('*, assignee:profiles!taches_assigne_a_fkey(nom,prenom)')
      .eq('statut', 'planifiee')
      .is('tache_parente_id', null) // seulement les taches parentes
      .order('date_echeance', { ascending: true })

    // Filtrage par role
    if (userRole === 'employe') {
      q = q.eq('assigne_a', profile.id)
    } else if (userRole === 'responsable') {
      q = q.or('assigne_a.eq.' + profile.id + ',cree_par.eq.' + profile.id)
    }
    // admin voit tout

    const { data: tData } = await q
    setTachesNonFaites(tData || [])
  }

  async function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm)
    } else if ('Notification' in window) {
      setNotifStatus(Notification.permission)
    }
  }

  async function verifierEtEnvoyerRappels() {
    const maintenant = new Date()
    const heure = maintenant.getHours()
    const minute = maintenant.getMinutes()

    // Determiner si on est dans une fenetre de rappel (creneau horaire +-5 min)
    const creneauActif = HORAIRES_RAPPEL.find(h => heure === h && minute < 6)
    if (!creneauActif) return

    // Recuperer les taches non faites
    let q = supabase.from('taches')
      .select('*')
      .eq('statut', 'planifiee')
      .is('tache_parente_id', null)

    if (userRole === 'employe') q = q.eq('assigne_a', profile.id)
    else if (userRole === 'responsable') q = q.or('assigne_a.eq.' + profile.id + ',cree_par.eq.' + profile.id)

    const { data: taches } = await q
    if (!taches?.length) return

    let nbEnvoyes = 0
    taches.forEach(t => {
      const deja = getRappelsAujourdhui()[t.id] || []
      // Maximum 3 rappels par jour, et pas deja envoye a ce creneau
      if (deja.length >= 3 || deja.includes(creneauActif)) return

      marquerRappelEnvoye(t.id, creneauActif)
      nbEnvoyes++

      // Notification navigateur
      if ('Notification' in window && Notification.permission === 'granted') {
        const msg = t.date_echeance
          ? 'Echeance: ' + format(parseISO(t.date_echeance), 'dd/MM HH:mm')
          : 'Tache non effectuee'
        new Notification(String.fromCodePoint(0x1F3E8) + ' HotelDesk - Tache non effectuee', {
          body: t.titre + '\n' + msg,
          icon: '/favicon.ico',
          tag: 'tache-' + t.id + '-' + creneauActif
        })
      }
    })

    if (nbEnvoyes > 0) fetchAll()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.titre.trim() || !form.date_rappel) return
    setSaving(true)
    await supabase.from('rappels').insert({ ...form, date_rappel: toLocalISO(form.date_rappel), cree_par: profile.id, assigne_a: form.assigne_a || null, entreprise_id: profile.entreprise_id })
    await fetchAll()
    setShowModal(false); setForm(empty); setSaving(false)
  }

  async function deleteRappel(id) {
    await supabase.from('rappels').delete().eq('id', id)
    fetchAll()
  }

  async function marquerTacheEnCours(id) {
    await supabase.from('taches').update({ statut: 'en_cours' }).eq('id', id)
    fetchAll()
  }

  async function marquerTacheTerminee(id) {
    await supabase.from('taches').update({ statut: 'terminee', date_terminee: new Date().toISOString() }).eq('id', id)
    fetchAll()
  }

  // Calcul des indicateurs pour les taches
  function getTacheUrgence(t) {
    if (!t.date_echeance) return 'future'
    const d = parseISO(t.date_echeance)
    if (isPast(d) && !isToday(d)) return 'retard'
    if (isToday(d)) return 'aujourd_hui'
    if (isTomorrow(d)) return 'demain'
    return 'future'
  }

  const URGENCE_CFG = {
    retard:       { label: 'En retard', bg: '#FCEBEB', border: '#e24b4a', text: '#A32D2D', dot: '#e24b4a' },
    aujourd_hui:  { label: "Aujourd'hui", bg: '#FFF8EE', border: '#EF9F27', text: '#854F0B', dot: '#EF9F27' },
    demain:       { label: 'Demain', bg: '#EAF3DE', border: '#7fb83a', text: '#3B6D11', dot: '#7fb83a' },
    future:       { label: 'A venir', bg: '#f9f9f7', border: '#e0dfd8', text: '#555', dot: '#aaa' }
  }

  // Grouper les taches par urgence
  const retard       = tachesNonFaites.filter(t => getTacheUrgence(t) === 'retard')
  const aujourd_hui  = tachesNonFaites.filter(t => getTacheUrgence(t) === 'aujourd_hui')
  const demain       = tachesNonFaites.filter(t => getTacheUrgence(t) === 'demain')
  const futures      = tachesNonFaites.filter(t => getTacheUrgence(t) === 'future')

  // Rappels manuels
  const passesR  = rappels.filter(r => isPast(new Date(r.date_rappel)))
  const aVenirR  = rappels.filter(r => !isPast(new Date(r.date_rappel)))

  // Prochain creneau de rappel
  const hNow = now.getHours()
  const mNow = now.getMinutes()
  const prochainH = getProchainCreneau(hNow)
  const creneauNomStr = { 8: 'matin (08:00)', 13: 'midi (13:00)', 18: 'soir (18:00)' }

  function TacheRappelCard({ t }) {
    const urgence = getTacheUrgence(t)
    const cfg = URGENCE_CFG[urgence]
    const nbRappels = getNbRappelsEnvoyes(t.id)
    const creneauxLabels = ['08h', '13h', '18h']
    const creneauxEnvoyes = getRappelsAujourdhui()[t.id] || []

    return (
      <div style={{ background: cfg.bg, border: '1px solid ' + cfg.border, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: cfg.text }}>{t.titre}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: cfg.border + '22', color: cfg.text, border: '1px solid ' + cfg.border, fontWeight: 600 }}>
                {urgence === 'retard' ? String.fromCodePoint(0x26A0) + ' ' : ''}{cfg.label}
              </span>
              {t.priorite === 'haute' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#FCEBEB', color: '#A32D2D', border: '1px solid #e24b4a' }}>Haute priorite</span>}
            </div>
            {t.description && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{t.description}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {t.date_echeance && (
                <span style={{ fontSize: 11, color: cfg.text, fontWeight: 600 }}>
                  {String.fromCodePoint(0x1F4C5)} {format(parseISO(t.date_echeance), 'dd/MM/yyyy', { locale: fr })}
                  {t.heure_debut && ' ' + t.heure_debut.slice(0,5)}
                </span>
              )}
              {t.assignee && <span style={{ fontSize: 11, color: '#666' }}>{String.fromCodePoint(0x1F464)} {t.assignee.prenom} {t.assignee.nom}</span>}
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5, background: '#f0f0f0', color: '#666' }}>{t.categorie}</span>
            </div>
          </div>
        </div>

        {/* Indicateur rappels 3x/jour */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 8 }}>
          <span style={{ fontSize: 11, color: '#666', marginRight: 4 }}>Rappels aujourd&apos;hui :</span>
          {creneauxLabels.map((label, i) => {
            const h = HORAIRES_RAPPEL[i]
            const envoye = creneauxEnvoyes.includes(h)
            const depasse = hNow >= h
            return (
              <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: envoye ? '#185FA5' : depasse ? '#f0f0f0' : '#fff', color: envoye ? '#fff' : depasse ? '#bbb' : '#185FA5', border: '1px solid ' + (envoye ? '#185FA5' : '#d1d5db') }}>
                {envoye ? String.fromCodePoint(0x2714) + ' ' : ''}{label}
              </span>
            )
          })}
          <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>{nbRappels}/3 envoyes</span>
        </div>

        {/* Actions rapides */}
        {(userRole === 'admin' || userRole === 'responsable' || t.assigne_a === profile?.id) && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => marquerTacheEnCours(t.id)} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 8, border: '1px solid #EF9F27', background: '#FFF8EE', color: '#854F0B', cursor: 'pointer', fontWeight: 600 }}>
              {String.fromCodePoint(0x25B6)} En cours
            </button>
            <button onClick={() => marquerTacheTerminee(t.id)} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 8, border: '1px solid #7fb83a', background: '#EAF3DE', color: '#3B6D11', cursor: 'pointer', fontWeight: 600 }}>
              {String.fromCodePoint(0x2714)} Terminer
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Header avec horloge et statut */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5' }}>Rappels</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {format(now, 'HH:mm')} &bull; Rappels auto : 08h, 13h, 18h
            {prochainH && <span style={{ color: '#EF9F27', marginLeft: 6 }}>| Prochain : {creneauNomStr[prochainH]}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {notifStatus === 'denied' && (
            <span style={{ fontSize: 11, color: '#A32D2D', background: '#FCEBEB', padding: '4px 10px', borderRadius: 8, border: '1px solid #e24b4a' }}>
              {String.fromCodePoint(0x1F515)} Notifications bloquees
            </span>
          )}
          {notifStatus === 'granted' && (
            <span style={{ fontSize: 11, color: '#3B6D11', background: '#EAF3DE', padding: '4px 10px', borderRadius: 8, border: '1px solid #7fb83a' }}>
              {String.fromCodePoint(0x1F514)} Notifications actives
            </span>
          )}
          <button onClick={() => { setForm(empty); setShowModal(true) }} style={{ padding: '7px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            + Rappel manuel
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
        {[
          ['En retard', retard.length, '#A32D2D', '#FCEBEB'],
          ["Aujourd'hui", aujourd_hui.length, '#854F0B', '#FFF8EE'],
          ['Demain', demain.length, '#3B6D11', '#EAF3DE'],
          ['A venir', futures.length, '#185FA5', '#E6F1FB']
        ].map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, border: '1px solid ' + c + '44', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: c, marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Info si aucune tache non faite */}
      {tachesNonFaites.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', background: '#EAF3DE', borderRadius: 12, border: '1px solid #7fb83a', marginBottom: 18 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{String.fromCodePoint(0x1F389)}</div>
          <div style={{ fontWeight: 700, color: '#3B6D11', fontSize: 15 }}>Toutes les taches sont effectuees !</div>
          <div style={{ fontSize: 12, color: '#5a9a2a', marginTop: 4 }}>Aucun rappel automatique actif.</div>
        </div>
      )}

      {/* Taches en retard */}
      {retard.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            {String.fromCodePoint(0x26A0)} Taches en retard ({retard.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {retard.map(t => <TacheRappelCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {/* Taches du jour */}
      {aujourd_hui.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#854F0B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            {String.fromCodePoint(0x1F4C5)} Taches d&apos;aujourd&apos;hui ({aujourd_hui.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aujourd_hui.map(t => <TacheRappelCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {/* Taches de demain */}
      {demain.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            {String.fromCodePoint(0x23F3)} Demain ({demain.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demain.map(t => <TacheRappelCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {/* Taches futures */}
      {futures.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            A venir ({futures.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {futures.map(t => <TacheRappelCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {/* Separateur rappels manuels */}
      {rappels.length > 0 && (
        <div>
          <div style={{ borderTop: '1px solid #e0dfd8', marginBottom: 16, marginTop: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5', marginBottom: 12 }}>{String.fromCodePoint(0x1F514)} Rappels manuels</div>
          {aVenirR.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {aVenirR.map(r => <RappelCard key={r.id} r={r} onDelete={deleteRappel} />)}
            </div>
          )}
          {passesR.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>Expires</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {passesR.map(r => <RappelCard key={r.id} r={r} onDelete={deleteRappel} expired />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal nouveau rappel manuel */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nouveau rappel</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>{String.fromCodePoint(0xD7)}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Titre *</label><input value={form.titre} onChange={e => set('titre', e.target.value)} placeholder="Titre du rappel" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Priorite</label><select value={form.priorite} onChange={e => set('priorite', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}><option value="basse">Basse</option><option value="normale">Normale</option><option value="urgente">Urgente</option></select></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Assigner a</label><select value={form.assigne_a} onChange={e => set('assigne_a', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}><option value="">Moi</option>{employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}</select></div>
              </div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Date et heure *</label><input type="datetime-local" value={form.date_rappel} onChange={e => set('date_rappel', e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>{saving ? 'Enregistrement...' : 'Creer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RappelCard({ r, onDelete, expired = false }) {
  const PRIO_CFG = {
    urgente: { bg: '#FCEBEB', text: '#A32D2D', border: '#e24b4a', icon: String.fromCodePoint(0x1F6A8) },
    normale: { bg: '#FAEEDA', text: '#854F0B', border: '#EF9F27', icon: String.fromCodePoint(0x1F514) },
    basse:   { bg: '#EAF3DE', text: '#3B6D11', border: '#7fb83a', icon: String.fromCodePoint(0x1F4CC) }
  }
  const cfg = PRIO_CFG[r.priorite] || PRIO_CFG.normale
  return (
    <div style={{ background: expired ? '#f9f9f7' : cfg.bg, border: '1px solid ' + (expired ? '#e0dfd8' : cfg.border), borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, opacity: expired ? 0.7 : 1 }}>
      <span style={{ fontSize: 18 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: expired ? '#aaa' : cfg.text }}>{r.titre}</div>
        {r.description && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{r.description}</div>}
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          {format(new Date(r.date_rappel), 'dd/MM/yyyy HH:mm', { locale: fr })}
          {r.assignee && ' | ' + r.assignee.prenom + ' ' + r.assignee.nom}
        </div>
      </div>
      <button onClick={() => onDelete(r.id)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>{String.fromCodePoint(0x1F5D1)}</button>
    </div>
  )
  }
