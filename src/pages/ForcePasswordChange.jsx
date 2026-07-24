import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BrandMark } from '../branding/Brand'

export default function ForcePasswordChange() {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id)
    setSaving(false)
    if (profileError) {
      setError(profileError.message)
      return
    }
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 16 }}>
      <BrandMark size={64} radius={16} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320, maxWidth: '100%' }}>
        <h2 style={{ textAlign: 'center', margin: 0 }}>Changement de mot de passe requis</h2>
        <p style={{ fontSize: 14, color: '#666', textAlign: 'center', margin: 0 }}>
          Pour votre securite, veuillez definir un nouveau mot de passe avant de continuer.
        </p>
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
        />
        {error && <div style={{ color: '#DC2626', fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={saving}
          style={{ padding: 10, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? 'Enregistrement...' : 'Valider'}
        </button>
      </form>
    </div>
  )
}
