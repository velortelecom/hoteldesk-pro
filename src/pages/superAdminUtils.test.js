import { buildCreationSlug, buildEditionForm } from './superAdminUtils'

describe('superAdminUtils', () => {
  it('builds a stable slug from enterprise name', () => {
    expect(buildCreationSlug(' Hôtel du Nord ')).toBe('hotel-du-nord')
  })

  it('builds the edition form from entity and active modules', () => {
    const form = buildEditionForm(
      {
        nom: 'Test Corp',
        slug: 'test-corp',
        secteur: 'hotel',
        plan: 'premium',
        prix_mensuel: 99,
        max_utilisateurs: 42,
        actif: false,
        email_contact: 'contact@test.fr',
        telephone: '0102030405',
        adresse: '1 rue du test',
      },
      [
        { module_id: 'organisation', actif: true },
        { module_id: 'conges', actif: false },
        { module_id: 'pointage', actif: true },
      ]
    )

    expect(form).toMatchObject({
      nom: 'Test Corp',
      slug: 'test-corp',
      secteur: 'hotel',
      plan: 'premium',
      prix_mensuel: 99,
      max_utilisateurs: 42,
      actif: false,
      modules_selectionnes: ['organisation', 'pointage'],
      email_contact: 'contact@test.fr',
      telephone: '0102030405',
      adresse: '1 rue du test',
    })
  })
})
