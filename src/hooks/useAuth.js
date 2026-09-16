import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Cle de persistance du contexte entreprise choisi par le Super Admin.
const STORAGE_KEY = 'velor.contexte_entreprise'

function readStoredContexte() {
  try { return window.localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // CONTEXTE ENTREPRISE (architecture Velor One, sections 2 et 9)
  // Le Super Admin n'est rattache a AUCUNE entreprise : son entreprise_id
  // est null par design. On ne lui en assigne donc PAS une, on lui donne un
  // contexte entreprise explicite, choisi depuis le Centre de Controle.
  const [contexteEntreprise, setContexteEntrepriseState] = useState(readStoredContexte)

  const isSuperAdmin = !!profile?.is_super_admin
  const entrepriseId = isSuperAdmin ? contexteEntreprise : (profile?.entreprise_id ?? null)

  // Profil "effectif" transmis aux modules : identique au profil reel, mais
  // dont entreprise_id porte le contexte actif.
  const profileEffectif = profile ? { ...profile, entreprise_id: entrepriseId } : null

  const setContexteEntreprise = useCallback((id) => {
    setContexteEntrepriseState(id || null)
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch { /* stockage indisponible : contexte valable pour la session */ }
  }, [])

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
    setProfile(data ?? null)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setContexteEntreprise(null)
  }

  // Le profil expose EST le profil effectif. L'ancien main exposait le profil
  // reel et avait converti les pages une par une pour lire entrepriseId, mais
  // pas les modules : un Super Admin en contexte avait donc Conges, Pointage et
  // Organisation vides. En portant le contexte dans profile.entreprise_id, tout
  // consommateur suit le contexte sans qu'on ait a le convertir, et on ne peut
  // pas en oublier un. profileReel reste disponible pour le rare cas ou on veut
  // l'entreprise de rattachement reelle (null pour un Super Admin).
  return (
    <AuthContext.Provider value={{
      user,
      profile: profileEffectif,
      profileReel: profile,
      profileEffectif,
      loading,
      signIn,
      signOut,
      isSuperAdmin,
      entrepriseId,
      contexteEntreprise,
      setContexteEntreprise,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
