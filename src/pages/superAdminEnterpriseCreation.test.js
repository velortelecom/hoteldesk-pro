import {
  applyEnterpriseCreationToState,
  buildEnterpriseCreationPayload,
  buildEnterpriseCreationSuccessMessage,
  mapEnterpriseCreationError,
  shouldCommitEnterpriseCreation,
} from './superAdminEnterpriseCreation'

describe('superAdminEnterpriseCreation', () => {
  test('creation entreprise seule reussie', () => {
    const payload = buildEnterpriseCreationPayload(
      {
        modules_selectionnes: ['organisation'],
        departements_selectionnes: ['accueil'],
        postes_selectionnes: [{ slug: 'receptionniste', selectionne: true }],
      },
      {
        nom: 'RECETTE',
        slug: 'recette',
        secteur: 'hotel',
        plan: 'starter',
        actif: true,
      }
    )

    expect(payload.admin).toBeNull()
    expect(payload.entreprise.slug).toBe('recette')
  })

  test('creation entreprise + Admin reussie', () => {
    const message = buildEnterpriseCreationSuccessMessage({
      isEdit: false,
      departementsCount: 2,
      postesCount: 3,
      adminCredentials: { email: 'admin@velor.local', password: 'Temp1234!' },
    })

    expect(message).toContain('Entreprise creee')
    expect(message).toContain('Admin cree')
  })

  test('echec creation Admin -> entreprise absente', () => {
    const initial = {
      entreprises: [{ id: 'existing' }],
      stats: { total: 1, actives: 1, totalUsers: 0, totalSites: 0, par_plan: {} },
    }
    const result = applyEnterpriseCreationToState(initial, {
      success: false,
      error: 'admin_create_failed',
      entreprise: { id: 'ghost' },
    })

    expect(shouldCommitEnterpriseCreation({ success: false, entreprise: { id: 'ghost' } })).toBe(false)
    expect(result.entreprises).toHaveLength(1)
    expect(result.entreprises[0].id).toBe('existing')
  })

  test('slug duplique -> message metier propre', () => {
    const message = mapEnterpriseCreationError(new Error('duplicate key value violates unique constraint "entreprises_slug_unique"'))
    expect(message).toBe('Une entreprise avec ce nom existe deja.')
  })

  test('entreprise creee visible dans la liste', () => {
    const initial = {
      entreprises: [{ id: 'a1', nom: 'A' }],
      stats: { total: 1, actives: 1, totalUsers: 2, totalSites: 1, par_plan: {} },
    }

    const result = applyEnterpriseCreationToState(initial, {
      success: true,
      entreprise: { id: 'b2', nom: 'B' },
      health: { total_entreprises: 2, entreprises_actives: 2, total_users: 2, total_sites: 2 },
    })

    expect(result.entreprises[0].id).toBe('b2')
    expect(result.entreprises).toHaveLength(2)
  })

  test('KPI mis a jour apres creation', () => {
    const initial = {
      entreprises: [],
      stats: { total: 0, actives: 0, totalUsers: 0, totalSites: 0, par_plan: {} },
    }

    const result = applyEnterpriseCreationToState(initial, {
      success: true,
      entreprise: { id: 'b2', nom: 'B' },
      health: { total_entreprises: 1, entreprises_actives: 1, total_users: 1, total_sites: 1 },
    })

    expect(result.stats.total).toBe(1)
    expect(result.stats.totalUsers).toBe(1)
    expect(result.stats.totalSites).toBe(1)
  })

  test('aucun etat partiel', () => {
    const message = mapEnterpriseCreationError(new Error('Failed to send a request to the Edge Function'))
    expect(message).toBe('Impossible de creer l administrateur. La creation a ete annulee.')
  })
})
