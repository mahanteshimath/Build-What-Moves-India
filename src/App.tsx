import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { useAuth } from './auth-context'
import { officialSources } from './data/sources'
import { checks } from './rules/checks'
import BriefPage from './pages/BriefPage'
import ExplorerPage from './pages/ExplorerPage'
import LoginPage from './pages/LoginPage'
import './App.css'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function TopBar() {
  const { user, signOut } = useAuth()
  if (!user) return null

  return (
    <div className="topbar no-print">
      <nav className="topbar__nav" aria-label="Sections">
        <NavLink to="/brief" className="topbar__link">
          Brief
        </NavLink>
        <NavLink to="/explorer" className="topbar__link">
          How we tested this
        </NavLink>
      </nav>
      <div className="topbar__account">
        <span className="topbar__who">{user.name}</span>
        <button type="button" className="button button--quiet" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { user } = useAuth()

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="masthead">
        <div className="masthead__inner">
          <p className="brand">
            Sakshya <span>साक्ष्य</span>
          </p>
          <h1 className="lead">
            You paid on time. The return doesn&rsquo;t show it.
            <br />
            Here is exactly which record disagrees.
          </h1>
          <p className="standfirst">
            When an automated system and your own paperwork disagree, the burden
            of proof lands on you. Sakshya puts your side of the record
            together for Income Tax e-Filing &mdash; {checks.length} checks that
            work the same way every time, a tamper-evident list of your
            documents, and a one-page summary you can print and carry.
          </p>
          <p className="privacy">
            <ShieldCheck aria-hidden size={16} />
            Your summary is worked out inside this browser and never leaves your
            device. The one exception is the &ldquo;How we tested this&rdquo;
            page, which asks our own server for figures about our practice data
            &mdash; never about you.
          </p>
        </div>
      </header>

      <TopBar />

      <main className="layout" id="main">
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/brief" replace /> : <LoginPage />}
          />
          <Route
            path="/brief"
            element={
              <RequireAuth>
                <BriefPage />
              </RequireAuth>
            }
          />
          <Route
            path="/explorer"
            element={
              <RequireAuth>
                <ExplorerPage />
              </RequireAuth>
            }
          />
          <Route
            path="*"
            element={<Navigate to={user ? '/brief' : '/login'} replace />}
          />
        </Routes>
      </main>

      <footer className="footer">
        <p>
          Sakshya is an independent prototype. It describes differences between
          records. It does not give tax or legal advice, predict an outcome, or
          state why a portal behaved as it did.
        </p>
        <ul className="footer__links">
          {officialSources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
                <ArrowUpRight aria-hidden size={14} />
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </>
  )
}
