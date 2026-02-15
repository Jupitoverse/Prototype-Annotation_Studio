import { useState } from 'react'
import { api } from '../api'

export function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      onLogin(data.access_token, data.user)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <span>◇</span>
          <span>Annotation Studio</span>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Enterprise data labeling with orchestration flow</p>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="abhi@annotationstudio.com"
            required
            autoComplete="email"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-hint">
          <strong>Super Admin:</strong> abhi@annotationstudio.com or krishna@annotationstudio.com / admin123 or mahabharat<br />
          <strong>Admin:</strong> yudhishthira@annotationstudio.com / mahabharat<br />
          <strong>Ops Manager:</strong> bhima@annotationstudio.com / mahabharat<br />
          <strong>Annotator:</strong> arjuna@annotationstudio.com, sahadev@annotationstudio.com / mahabharat<br />
          <strong>Reviewer:</strong> nakula@annotationstudio.com, draupadi@annotationstudio.com / mahabharat
        </p>
      </div>
    </div>
  )
}
