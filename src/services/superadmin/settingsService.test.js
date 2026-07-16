import { classifySetting, filterSettings } from './settingsService'

describe('settingsService', () => {
  test('classifySetting separe sensible et visuel', () => {
    const a = classifySetting({ key: 'smtp_password', value: 'x' })
    const b = classifySetting({ key: 'brand_primary_color', value: '#000' })

    expect(a.category).toBe('sensitive')
    expect(b.category).toBe('visual')
  })

  test('filterSettings applique recherche texte', () => {
    const rows = [
      { key: 'brand_name', value: 'Velor' },
      { key: 'smtp_host', value: 'mail.local' },
    ]

    expect(filterSettings(rows, 'brand')).toHaveLength(1)
    expect(filterSettings(rows, 'mail')).toHaveLength(1)
  })
})
