import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ identifiant: '', password: '' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.identifiant.trim() || !form.password.trim()) {
      setError('Identifiant et mot de passe requis')
      return
    }
    setLoading(true)
    setError('')
    // L email est construit : identifiant + @hoteldesk.local
    const email = form.identifiant.trim() + '@hoteldesk.local'
    const { error: err } = await signIn(email, form.password)
    if (err) {
      setError('Identifiant ou mot de passe incorrect')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f5f3 0%, #e8e7e0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: '#185FA5', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, fontWeight: 700, margin: '0 auto 12px'
          }}>V</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>HotelDesk Pro</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Connexion a votre espace</div>
        </div>

        {/* Carte connexion */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          border: '0.5px solid #e0dfd8'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 20 }}>
            Connexion
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>
                Identifiant (6 chiffres)
              </label>
              <input
                type="text"
                value={form.identifiant}
                onChange={e => set('identifiant', e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="ex: 123456"
                maxLength={6}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '0.5px solid #d0cfc8', borderRadius: 8,
                  fontSize: 16, letterSpacing: 6, fontWeight: 600,
                  outline: 'none', background: '#fafaf8',
                  boxSizing: 'border-box', textAlign: 'center'
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mot de passe"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '0.5px solid #d0cfc8', borderRadius: 8,
                  fontSize: 14, outline: 'none', background: '#fafaf8',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2', color: '#DC2626',
                padding: '10px 12px', borderRadius: 8,
                fontSize: 13, marginBottom: 14
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#93C5FD' : '#185FA5',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .2s'
              }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#aaa' }}>
          Votre identifiant et mot de passe vous ont ete fournis par votre administrateur
        </div>
      </div>
    </div>
  )
}
