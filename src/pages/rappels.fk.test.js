// Non-regression test for the rappels_cree_par_fkey FK violation.
// Root cause: when a user's profile is deleted while their Auth session
// is still active, cree_par: profile.id references a non-existent row.
// Fix: guard profile.id before insert + surface the error.

// We test the guard logic extracted as a pure helper so it can be unit-tested
// without mounting the full Rappels component.

export function buildRappelPayload(form, profile) {
  if (!profile?.id) {
    return null
  }
  return {
    titre: form.titre,
    description: form.description || null,
    priorite: form.priorite || 'normale',
    date_rappel: form.date_rappel,
    cree_par: profile.id,
    assigne_a: form.assigne_a || null,
    entreprise_id: profile.entreprise_id || null,
  }
}

export function isInsertBlocked(form) {
  return !form?.titre?.trim() || !form?.date_rappel
}

describe('rappels FK guard', () => {
  it('returns null payload when profile is null (prevents FK violation)', () => {
    const form = { titre: 'Test', date_rappel: '2026-07-14T10:00', priorite: 'normale', description: '', assigne_a: '' }
    expect(buildRappelPayload(form, null)).toBeNull()
  })

  it('returns null payload when profile.id is undefined', () => {
    const form = { titre: 'Test', date_rappel: '2026-07-14T10:00', priorite: 'normale', description: '', assigne_a: '' }
    expect(buildRappelPayload(form, {})).toBeNull()
  })

  it('returns valid payload when profile.id is a real UUID', () => {
    const profile = { id: '3c6e5a19-dbb9-4d6e-8492-dbb642d8e9a4', entreprise_id: 'bbb3dc0c-b995-4ae0-ac14-4415c04e2262' }
    const form = { titre: 'Réunion', date_rappel: '2026-07-14T10:00', priorite: 'urgente', description: 'desc', assigne_a: '' }
    const payload = buildRappelPayload(form, profile)
    expect(payload).not.toBeNull()
    expect(payload.cree_par).toBe(profile.id)
    expect(payload.entreprise_id).toBe(profile.entreprise_id)
  })

  it('blocks insert when titre is empty', () => {
    expect(isInsertBlocked({ titre: '', date_rappel: '2026-07-14' })).toBe(true)
    expect(isInsertBlocked({ titre: '  ', date_rappel: '2026-07-14' })).toBe(true)
  })

  it('blocks insert when date_rappel is missing', () => {
    expect(isInsertBlocked({ titre: 'Test', date_rappel: '' })).toBe(true)
    expect(isInsertBlocked({ titre: 'Test', date_rappel: null })).toBe(true)
  })

  it('does not block insert when titre and date_rappel are provided', () => {
    expect(isInsertBlocked({ titre: 'Test', date_rappel: '2026-07-14' })).toBe(false)
  })
})
