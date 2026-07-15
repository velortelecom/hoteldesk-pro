import { isUuid, requireEnterpriseId, requireProfileId } from './enterprise'

describe('enterprise service helpers', () => {
  it('validates uuids', () => {
    expect(isUuid('2ea8568e-22a8-437f-9cc9-12eb5e1eee52')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })

  it('guards enterprise and profile context', () => {
    expect(requireEnterpriseId({ entreprise_id: '2ea8568e-22a8-437f-9cc9-12eb5e1eee52' })).toBe('2ea8568e-22a8-437f-9cc9-12eb5e1eee52')
    expect(requireProfileId({ id: '2ea8568e-22a8-437f-9cc9-12eb5e1eee52' })).toBe('2ea8568e-22a8-437f-9cc9-12eb5e1eee52')
    expect(() => requireEnterpriseId({ entreprise_id: null })).toThrow('missing_enterprise_id')
    expect(() => requireProfileId({ id: null })).toThrow('missing_profile_id')
  })
})