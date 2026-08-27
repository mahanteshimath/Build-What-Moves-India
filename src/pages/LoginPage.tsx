import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, KeyRound, ShieldCheck, UserCheck } from 'lucide-react'
import { DEMO_USERS, useAuth } from '../auth-context'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const failure = signIn(username, password)
    if (failure) {
      setError(failure)
      return
    }
    navigate('/brief', { replace: true })
  }

  function loginAs(user: (typeof DEMO_USERS)[number]) {
    setUsername(user.username)
    setPassword(user.password)
    const failure = signIn(user.username, user.password)
    if (failure) {
      setError(failure)
      return
    }
    navigate('/brief', { replace: true })
  }

  return (
    <section className="panel panel--narrow login-panel" aria-labelledby="signin-heading">
      <div className="login-panel__header">
        <div className="login-panel__badge">
          <ShieldCheck aria-hidden size={18} />
          <span>Evidentiary Desk Demo</span>
        </div>
        <h2 className="panel__heading" id="signin-heading">
          Sign in to Sakshya
        </h2>
        <p className="panel__note">
          Inspect deterministic discrepancy briefs for synthetic taxpayer profiles.
        </p>
      </div>

      <div className="callout callout--warn">
        <CircleAlert aria-hidden size={17} />
        <span>
          <strong>This is a client-side demo gate.</strong> Accounts are bundled in page memory for demonstration. No confidential tax records or passwords should be entered.
        </span>
      </div>

      <div className="demo-shortcuts">
        <p className="demo-shortcuts__title">
          <UserCheck aria-hidden size={15} /> Quick Demo Access:
        </p>
        <div className="demo-shortcuts__grid">
          {DEMO_USERS.map((user) => (
            <button
              key={user.username}
              type="button"
              className="demo-shortcuts__button"
              onClick={() => loginAs(user)}
              title={`Sign in as ${user.name}`}
            >
              <span className="demo-shortcuts__name">{user.name}</span>
              <span className="demo-shortcuts__meta">
                <code>{user.username}</code>
                <ArrowRight aria-hidden size={13} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="divider">
        <span>or sign in manually</span>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="field__input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. ananya"
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="e.g. sakshya-demo"
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <button className="button button--full" type="submit">
          <KeyRound aria-hidden size={16} />
          Sign in
        </button>
      </form>
    </section>
  )
}

