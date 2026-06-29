import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email.trim() || !form.password.trim()) {
      setError('Email et mot de passe requis')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await signIn(form.email.trim(), form.password)
    if (err) {
      setError('Email ou mot de passe incorrect')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f5f3 0%, #e8e7e0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, background: '#185FA5', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 26, fontWeight: 700, margin: '0 auto 14px'
          }}>V</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>HotelDesk Pro</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Connectez-vous a votre espace</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 18, padding: 32, boxShadow: '0 4px 32px rgba(0,0,0,.09)', border: '1px solid #e8e7e0' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 24 }}>Connexion</div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Adresse email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 15, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mot de passe"
                autoComplete="current-password"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 15, outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }}
              />
            </div>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 18 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#93C5FD' : '#185FA5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
          Vos identifiants (email + mot de passe) vous ont ete fournis par votre administrateur
        </div>
      </div>
    </div>
  )
}
