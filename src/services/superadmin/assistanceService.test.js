import {
  buildAssistanceInsertPayload,
  extractActiveAssistanceSession,
  normalizeAssistanceRow,
} from './assistanceService'

describe('assistanceService', () => {
  test('buildAssistanceInsertPayload construit payload valide avec TTL', () => {
    const payload = buildAssistanceInsertPayload({
      actorProfileId: 'sa-1',
      entrepriseId: 'ent-1',
      reason: 'Support incident',
      durationMinutes: 15,
      readonlyMode: true,
    })

    expect(payload.super_admin_profile_id).toBe('sa-1')
    expect(payload.entreprise_id).toBe('ent-1')
    expect(payload.reason).toBe('Support incident')
    expect(payload.closed_at).toBeNull()
  })

  test('extractActiveAssistanceSession retourne session active non expiree', () => {
    const rows = [
      normalizeAssistanceRow({ id: 'a', expires_at: '2026-07-16T10:00:00.000Z', closed_at: null }),
      normalizeAssistanceRow({ id: 'b', expires_at: '2026-07-16T08:00:00.000Z', closed_at: null }),
    ]

    const active = extractActiveAssistanceSession(rows, '2026-07-16T09:00:00.000Z')
    expect(active?.id).toBe('a')
  })

  test('buildAssistanceInsertPayload refuse les champs manquants', () => {
    expect(() => buildAssistanceInsertPayload({ actorProfileId: '', entrepriseId: '', reason: '' })).toThrow('missing_assistance_fields')
  })
})
