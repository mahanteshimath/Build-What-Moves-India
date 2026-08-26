import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
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

  return (
    <section className="panel panel--narrow" aria-labelledby="signin-heading">
      <h2 className="panel__heading" id="signin-heading">
        Sign in
      </h2>

      <p className="callout callout--warn">
        <CircleAlert aria-hidden size={17} />
        <span>
          <strong>This is a demo sign-in, not a security control.</strong> These
          accounts are written into the page source, so anyone can read them.
          Use it to walk through the product; do not put anything real behind
          it.
        </span>
      </p>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="field__input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
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
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <button className="button" type="submit">
          Sign in
        </button>
      </form>

      <div className="hint">
        <p className="hint__title">Demo accounts</p>
        <ul className="hint__list">
          {DEMO_USERS.map((user) => (
            <li key={user.username}>
              <code>{user.username}</code> / <code>{user.password}</code> —{' '}
              {user.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
