import { buildEffectiveOfferLimits, buildOfferSummary, filterOfferRows } from './offersService'

describe('offersService', () => {
  test('filterOfferRows filtre par texte/plan/statut', () => {
    const rows = [
      { nom: 'Hotel One', slug: 'hotel-one', plan: 'starter', actif: true },
      { nom: 'Hotel Two', slug: 'hotel-two', plan: 'business', actif: false },
    ]

    expect(filterOfferRows(rows, 'one', {})).toHaveLength(1)
    expect(filterOfferRows(rows, '', { plan: 'business' })).toHaveLength(1)
    expect(filterOfferRows(rows, '', { status: 'actif' })).toHaveLength(1)
    expect(filterOfferRows(rows, '', { status: 'inactif' })).toHaveLength(1)
  })

  test('buildOfferSummary calcule indicateurs offres', () => {
    const rows = [
      { plan: 'starter', actif: true, prix_mensuel: 29, max_utilisateurs: 10 },
      { plan: 'business', actif: false, prix_mensuel: 80, max_utilisateurs: 20 },
    ]

    const summary = buildOfferSummary(rows)
    expect(summary.total).toBe(2)
    expect(summary.active).toBe(1)
    expect(summary.suspended).toBe(1)
    expect(summary.customLimits).toBe(1)
  })

  test('buildEffectiveOfferLimits distingue inclus vs personnalise', () => {
    const starterDefault = buildEffectiveOfferLimits({ plan: 'starter', max_utilisateurs: 10 })
    expect(starterDefault.hasOverride).toBe(false)
    expect(starterDefault.usersLabel).toBe('10 utilisateurs inclus')

    const starterOverride = buildEffectiveOfferLimits({ plan: 'starter', max_utilisateurs: 50 })
    expect(starterOverride.hasOverride).toBe(true)
    expect(starterOverride.usersLabel).toBe('50 utilisateurs - limite personnalisee')
  })
})
