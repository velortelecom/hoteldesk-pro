import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    let effectiveProfile = data ?? null

    if (effectiveProfile?.is_super_admin) {
      try {
        const nowIso = new Date().toISOString()
        const { data: sessions } = await supabase.from('super_admin_assistance_sessions').select('id, entreprise_id, expires_at, closed_at').eq('super_admin_profile_id', userId).is('closed_at', null).order('created_at', { ascending: false }).limit(5)
        const active = (sessions || []).find((s) => !s.expires_at || new Date(s.expires_at) > new Date(nowIso))
        if (active?.entreprise_id) {
          effectiveProfile = { ...effectiveProfile, entreprise_id: active.entreprise_id, _real_entreprise_id: effectiveProfile.entreprise_id ?? null, _assistance_session_id: active.id }
        }
      } catch {
        // best effort: keep the super admin profile unchanged on failure
      }
    }
    setProfile(effectiveProfile)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
