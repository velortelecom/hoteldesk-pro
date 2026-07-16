import { filterSupportTickets, normalizeTicketRow } from './supportService'

describe('supportService', () => {
  test('normalizeTicketRow mappe les champs heterogenes', () => {
    const row = normalizeTicketRow({ titre: 'Incident', statut: 'ouvert', priorite: 'haute' })
    expect(row.title).toBe('Incident')
    expect(row.status).toBe('ouvert')
    expect(row.priority).toBe('haute')
  })

  test('filterSupportTickets filtre par statut/priorite/recherche', () => {
    const rows = [
      { title: 'A', description: 'x', status: 'open', priority: 'high' },
      { title: 'B', description: 'y', status: 'closed', priority: 'low' },
    ]

    expect(filterSupportTickets(rows, '', { status: 'open' })).toHaveLength(1)
    expect(filterSupportTickets(rows, '', { priority: 'low' })).toHaveLength(1)
    expect(filterSupportTickets(rows, 'b', {})).toHaveLength(1)
  })
})
