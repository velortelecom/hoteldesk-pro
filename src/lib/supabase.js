import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''
const isTestEnv = process.env.NODE_ENV === 'test'

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'missing_supabase_client_env'
  : null

const runtimeUrl = supabaseConfigError ? 'https://example.supabase.co' : supabaseUrl
const runtimeAnonKey = supabaseConfigError ? 'example-anon-key' : supabaseAnonKey

if (supabaseConfigError && !isTestEnv) {
  console.error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY. Supabase calls will fail until environment is configured.')
}

export const supabase = createClient(runtimeUrl, runtimeAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})
