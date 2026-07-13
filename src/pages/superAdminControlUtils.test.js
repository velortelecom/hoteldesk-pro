import {
  buildAssistanceSessionDraft,
  buildDependencyErrorMessage,
  buildEntrepriseUpdatePayload,
  buildModuleWritePolicyWarning,
  buildSupervisionKpis,
  filterSuperAdminUsers,
} from './superAdminControlUtils'

describe('superAdminControlUtils', () => {
  it('builds enterprise update payload safely', () => {
    const payload = buildEntrepriseUpdatePayload({
      nom: 'Hotel Test',
      slug: 'hotel-test',
      secteur: 'hotel',
      plan: 'premium',
      actif: false,
      prix_mensuel: '99',
      max_utilisateurs: '40',
      email_contact: '',
      telephone: '',
      adresse: '',
    })

    expect(payload).toEqual({
      nom: 'Hotel Test',
      slug: 'hotel-test',
      secteur: 'hotel',
      plan: 'premium',
      actif: false,
      prix_mensuel: 99,
      max_utilisateurs: 40,
      email_contact: null,
      telephone: null,
      adresse: null,
    })
  })

  it('filters users by role, status, enterprise and search', () => {
    const users = [
      { id: '1', prenom: 'Alice', nom: 'Martin', email: 'alice@test.fr', role: 'admin', actif: true, entreprise_id: 'ent-a', entreprise_nom: 'A' },
      { id: '2', prenom: 'Bob', nom: 'Durand', email: 'bob@test.fr', role: 'employe', actif: false, entreprise_id: 'ent-b', entreprise_nom: 'B' },
    ]

    const superAdmin = { is_super_admin: true }
    const result = filterSuperAdminUsers(users, { role: 'employe', status: 'inactif', search: 'bob', entrepriseId: 'ent-b' }, superAdmin)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('enforces admin enterprise isolation in user filtering', () => {
    const users = [
      { id: '1', entreprise_id: 'ent-a', prenom: 'A' },
      { id: '2', entreprise_id: 'ent-b', prenom: 'B' },
    ]
    const adminA = { is_super_admin: false, entreprise_id: 'ent-a' }
    const result = filterSuperAdminUsers(users, {}, adminA)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('builds supervision kpis including totals and config errors', () => {
    const kpis = buildSupervisionKpis({
      entreprises: [{ id: 'ent-a', actif: true }, { id: 'ent-b', actif: false }],
      profiles: [
        { id: 'u-1', entreprise_id: 'ent-a', role: 'admin', actif: true, is_super_admin: false },
        { id: 'u-2', entreprise_id: 'ent-b', role: 'employe', actif: false, is_super_admin: false },
      ],
      modules: [{ entreprise_id: 'ent-a', actif: true }],
      sites: [{ entreprise_id: 'ent-a' }],
      events: [{ entreprise_id: 'ent-b', created_at: '2026-07-13T12:00:00.000Z' }],
    })

    expect(kpis.totalEntreprises).toBe(2)
    expect(kpis.entreprisesActives).toBe(1)
    expect(kpis.entreprisesSuspendues).toBe(1)
    expect(kpis.totalUsers).toBe(2)
    expect(kpis.usersDisabled).toBe(1)
    expect(kpis.entreprisesWithoutAdmin).toBe(1)
    expect(kpis.entreprisesWithoutSite).toBe(1)
    expect(kpis.modulesActifs).toBe(1)
    expect(kpis.configErrors).toBe(2)
    expect(kpis.activityByEntreprise['ent-b']).toBe('2026-07-13T12:00:00.000Z')
  })

  it('builds safe dependency and module warnings', () => {
    expect(buildDependencyErrorMessage({ message: 'insert or update violates foreign key' })).toContain('Suppression bloquée')
    expect(buildModuleWritePolicyWarning({ is_super_admin: false })).toContain('Seul le Super Admin')
    expect(buildModuleWritePolicyWarning({ is_super_admin: true })).toBeNull()
  })

  it('builds assistance draft with mandatory reason and entreprise', () => {
    const draft = buildAssistanceSessionDraft({ entrepriseId: 'ent-a', reason: 'Aide opérationnelle' })
    expect(draft.entrepriseId).toBe('ent-a')
    expect(draft.reason).toBe('Aide opérationnelle')
    expect(draft.active).toBe(true)
    expect(() => buildAssistanceSessionDraft({ entrepriseId: '', reason: '' })).toThrow('missing_assistance_fields')
  })
})
