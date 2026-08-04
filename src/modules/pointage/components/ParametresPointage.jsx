import React, { useState } from 'react'
import { updateParametresPointage } from '../services.js'

export default function ParametresPointage({ permissions, profile, moduleId, settings = {} }) {
    const canManage = permissions?.canManageSettings === true
    const toleranceRetard = settings?.toleranceRetardMinutes ?? 5
    const heuresParJour = settings?.heuresParJour ?? 8
    const autoriserPointageMobile = settings?.autoriserPointageMobile ?? true
    const notificationRetards = settings?.notificationRetards ?? true

  const [heureDebut, setHeureDebut] = useState(settings?.heureDebutTravail || '09:00')
    const [heureFin, setHeureFin] = useState(settings?.heureFinTravail || '18:00')
    const [pauseDuree, setPauseDuree] = useState(settings?.pauseDureeMinutes ?? 60)
    const [pauseObligatoire, setPauseObligatoire] = useState(settings?.pauseObligatoire ?? true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

  const handleSave = async () => {
        if (!canManage || !profile?.entreprise_id) {
                setMessage('Vous ne disposez pas des droits pour modifier ces paramètres.')
                return
        }
        setSaving(true)
        setMessage('')
        try {
                await updateParametresPointage(profile.entreprise_id, {
                          heureDebutTravail: heureDebut,
                          heureFinTravail: heureFin,
                          pauseDureeMinutes: Number(pauseDuree) || 0,
                          pauseObligatoire,
                })
                setMessage('Paramètres enregistrés avec succès.')
        } catch (err) {
                setMessage(err?.message || 'Erreur lors de la sauvegarde.')
        } finally {
                setSaving(false)
        }
  }

  const e = React.createElement

  return e('div', { style: { display: 'grid', gap: '1rem' } },
               e('div', { style: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' } },
                       e('h3', { style: { marginTop: 0 } }, 'Paramètres du module Pointage'),
                       e('p', { style: { margin: 0, color: '#6b7280' } }, 'Module ID : ' + (moduleId || 'pointage'))
                     ),
               e('div', { style: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' } },
                       e('ul', { style: { margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.75rem' } },
                                 e('li', null, 'Tolérance de retard : ' + toleranceRetard + ' minutes'),
                                 e('li', null, 'Horaire standard : ' + heuresParJour + ' h/jour'),
                                 e('li', null, 'Pointage mobile autorisé : ' + (autoriserPointageMobile ? 'oui' : 'non')),
                                 e('li', null, 'Notifications retards : ' + (notificationRetards ? 'activées' : 'désactivées'))
                               ),
                       !canManage && e('p', { style: { marginTop: '1rem', color: '#6b7280' } }, 'Accès lecture seule.')
                     ),
               e('div', { style: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' } },
                       e('h3', { style: { marginTop: 0 } }, 'Horaires de travail et pause'),
                       e('div', { style: { display: 'grid', gap: '0.75rem', maxWidth: '420px' } },
                                 e('label', { style: { display: 'grid', gap: '0.35rem' } },
                                             e('span', { style: { fontSize: '0.875rem', color: '#6b7280' } }, 'Heure de début'),
                                             e('input', {
                                                           type: 'time',
                                                           value: heureDebut,
                                                           disabled: !canManage,
                                                           onChange: (ev) => setHeureDebut(ev.target.value),
                                                           style: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' },
                                             })
                                           ),
                                 e('label', { style: { display: 'grid', gap: '0.35rem' } },
                                             e('span', { style: { fontSize: '0.875rem', color: '#6b7280' } }, 'Heure de fin'),
                                             e('input', {
                                                           type: 'time',
                                                           value: heureFin,
                                                           disabled: !canManage,
                                                           onChange: (ev) => setHeureFin(ev.target.value),
                                                           style: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' },
                                             })
                                           ),
                                 e('label', { style: { display: 'grid', gap: '0.35rem' } },
                                             e('span', { style: { fontSize: '0.875rem', color: '#6b7280' } }, 'Durée de pause (minutes)'),
                                             e('input', {
                                                           type: 'number',
                                                           min: 0,
                                                           value: pauseDuree,
                                                           disabled: !canManage,
                                                           onChange: (ev) => setPauseDuree(ev.target.value),
                                                           style: { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' },
                                             })
                                           ),
                                 e('label', { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' } },
                                             e('input', {
                                                           type: 'checkbox',
                                                           checked: pauseObligatoire,
                                                           disabled: !canManage,
                                                           onChange: (ev) => setPauseObligatoire(ev.target.checked),
                                             }),
                                             e('span', { style: { fontSize: '0.875rem', color: '#374151' } }, 'Pause obligatoire')
                                           ),
                                 canManage && e('button', {
                                             type: 'button',
                                             disabled: saving,
                                             onClick: handleSave,
                                             style: {
                                                           padding: '0.65rem 1rem',
                                                           border: 'none',
                                                           borderRadius: '8px',
                                                           background: '#0f766e',
                                                           color: 'white',
                                                           fontWeight: 600,
                                                           cursor: saving ? 'not-allowed' : 'pointer',
                                                           width: 'fit-content',
                                             },
                                 }, saving ? 'Enregistrement...' : 'Enregistrer')
                               ),
                       message && e('div', { style: { marginTop: '0.75rem', color: '#374151', background: '#f3f4f6', padding: '0.65rem', borderRadius: '8px' } }, message)
                     )
             )
}
