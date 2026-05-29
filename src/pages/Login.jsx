import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', nom: '', prenom: '', role: 'employe', departement: 'reception' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    let res
    if (mode === 'login') res = await signIn(form.email, form.password)
    else res = await signUp(form.email, form.password, { nom: form.nom, prenom: form.prenom, role: form.role, departement: form.departement })
    if (res.error) setError(res.error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f3', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, border: '0.5px solid #e0dfd8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 18 }}>🏨</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>HôtelDesk Pro</div>
            <div style={{ fontSize: 12, color: '#888' }}>Gestion des tâches hôtelières</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f5f5f3', borderRadius: 8, padding: 3 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: mode === m ? '#fff' : 'transparent', fontWeight: mode === m ? 500 : 400,
              color: mode === m ? '#185FA5' : '#666',
              boxShadow: mode === m ? '0 0 0 0.5px #e0dfd8' : 'none'
            }}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Prénom</label>
                  <input value={form.prenom} onChange={e => set('prenom', e.target.value)} required placeholder="Jean" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Nom</label>
                  <input value={form.nom} onChange={e => set('nom', e.target.value)} required placeholder="Dupont" style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Rôle</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} style={inp}>
                  <option value="employe">Employé</option>
                  <option value="responsable">Responsable</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Département</label>
                <select value={form.departement} onChange={e => set('departement', e.target.value)} style={inp}>
                  <option value="reception">Réception</option>
                  <option value="menage">Ménage</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="restauration">Restauration</option>
                  <option value="direction">Direction</option>
                </select>
              </div>
            </>
          )}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="jean@hotel.fr" style={inp} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Mot de passe</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required placeholder="••••••••" style={inp} />
          </div>
          {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 11, background: loading ? '#85B7EB' : '#185FA5',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer'
          }}>
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inp = {
  width: '100%', padding: '8px 10px', border: '0.5px solid #d0cfc8',
  borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafaf8', boxSizing: 'border-box'
}
