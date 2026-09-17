import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { seProduitLe, estRepetition, RECURRENCES } from '../lib/recurrence'
import { construireEcheance, occupeCreneau, finAvantDebut } from '../lib/taches'
import {
  CATEGORIES_TACHE, PRIORITES_TACHE,
  CATEGORIE_TACHE_DEFAUT, PRIORITE_TACHE_DEFAUT, STATUT_TACHE_DEFAUT,
  LIBELLES_PRIORITE,
} from '../lib/taches'
import { useAuth } from '../hooks/useAuth'
import { useMesDepartements } from '../hooks/useMesDepartements'
import { useDepartements } from '../modules/organisation/hooks.js'
import { tacheVisiblePar } from '../lib/visibiliteTaches'
import { resumeVisibiliteTache } from '../lib/resumeVisibilite'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isToday, isSameMonth, isSameDay,
  parseISO, setHours, setMinutes
} from 'date-fns'
import { fr } from 'date-fns/locale'

// Les taches etaient coloriees par CATEGORIE -- menage, maintenance,
// accueil, admin, urgence -- un systeme remplace par les departements.
// Depuis, la colonne vaut presque toujours la valeur par defaut : tout le
// calendrier s'affichait de la meme couleur, et la legende annoncait cinq
// familles qui n'existaient plus.
//
// On colorie par PRIORITE : c'est ce qu'on remplit vraiment, et c'est ce
// qu'on cherche des yeux en ouvrant un planning.
const COULEURS_PRIORITE = {
  haute:   { bg: '#FCEBEB', text: '#791F1F', border: '#e24b4a' },
  moyenne: { bg: '#E6F1FB', text: '#0C447C', border: '#185FA5' },
  basse:   { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' },
}


const HEURES_24 = Array.from({ length: 24 }, (_, i) => i) // 0..23

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Planning() {
  const { profile } = useAuth()
  const now = useNow()
  const [taches, setTaches] = useState([])
  const [employes, setEmployes] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [quickCreateDate, setQuickCreateDate] = useState(null)
  const QUICK_VIDE = {
    titre: '', description: '',
    departement: '', priorite: PRIORITE_TACHE_DEFAUT,
    heure_fin: '', assigne_a: '', recurrence_type: '', recurrence_fin: '',
  }
  const [quickForm, setQuickForm] = useState(QUICK_VIDE)
  const [quickSaving, setQuickSaving] = useState(false)
  const [heureSurvolee, setHeureSurvolee] = useState(null)
  const { codesDepartements } = useMesDepartements()
  const { departements } = useDepartements(profile?.entreprise_id)
  // Une erreur d'insertion doit se voir : avant, `if (!error)` sans `else`
  // laissait le formulaire ouvert sans rien dire.
  const [quickErreur, setQuickErreur] = useState('')
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [vue, setVue] = useState('mois') // 'mois' | 'jour'
  const [filtreEmp, setFiltreEmp] = useState('tous')
  const timelineRef = useRef(null)

  const userRole = profile?.role || 'employe'
  const userDept = profile?.departement || ''

  // Load employes
  useEffect(() => {
    const q = supabase.from('profiles').select('id,nom,prenom,couleur,avatar_initiales,departement').eq('actif', true)
    if (userRole === 'responsable') q.eq('departement', userDept)
    else if (userRole === 'employe') q.eq('id', profile?.id)
    q.then(({ data }) => setEmployes(data || []))
  }, [])

  // Les taches du mois affiche.
  //
  // C'etait un useEffect anonyme, et la creation rapide appelait ensuite un
  // fetchTaches() qui n'existait nulle part : la ligne levait une
  // ReferenceError, la tache creee n'apparaissait donc pas avant un
  // rechargement. On nomme le chargement une fois, et les deux s'en servent.
  const chargerTaches = useCallback(async () => {
    const from = startOfMonth(currentMonth).toISOString()
    const to = endOfMonth(currentMonth).toISOString()
    const { data } = await supabase.from('taches')
      .select('*, assignee:profiles!taches_assigne_a_fkey(id,nom,prenom,couleur,avatar_initiales)')
      .gte('date_echeance', from)
      .lte('date_echeance', to)
      .neq('statut', 'annulee')
    setTaches(data || [])
  }, [currentMonth])

  useEffect(() => { chargerTaches() }, [chargerTaches])

  // Scroll timeline to current hour on day view
  useEffect(() => {
    if (vue === 'jour' && timelineRef.current) {
      const h = now.getHours()
      const rowH = 56
      timelineRef.current.scrollTop = Math.max(0, h * rowH - 120)
    }
  }, [vue, selectedDay])

  function filterTask(t) {
    // Une seule regle pour tous : assignee a moi, creee par moi, visant un
    // de mes departements, ou ne visant personne. Voir visibiliteTaches.js.
    return tacheVisiblePar(t, {
      id: profile?.id,
      role: userRole,
      isSuperAdmin: profile?.is_super_admin,
      codesDepartements,
    })
  }

  // La base materialise deja les occurrences recurrentes en lignes filles
  // (trigger_recurrence -> generer_occurrences_recurrentes, colonne
  // tache_parente_id). Deplier le parent PAR-DESSUS ces lignes affichait la
  // meme tache deux fois. On indexe donc ce que la base a deja produit, et
  // on ne deplie le parent que sur les jours qu'elle n'a pas couverts --
  // ce qui garde la recurrence visible au-dela de l'horizon genere, sans
  // jamais faire doublon.
  const occurrencesEnBase = useMemo(() => {
    const index = new Set()
    taches.forEach(t => {
      if (t.tache_parente_id && t.date_echeance) {
        index.add(t.tache_parente_id + '|' + format(parseISO(t.date_echeance), 'yyyy-MM-dd'))
      }
    })
    return index
  }, [taches])

  function occurrenceVisible(t, day) {
    if (!seProduitLe(t, day)) return false
    // Sa propre echeance : c'est la ligne elle-meme, on l'affiche toujours.
    if (!estRepetition(t, day)) return true
    return !occurrencesEnBase.has(t.id + '|' + format(day, 'yyyy-MM-dd'))
  }

  function getTasksForDay(day) {
    return taches.filter(t => {
      if (!t.date_echeance) return false
      if (!filterTask(t)) return false
      if (filtreEmp !== 'tous' && t.assignee?.id !== filtreEmp) return false
      // Une tache recurrente doit apparaitre a chacune de ses occurrences,
      // pas seulement le jour de sa creation -- sans doubler celles que la
      // base a deja materialisees.
      return occurrenceVisible(t, day)
    })
  }

  function getTasksForHour(day, hour) {
    return taches.filter(t => {
      if (!t.date_echeance) return false
      if (!filterTask(t)) return false
      if (filtreEmp !== 'tous' && t.assignee?.id !== filtreEmp) return false
      if (!occurrenceVisible(t, day)) return false
      // Une tache de 14h a 16h occupe les deux creneaux, comme dans un
      // agenda. Sans heure_debut, on retombe sur l'heure de l'echeance.
      const debut = t.heure_debut
        ? t.heure_debut.slice(0, 5)
        : format(parseISO(t.date_echeance), 'HH:mm')
      return occupeCreneau(debut, t.heure_fin ? t.heure_fin.slice(0, 5) : null, hour) !== null
    })
  }

  // Stats for month
  const monthTasks = taches.filter(filterTask)
  const stats = {
    total: monthTasks.length,
    terminees: monthTasks.filter(t => t.statut === 'terminee').length,
    urgentes: monthTasks.filter(t => t.priorite === 'haute' && t.statut !== 'terminee').length,
    enCours: monthTasks.filter(t => t.statut === 'en_cours').length,
  }

  // ---- MONTH CALENDAR ----
  function renderMonthCalendar() {
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 })
    const days = []
    let d = calStart
    while (d <= calEnd) { days.push(d); d = addDays(d, 1) }
    const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

    return (
      <div>
        {/* Month header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8592;</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5', textTransform: 'capitalize' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              Aujourd&apos;hui : {format(now, "EEEE d MMMM yyyy", { locale: fr })} &bull; {format(now, 'HH:mm')}
            </div>
          </div>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8594;</button>
        </div>
        {/* Today button */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
            style={{ padding: '4px 14px', borderRadius: 8, border: '1px solid #185FA5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#185FA5' }}>
            Aujourd&apos;hui
          </button>
        </div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {weekDays.map(wd => (
            <div key={wd} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888', padding: '4px 0' }}>{wd}</div>
          ))}
        </div>
        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((day, i) => {
            const dayTasks = getTasksForDay(day)
            const isSelected = isSameDay(day, selectedDay)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDay = isToday(day)
            return (
              <div key={i}
                onClick={() => { setSelectedDay(day); setVue('jour') }}
                style={{
                  minHeight: 72, border: isSelected ? '2px solid #185FA5' : isTodayDay ? '2px solid #EF9F27' : '1px solid #e0dfd8',
                  borderRadius: 8, padding: '4px 6px', cursor: 'pointer', background: isSelected ? '#EEF5FF' : isTodayDay ? '#FFF8EE' : '#fff',
                  opacity: isCurrentMonth ? 1 : 0.4, transition: 'all 0.1s'
                }}>
                <div style={{ fontSize: 12, fontWeight: isTodayDay ? 700 : 500, color: isTodayDay ? '#EF9F27' : '#333', marginBottom: 2 }}>
                  {format(day, 'd')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {dayTasks.slice(0, 3).map(t => {
                    const col = COULEURS_PRIORITE[t.priorite] || COULEURS_PRIORITE.moyenne
                    return (
                      <div key={t.id} style={{
                        background: col.bg, color: col.text, borderLeft: '2px solid ' + col.border,
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {t.heure_debut ? t.heure_debut.slice(0,5) + ' ' : ''}{t.titre}
                      </div>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: 10, color: '#888' }}>+{dayTasks.length - 3} autres</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- 24H DAY TIMELINE ----
  function renderDayTimeline() {
    const currentHour = isToday(selectedDay) ? now.getHours() : -1
    const currentMinute = now.getMinutes()

    return (
      <div>
        {/* Day header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setSelectedDay(d => addDays(d, -1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8592;</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#185FA5', textTransform: 'capitalize' }}>
              {format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {isToday(selectedDay) ? `Heure actuelle : ${format(now, 'HH:mm')}` : format(selectedDay, 'MMMM yyyy', { locale: fr })}
            </div>
          </div>
          <button onClick={() => setSelectedDay(d => addDays(d, 1))}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}>&#8594;</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setSelectedDay(new Date()); setCurrentMonth(new Date()) }}
            style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #185FA5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#185FA5' }}>
            Aujourd&apos;hui
          </button>
          <button onClick={() => setVue('mois')}
            style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#333' }}>
            &#128197; Vue mois
          </button>
        </div>
        {/* Timeline 24h */}
        <div ref={timelineRef} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', minHeight: 400, position: 'relative', borderRadius: 10, border: '1px solid #e0dfd8' }}>
          {HEURES_24.map(h => {
            const tasks = getTasksForHour(selectedDay, h)
            const isCurrentHourRow = h === currentHour
            const survolee = heureSurvolee === h
            return (
              <div key={h}
                // Le creneau lui-meme est le bouton : on clique l'heure ou on
                // veut poser la tache, elle s'y cree. Plus de "+" a chercher.
                onClick={() => {
                  const quand = new Date(selectedDay)
                  quand.setHours(h, 0, 0, 0)
                  setQuickErreur('')
                  setQuickCreateDate(quand)
                }}
                onMouseEnter={() => setHeureSurvolee(h)}
                onMouseLeave={() => setHeureSurvolee(null)}
                title={'Ajouter une tache a ' + String(h).padStart(2, '0') + ':00'}
                style={{
                display: 'flex', minHeight: 56, borderBottom: '1px solid #f0efe8',
                background: survolee ? '#EEF5FF' : isCurrentHourRow ? '#FFFBF0' : h % 2 === 0 ? '#fff' : '#fafaf8',
                position: 'relative', cursor: 'pointer', transition: 'background 0.1s'
              }}>
                {/* Hour label */}
                <div style={{
                  width: 52, minWidth: 52, padding: '4px 8px 0', fontSize: 12, fontWeight: isCurrentHourRow ? 700 : 400,
                  color: isCurrentHourRow ? '#EF9F27' : '#aaa', borderRight: '1px solid #e0dfd8',
                  background: isCurrentHourRow ? '#FFF8EE' : 'transparent'
                }}>
                  {String(h).padStart(2,'0')}:00
                </div>
                {/* Current time indicator */}
                {isCurrentHourRow && (
                  <div style={{
                    position: 'absolute', left: 52, right: 0,
                    top: `${(currentMinute / 60) * 100}%`,
                    height: 2, background: '#EF9F27', zIndex: 10, pointerEvents: 'none'
                  }}>
                    <div style={{ position: 'absolute', left: -6, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#EF9F27' }} />
                  </div>
                )}
                {/* Tasks */}
                <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}>
                  {survolee && tasks.length === 0 && (
                    <span style={{ fontSize: 11, color: '#93A3C4', fontStyle: 'italic' }}>
                      + Ajouter une tache a {String(h).padStart(2, '0')}:00
                    </span>
                  )}
                  {tasks.map(t => {
                    const col = COULEURS_PRIORITE[t.priorite] || COULEURS_PRIORITE.moyenne
                    const emp = t.assignee
                    const debutT = t.heure_debut ? t.heure_debut.slice(0, 5) : format(parseISO(t.date_echeance), 'HH:mm')
                    const place = occupeCreneau(debutT, t.heure_fin ? t.heure_fin.slice(0, 5) : null, h)

                    // Creneau traverse : un bandeau qui prolonge visuellement la
                    // tache, sans repeter son titre a chaque heure.
                    if (place === 'suite') {
                      return (
                        <div key={t.id} onClick={(ev) => ev.stopPropagation()} style={{
                          background: col.bg, borderLeft: '3px solid ' + col.border, opacity: 0.55,
                          borderRadius: 5, width: '100%', minHeight: 20, cursor: 'default',
                        }} title={t.titre + ' (jusqu\'a ' + (t.heure_fin || '').slice(0, 5) + ')'} />
                      )
                    }

                    return (
                      <div key={t.id} onClick={(ev) => ev.stopPropagation()} style={{
                        background: col.bg, color: col.text, borderLeft: '3px solid ' + col.border,
                        fontSize: 11, padding: '3px 8px', borderRadius: 5, maxWidth: 220, cursor: 'default',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 1 }}>
                          {estRepetition(t, selectedDay) && <span title="Tache recurrente" style={{ opacity: 0.7 }}>&#8635; </span>}
                          {t.heure_debut ? t.heure_debut.slice(0,5) : String(h).padStart(2,'0') + ':00'}
                          {t.heure_fin ? ` - ${t.heure_fin.slice(0,5)}` : ''} &mdash; {t.titre}
                        </div>
                        {emp && <div style={{ fontSize: 10, opacity: 0.8 }}>{emp.prenom} {emp.nom}</div>}
                        <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'capitalize' }}>{t.categorie} &bull; {t.statut?.replace('_',' ')}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  async function createQuickTache(e) {
    e.preventDefault()
    if (!quickForm.titre.trim()) return
    setQuickSaving(true)
    setQuickErreur('')

    if (!profile?.entreprise_id) {
      setQuickSaving(false)
      setQuickErreur("Votre compte n'est rattache a aucune entreprise.")
      return
    }

    const heureDebut = format(quickCreateDate, 'HH:mm')
    if (finAvantDebut(heureDebut, quickForm.heure_fin)) {
      setQuickSaving(false)
      setQuickErreur('La tache ne peut pas se terminer avant ' + heureDebut + ', son heure de debut.')
      return
    }

    // L'heure vient du creneau clique. Elle valait 09:00 en dur : une tache
    // posee a 15h atterrissait le matin. Et la chaine etait envoyee sans
    // fuseau, donc relue avec deux heures de decalage.
    const dateStr = construireEcheance(
      format(quickCreateDate, 'yyyy-MM-dd'),
      format(quickCreateDate, 'HH:mm'),
    )
    const { data, error } = await supabase.from('taches').insert({
      titre: quickForm.titre.trim(),
      // taches.departement est du texte et vaut departements.code.
      departement: quickForm.departement || null,
      // categorie est NOT NULL avec une contrainte CHECK : on la remplit
      // encore, avec le code du departement quand il fait partie des
      // valeurs acceptees, sinon la valeur par defaut. L'ecran ne s'en sert
      // plus, mais la base l'exige.
      categorie: CATEGORIES_TACHE.indexOf(quickForm.departement) !== -1
        ? quickForm.departement
        : CATEGORIE_TACHE_DEFAUT,
      priorite: quickForm.priorite,
      // 'a_faire' n'existe pas dans la contrainte CHECK de la table : la
      // base refusait chaque insertion, en silence.
      statut: STATUT_TACHE_DEFAUT,
      date_echeance: dateStr,
      heure_debut: format(quickCreateDate, 'HH:mm'),
      heure_fin: quickForm.heure_fin || null,
      description: quickForm.description.trim() || null,
      recurrence_type: quickForm.recurrence_type || null,
      recurrence_fin: quickForm.recurrence_fin || null,
      entreprise_id: profile.entreprise_id,
      // Non assignee explicitement : la tache revient a son auteur.
      // Sans destinataire, la tache n'appartient a PERSONNE : c'est ce qui
      // la rend visible par le departement vise, ou par toute l'entreprise.
      // Avant, un champ vide valait "moi" : toute tache creee depuis le
      // planning partait au nom de son auteur, donc lui seul la voyait --
      // exactement l'inverse de ce qu'on croyait faire en choisissant un
      // departement.
      assigne_a: quickForm.assigne_a || null,
      cree_par: profile?.id,
    }).select('id')

    setQuickSaving(false)

    if (error) {
      setQuickErreur(error.message || 'Creation impossible.')
      return
    }
    if (!data || data.length === 0) {
      setQuickErreur("Aucune ligne creee. La RLS a filtre l'insertion sans lever d'erreur.")
      return
    }

    setQuickCreateDate(null)
    setQuickErreur('')
    setQuickForm(QUICK_VIDE)
    chargerTaches()
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header with clock */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#185FA5' }}>Planning</h2>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {format(now, "EEEE d MMMM yyyy", { locale: fr })} &bull; <span style={{ fontWeight: 600, color: '#EF9F27' }}>{format(now, 'HH:mm')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Porte d'entree principale : creer une tache pour le jour
              selectionne, sans quitter le planning. */}
          <button
            type="button"
            onClick={() => { setQuickErreur(''); setQuickCreateDate(selectedDay || new Date()) }}
            style={{ padding: '5px 12px', border: 'none', borderRadius: 8, background: '#185FA5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Tache
          </button>
          {/* Vue toggle */}
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {[['mois','&#128197; Mois'],['jour','&#9201; Jour 24h']].map(([v,l]) => (
              <button key={v} onClick={() => setVue(v)}
                dangerouslySetInnerHTML={{ __html: l }}
                style={{
                  padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                  background: vue === v ? '#185FA5' : '#fff', color: vue === v ? '#fff' : '#333'
                }} />
            ))}
          </div>
          {/* Employe filter */}
          {userRole !== 'employe' && (
            <select value={filtreEmp} onChange={e => setFiltreEmp(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, background: '#fff', minWidth: 150 }}>
              <option value="tous">Toute l&apos;equipe</option>
              {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        {[['Total', stats.total, '#185FA5'], ['Terminees', stats.terminees, '#3B6D11'], ['Urgentes', stats.urgentes, '#A32D2D'], ['En cours', stats.enCours, '#854F0B']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Legende : les priorites, seules couleurs qui veulent encore dire
          quelque chose depuis que les categories ont cede la place aux
          departements. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {PRIORITES_TACHE.map(p => {
          const col = COULEURS_PRIORITE[p] || COULEURS_PRIORITE.moyenne
          return (
            <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: col.bg, color: col.text, border: '1px solid ' + col.border }}>
              {LIBELLES_PRIORITE[p] || p}
            </span>
          )
        })}
      </div>

      {/* Calendar / Timeline */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0dfd8', padding: 16 }}>
        {vue === 'mois' ? renderMonthCalendar() : renderDayTimeline()}
      </div>
    
      {quickCreateDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nouvelle tache</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
              {format(quickCreateDate, 'EEEE d MMMM yyyy', { locale: fr })} &agrave; {format(quickCreateDate, 'HH:mm')}
            </div>
            <form onSubmit={createQuickTache}>
              <input autoFocus value={quickForm.titre} onChange={e => setQuickForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre de la tache *"
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <select value={quickForm.departement} onChange={e => setQuickForm(f => ({ ...f, departement: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                  <option value="">Tout le monde</option>
                  {(departements || []).filter(d => d.actif !== false).map(d => (
                    <option key={d.id} value={d.code}>{d.nom}</option>
                  ))}
                </select>
                <select value={quickForm.priorite} onChange={e => setQuickForm(f => ({ ...f, priorite: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff' }}>
                  {PRIORITES_TACHE.map(p => <option key={p} value={p}>{LIBELLES_PRIORITE[p]}</option>)}
                </select>
              </div>

              {(() => {
                const resume = resumeVisibiliteTache({
                  departement: quickForm.departement,
                  assigneA: quickForm.assigne_a,
                  employes, departements, moiId: profile?.id,
                })
                const couleurs = {
                  personne:    { fond: '#EEF2FF', bord: '#C7D2FE', texte: '#3730A3' },
                  departement: { fond: '#ECFDF5', bord: '#A7F3D0', texte: '#065F46' },
                  entreprise:  { fond: '#FEF3C7', bord: '#FCD34D', texte: '#92400E' },
                }[resume.portee]
                return (
                  <div style={{ background: couleurs.fond, border: '1px solid ' + couleurs.bord, color: couleurs.texte, borderRadius: 8, padding: '7px 10px', fontSize: 11, marginBottom: 12 }}>
                    {resume.texte}
                  </div>
                )
              })()}

              {/* Memes choix que la creation complete, en plus compact :
                  a qui, jusqu'a quelle heure, et la recurrence. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>
                  Assigner a
                  <select value={quickForm.assigne_a} onChange={e => setQuickForm(f => ({ ...f, assigne_a: e.target.value }))}
                    style={{ width: '100%', marginTop: 3, padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', boxSizing: 'border-box' }}>
                    {/* Le libelle suit le departement choisi juste au-dessus :
                        sans destinataire, la tache revient a son departement,
                        ou a toute l'entreprise s'il n'y en a pas. Dire
                        "Personne" laissait croire que la tache n'irait a
                        personne. */}
                    <option value="">{quickForm.departement ? 'Tout le departement' : 'Tout le monde'}</option>
                    {profile?.id && <option value={profile.id}>Moi</option>}
                    {employes.filter(emp => emp.id !== profile?.id).map(emp => <option key={emp.id} value={emp.id}>{emp.prenom} {emp.nom}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, color: '#888' }}>
                  Heure de fin
                  <input type="time" value={quickForm.heure_fin}
                    min={format(quickCreateDate, 'HH:mm')}
                    onChange={e => setQuickForm(f => ({ ...f, heure_fin: e.target.value }))}
                    style={{
                      width: '100%', marginTop: 3, padding: '7px 10px', borderRadius: 8, fontSize: 12,
                      background: '#fff', boxSizing: 'border-box',
                      border: '0.5px solid ' + (finAvantDebut(format(quickCreateDate, 'HH:mm'), quickForm.heure_fin) ? '#EF4444' : '#d0cfc8'),
                    }} />
                  {finAvantDebut(format(quickCreateDate, 'HH:mm'), quickForm.heure_fin) && (
                    <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: '#EF4444' }}>
                      Apres {format(quickCreateDate, 'HH:mm')}
                    </span>
                  )}
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>
                  Recurrence
                  <select value={quickForm.recurrence_type} onChange={e => setQuickForm(f => ({ ...f, recurrence_type: e.target.value, recurrence_fin: e.target.value ? f.recurrence_fin : '' }))}
                    style={{ width: '100%', marginTop: 3, padding: '8px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Aucune</option>
                    {RECURRENCES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </label>
                {quickForm.recurrence_type && (
                  <label style={{ fontSize: 11, color: '#888' }}>
                    Fin de recurrence
                    <input type="date" value={quickForm.recurrence_fin} onChange={e => setQuickForm(f => ({ ...f, recurrence_fin: e.target.value }))}
                      style={{ width: '100%', marginTop: 3, padding: '7px 10px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12, background: '#fff', boxSizing: 'border-box' }} />
                  </label>
                )}
              </div>

              <textarea value={quickForm.description} onChange={e => setQuickForm(f => ({ ...f, description: e.target.value }))}
                rows={2} maxLength={500} placeholder="Description (facultatif)"
                style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #d0cfc8', borderRadius: 8, fontSize: 12.5, outline: 'none', marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
              {quickErreur && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                  {quickErreur}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setQuickCreateDate(null); setQuickErreur('') }} style={{ padding: '8px 16px', border: '0.5px solid #d0cfc8', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={quickSaving || !quickForm.titre.trim()} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', opacity: (quickSaving || !quickForm.titre.trim()) ? .6 : 1, fontWeight: 600 }}>
                  {quickSaving ? 'Creation...' : 'Creer la tache'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
</div>
  )
}
