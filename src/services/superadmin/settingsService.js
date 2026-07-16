function normalizeBackendState(error) {
  if (!error) return 'ok'
  const msg = String(error.message || error || '').toLowerCase()
  if (msg.includes('does not exist') || msg.includes('schema cache')) return 'non_configure'
  return 'indisponible'
}

function normalizeSettingRow(row = {}, sourceTable = '') {
  const key = row.key || row.cle || row.name || row.nom || row.id || 'setting'
  const value = row.value ?? row.valeur ?? row.setting_value ?? row.data ?? row
  return {
    key: String(key),
    value,
    sourceTable,
    raw: row,
  }
}

export function classifySetting(setting) {
  const keyLower = String(setting.key || '').toLowerCase()
  const sensitiveHints = ['secret', 'password', 'token', 'apikey', 'api_key', 'smtp', 'service_role', 'key']
  const isSensitive = sensitiveHints.some((hint) => keyLower.includes(hint))

  return {
    ...setting,
    category: isSensitive ? 'sensitive' : 'visual',
  }
}

export function filterSettings(rows = [], searchQuery = '') {
  const needle = (searchQuery || '').trim().toLowerCase()
  if (!needle) return rows

  return rows.filter((row) => {
    return [row.key, JSON.stringify(row.value)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
}

export async function fetchGlobalSettingsData(supabase) {
  const candidates = ['global_settings', 'super_admin_settings']
  let lastError = null

  for (const table of candidates) {
    const res = await supabase.from(table).select('*').limit(200)
    if (!res.error) {
      const rows = (res.data || []).map((row) => classifySetting(normalizeSettingRow(row, table)))
      return {
        backendState: 'ok',
        sourceTable: table,
        rows,
      }
    }
    lastError = res.error
  }

  return {
    backendState: normalizeBackendState(lastError),
    sourceTable: null,
    rows: [],
  }
}
