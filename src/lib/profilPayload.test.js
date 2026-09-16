import { normaliserPayloadProfil } from './profilPayload'

describe('normaliserPayloadProfil', () => {
  test('une date vide devient NULL', () => {
    expect(normaliserPayloadProfil({ date_entree: '' }).date_entree).toBeNull()
  })

  test('un identifiant vide devient NULL', () => {
    const r = normaliserPayloadProfil({ poste_id: '', poste_secondaire_id: '', site_id: '' })
    expect(r.poste_id).toBeNull()
    expect(r.poste_secondaire_id).toBeNull()
    expect(r.site_id).toBeNull()
  })

  test('les espaces seuls comptent comme vide', () => {
    expect(normaliserPayloadProfil({ date_entree: '   ' }).date_entree).toBeNull()
  })

  test('une valeur renseignee n est pas touchee', () => {
    const r = normaliserPayloadProfil({ date_entree: '2026-09-16', poste_id: 'abc-123' })
    expect(r.date_entree).toBe('2026-09-16')
    expect(r.poste_id).toBe('abc-123')
  })

  test('les champs texte gardent leur chaine vide', () => {
    const r = normaliserPayloadProfil({ telephone: '', notes_internes: '', prenom: '' })
    expect(r.telephone).toBe('')
    expect(r.notes_internes).toBe('')
    expect(r.prenom).toBe('')
  })

  test('ne touche pas aux champs absents', () => {
    expect(normaliserPayloadProfil({ prenom: 'Rayan' })).toEqual({ prenom: 'Rayan' })
  })

  test('null et undefined traversent sans casser', () => {
    expect(normaliserPayloadProfil(null)).toBeNull()
    expect(normaliserPayloadProfil({ date_entree: null }).date_entree).toBeNull()
  })

  test('ne modifie pas l objet d origine', () => {
    const origine = { date_entree: '' }
    normaliserPayloadProfil(origine)
    expect(origine.date_entree).toBe('')
  })
})
