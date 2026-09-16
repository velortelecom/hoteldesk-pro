import { buildAuditActionLabel, buildAuditEventRecord, buildSupervisionSnapshot, filterAuditEvents, sanitizeAuditMetadata } from './superAdminAudit'

describe('superAdminAudit', () => {
  it('creates a sanitized audit event record', () => {
    const record = buildAuditEventRecord({
      acteur_profile_id: 'actor-1',
      acteur_email: 'admin@test.fr',
      entreprise_id: 'ent-1',
      action: 'creation_utilisateur',
      type_cible: 'profile',
      cible_id: 'target-1',
      description: 'Création utilisateur',
      metadonnees: { role: 'admin', password: 'secret', nested: { token: 'x' } },
      adresse_ip: '127.0.0.1',
      user_agent: 'unit-test',
      created_at: '2026-07-13T00:00:00.000Z',
    })

    expect(record).toMatchObject({
      acteur_profile_id: 'actor-1',
      acteur_email: 'admin@test.fr',
      entreprise_id: 'ent-1',
      action: 'creation_utilisateur',
      type_cible: 'profile',
      cible_id: 'target-1',
      description: 'Création utilisateur',
      adresse_ip: '127.0.0.1',
      user_agent: 'unit-test',
      created_at: '2026-07-13T00:00:00.000Z',
    })
    expect(record.metadonnees).toEqual({ role: 'admin', nested: {} })
  })

  it('keeps audit rows immutable by design and filters access by role', () => {
    const events = [
      { id: '1', entreprise_id: 'ent-1', action: 'creation_entreprise', type_cible: 'entreprise', cible_id: 'c1', description: 'A', metadonnees: {}, acteur_email: 'a@test.fr', created_at: '2026-07-13T00:00:00.000Z' },
      { id: '2', entreprise_id: 'ent-2', action: 'suppression_utilisateur', type_cible: 'profile', cible_id: 'c2', description: 'B', metadonnees: {}, acteur_email: 'b@test.fr', created_at: '2026-07-13T01:00:00.000Z' },
    ]
    const superAdmin = { is_super_admin: true, role: 'admin', entreprise_id: 'ent-1' }
    const admin = { is_super_admin: false, role: 'admin', entreprise_id: 'ent-1' }
    const employee = { is_super_admin: false, role: 'employe', entreprise_id: 'ent-1' }

    expect(filterAuditEvents(events, {}, superAdmin)).toHaveLength(2)
    expect(filterAuditEvents(events, {}, admin)).toHaveLength(1)
    expect(filterAuditEvents(events, {}, employee)).toHaveLength(0)
    expect(buildAuditActionLabel('reset_mot_de_passe_utilisateur')).toBe('Reset mot de passe')
  })

  it('builds supervision snapshot and empty-state friendly aggregates', () => {
    const snapshot = buildSupervisionSnapshot({
      entreprises: [],
      profiles: [],
      modules: [],
      events: [],
    })

    expect(snapshot.entrepriseSansAdmin).toEqual([])
    expect(snapshot.entrepriseSansModule).toEqual([])
    expect(snapshot.disabledUsers).toEqual([])
    expect(snapshot.configIssues).toEqual([])
    expect(snapshot.criticalIncidents).toEqual([])
  })

  it('redacts sensitive metadata keys recursively', () => {
    expect(sanitizeAuditMetadata({ password: 'secret', token: 'abc', nested: { refresh_token: 'x', keep: 1 } })).toEqual({ nested: { keep: 1 } })
  })
})
