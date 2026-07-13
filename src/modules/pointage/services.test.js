import { formatStatut } from './services'

describe('Pointage formatting', () => {
  it('maps database statuses to user-facing french labels', () => {
    expect(formatStatut('accepte')).toBe('Validé')
    expect(formatStatut('en_attente_correction')).toBe('À vérifier')
    expect(formatStatut('refuse')).toBe('Refusé')
  })
})
