import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', nom: '', prenom: '', departement: 'accueil' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    let res
    if (mode === 'login') {
      res = await signIn(form.email, form.password)
    } else {
      res = await signUp(form.email, form.password, {
        nom: form.nom,
        prenom: form.prenom,
        role: 'employe',
        departement: form.departement
      })
    }
    if (res.error) setError(res.error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f3', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 20px rgba(0,0,0,.08)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, background: '#185FA5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 }}>H</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>HotelDesk Pro</div>
            <div style={{ fontSize: 12, color: '#888' }}>{mode === 'login' ? 'Connexion' : 'Inscription'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          <button onClick={() => setMode('login')} style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, background: mode === 'login' ? '#fff' : 'transparent', color: mode === 'login' ? '#185FA5' : '#888', boxShadow: mode === 'login' ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
            Connexion
          </button>
          <button onClick={() => setMode('signup')} style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, background: mode === 'signup' ? '#fff' : 'transparent', color: mode === 'signup' ? '#185FA5' : '#888', boxShadow: mode === 'signup' ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input
                placeholder="Prenom *"
                value={form.prenom}
                onChange={e => set('prenom', e.target.value)}
                required
                style={{ padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                placeholder="Nom *"
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
                required
                style={{ padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <input
            type="email"
            placeholder="Email *"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            required
            style={{ width: '100%', padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="password"
            placeholder="Mot de passe *"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            required
            style={{ width: '100%', padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }}
          />

          {mode === 'signup' && (
            <div style={{ marginBottom: 10 }}>
              <select
                value={form.departement}
                onChange={e => set('departement', e.target.value)}
                style={{ width: '100%', padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}
              >
                <option value="accueil">Accueil</option>
                <option value="menage">Menage</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, padding: '6px 8px', background: '#f0f9ff', borderRadius: 6, border: '0.5px solid #bae6fd' }}>
                Votre role sera defini par l'administrateur apres votre inscription.
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', color: '#991B1B', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 13, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, cursor: 'pointer', fontWeight: 600, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Creer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
                                                           }
