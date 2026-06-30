import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })
  const [view, setView] = useState('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setView('new_password')
    }
  }, [])

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

  async function handleForgot(e) {
    e.preventDefault()
    if (!resetEmail.trim()) {
      setResetError('Veuillez entrer votre adresse email')
      return
    }
    setResetLoading(true)
    setResetError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin
    })
    setResetLoading(false)
    if (err) {
      setResetError('Erreur lors de envoi. Verifiez votre email.')
    } else {
      setView('forgot_sent')
    }
  }

  async function handleNewPassword(e) {
    e.preventDefault()
    if (!newPassword.trim()) {
      setUpdateError('Veuillez entrer un nouveau mot de passe')
      return
    }
    if (newPassword !== newPassword2) {
      setUpdateError('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 8) {
      setUpdateError('Le mot de passe doit faire au moins 8 caracteres')
      return
    }
    setUpdateLoading(true)
    setUpdateError('')
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    setUpdateLoading(false)
    if (err) {
      setUpdateError('Erreur: ' + err.message)
    } else {
      setView('password_updated')
      window.location.hash = ''
    }
  }

  const cardStyle = {
    background: '#fff', borderRadius: 18, padding: 32,
    boxShadow: '0 4px 32px rgba(0,0,0,0.10)'
  }
  const inputStyle = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0',
    borderRadius: 10, fontSize: 15, outline: 'none', background: '#fafaf8',
    boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6, display: 'block' }
  const btnPrimary = { width: '100%', padding: '13px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }
  const btnPrimaryDis = { width: '100%', padding: '13px', background: '#93C5FD', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'not-allowed' }

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

        {view === 'login' && (
          <div style={cardStyle}>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Adresse email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="username"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Mot de passe</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Mot de passe"
                  autoComplete="current-password"
                  style={inputStyle}
                />
              </div>
              <div style={{ textAlign: 'right', marginBottom: 18, marginTop: -10 }}>
                <button type="button" onClick={() => { setView('forgot'); setResetEmail(form.email); setResetError(''); }} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Mot de passe oublie ?
                </button>
              </div>
              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 18 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={loading ? btnPrimaryDis : btnPrimary}>
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>
          </div>
        )}

        {view === 'forgot' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Mot de passe oublie</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Entrez votre email pour recevoir un lien de reinitialisation.</div>
            <form onSubmit={handleForgot}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Adresse email</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="votre@email.com" style={inputStyle} />
              </div>
              {resetError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 18 }}>
                  {resetError}
                </div>
              )}
              <button type="submit" disabled={resetLoading} style={resetLoading ? btnPrimaryDis : btnPrimary}>
                {resetLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </button>
              <button type="button" onClick={() => setView('login')} style={{ width: '100%', padding: '11px', background: 'none', color: '#888', border: '1.5px solid #e0e0e0', borderRadius: 10, fontSize: 14, marginTop: 12, cursor: 'pointer' }}>
                Retour a la connexion
              </button>
            </form>
          </div>
        )}

        {view === 'forgot_sent' && (
          <div style={cardStyle}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Email envoye !</div>
              <div style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>
                Un lien de reinitialisation a ete envoye a {resetEmail}
              </div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Verifiez votre boite mail et cliquez sur le lien.</div>
              <button type="button" onClick={() => setView('login')} style={btnPrimary}>Retour a la connexion</button>
            </div>
          </div>
        )}

        {view === 'new_password' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Nouveau mot de passe</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Choisissez un nouveau mot de passe pour votre compte.</div>
            <form onSubmit={handleNewPassword}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Nouveau mot de passe</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8 caracteres minimum" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Confirmer le mot de passe</label>
                <input type="password" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} placeholder="Repeter le mot de passe" style={inputStyle} />
              </div>
              {updateError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 18 }}>
                  {updateError}
                </div>
              )}
              <button type="submit" disabled={updateLoading} style={updateLoading ? btnPrimaryDis : btnPrimary}>
                {updateLoading ? 'Mise a jour...' : 'Enregistrer le mot de passe'}
              </button>
            </form>
          </div>
        )}

        {view === 'password_updated' && (
          <div style={cardStyle}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Mot de passe mis a jour !</div>
              <div style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>Votre mot de passe a ete modifie avec succes.</div>
              <button type="button" onClick={() => setView('login')} style={btnPrimary}>Se connecter</button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
          Vos identifiants vous ont ete fournis par votre administrateur
        </div>
      </div>
    </div>
  )
}
