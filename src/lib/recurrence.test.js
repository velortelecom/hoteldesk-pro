import { seProduitLe, estRepetition } from './recurrence'

const j = (s) => new Date(s + 'T00:00:00')
const tache = (extra) => ({ date_echeance: '2026-01-31T09:00:00', ...extra })

describe('seProduitLe', () => {
  test('sans recurrence : uniquement le jour de l echeance', () => {
    const t = tache()
    expect(seProduitLe(t, j('2026-01-31'))).toBe(true)
    expect(seProduitLe(t, j('2026-02-01'))).toBe(false)
  })

  test('quotidienne : tous les jours a partir du depart', () => {
    const t = tache({ recurrence_type: 'quotidienne' })
    expect(seProduitLe(t, j('2026-01-30'))).toBe(false)
    expect(seProduitLe(t, j('2026-01-31'))).toBe(true)
    expect(seProduitLe(t, j('2026-06-14'))).toBe(true)
  })

  test('hebdomadaire : le meme jour de semaine', () => {
    // 2026-01-31 est un samedi
    const t = tache({ recurrence_type: 'hebdomadaire' })
    expect(seProduitLe(t, j('2026-02-07'))).toBe(true)
    expect(seProduitLe(t, j('2026-02-08'))).toBe(false)
  })

  test('mensuelle : le meme quantieme', () => {
    const t = tache({ recurrence_type: 'mensuelle' })
    expect(seProduitLe(t, j('2026-03-31'))).toBe(true)
    expect(seProduitLe(t, j('2026-03-30'))).toBe(false)
  })

  test('mensuelle du 31 : rattachee au dernier jour des mois plus courts', () => {
    const t = tache({ recurrence_type: 'mensuelle' })
    // Fevrier 2026 compte 28 jours : l occurrence tombe le 28, pas nulle part.
    expect(seProduitLe(t, j('2026-02-28'))).toBe(true)
    expect(seProduitLe(t, j('2026-02-27'))).toBe(false)
    // Avril compte 30 jours.
    expect(seProduitLe(t, j('2026-04-30'))).toBe(true)
  })

  test('annuelle : meme mois et meme quantieme', () => {
    const t = tache({ recurrence_type: 'annuelle' })
    expect(seProduitLe(t, j('2027-01-31'))).toBe(true)
    expect(seProduitLe(t, j('2027-02-28'))).toBe(false)
  })

  test('recurrence_fin borne la serie', () => {
    const t = tache({ recurrence_type: 'quotidienne', recurrence_fin: '2026-02-03' })
    expect(seProduitLe(t, j('2026-02-03'))).toBe(true)
    expect(seProduitLe(t, j('2026-02-04'))).toBe(false)
  })

  test('un type inconnu ne repete pas', () => {
    const t = tache({ recurrence_type: 'tous_les_mardis_pairs' })
    expect(seProduitLe(t, j('2026-02-28'))).toBe(false)
    expect(seProduitLe(t, j('2026-01-31'))).toBe(true)
  })

  test('entrees incompletes : faux, pas une exception', () => {
    expect(seProduitLe(null, j('2026-01-31'))).toBe(false)
    expect(seProduitLe({ date_echeance: null }, j('2026-01-31'))).toBe(false)
    expect(seProduitLe(tache(), null)).toBe(false)
    expect(seProduitLe({ date_echeance: 'n importe quoi' }, j('2026-01-31'))).toBe(false)
  })
})

describe('estRepetition', () => {
  test('distingue l originale de ses repetitions', () => {
    const t = tache({ recurrence_type: 'quotidienne' })
    expect(estRepetition(t, j('2026-01-31'))).toBe(false)
    expect(estRepetition(t, j('2026-02-01'))).toBe(true)
  })

  test('une tache sans recurrence n est jamais une repetition', () => {
    expect(estRepetition(tache(), j('2026-02-01'))).toBe(false)
  })
})
