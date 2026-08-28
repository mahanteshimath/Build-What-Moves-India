import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ArrowUpRight, Award, CircleAlert, Database, FileText, LogOut, PencilLine, ShieldCheck, User } from 'lucide-react'
import { useAuth } from './auth-context'
import { officialSources } from './data/sources'
import { checks } from './rules/checks'
import BriefPage from './pages/BriefPage'
import ExplorerPage from './pages/ExplorerPage'
import IssuesPage from './pages/IssuesPage'
import LoginPage from './pages/LoginPage'
import MyCasePage from './pages/MyCasePage'
import ReadinessPage from './pages/ReadinessPage'
import './App.css'
import './evidence.css'
import './exhibit.css'
import './a11y.css'

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
      <div className="topbar__inner">
        <nav className="topbar__nav" aria-label="Application Sections">
          <NavLink
            to="/issues"
            className={({ isActive }) =>
              `topbar__link ${isActive ? 'topbar__link--active' : ''}`
            }
          >
            <CircleAlert aria-hidden size={16} />
            <span>Documented Portal Issues</span>
          </NavLink>
          <NavLink
            to="/brief"
            className={({ isActive }) =>
              `topbar__link ${isActive ? 'topbar__link--active' : ''}`
            }
          >
            <FileText aria-hidden size={16} />
            <span>Evidentiary Brief</span>
          </NavLink>
          <NavLink
            to="/my-case"
            className={({ isActive }) =>
              `topbar__link ${isActive ? 'topbar__link--active' : ''}`
            }
          >
            <PencilLine aria-hidden size={16} />
            <span>Your Own Figures</span>
          </NavLink>
          <NavLink
            to="/readiness"
            className={({ isActive }) =>
              `topbar__link ${isActive ? 'topbar__link--active' : ''}`
            }
          >
            <Award aria-hidden size={16} />
            <span>KarSamman Readiness</span>
          </NavLink>
          <NavLink
            to="/explorer"
            className={({ isActive }) =>
              `topbar__link ${isActive ? 'topbar__link--active' : ''}`
            }
          >
            <Database aria-hidden size={16} />
            <span>How Common Is This</span>
          </NavLink>
        </nav>
        <div className="topbar__account">
          <div className="topbar__user-badge">
            <User aria-hidden size={14} />
            <span className="topbar__who">{user.name}</span>
          </div>
          <button
            type="button"
            className="button button--quiet button--sm"
            onClick={signOut}
            title="Sign out of demo session"
          >
            <LogOut aria-hidden size={14} />
            <span>Sign out</span>
          </button>
        </div>
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

      <div className="gov-stripe" aria-hidden="true" />
      <div className="gov-topbar no-print">
        <div className="gov-topbar__inner">
          <div className="gov-topbar__left">
            <span className="gov-topbar__text">
              Independent hackathon prototype &bull; not a Government of India service
            </span>
          </div>
          <div className="gov-topbar__right">
            <span className="gov-topbar__dept">
              Synthetic data &bull; no portal connection
            </span>
            <span className="gov-topbar__badge">Built with OpenAI Codex</span>
          </div>
        </div>
      </div>

      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__header-block">
            <div className="masthead__brand-group">
              <div className="masthead__emblem" aria-hidden="true">
                <ShieldCheck size={28} />
              </div>
              <div>
                <p className="brand">
                  <span className="brand__hindi">साक्ष्य</span>
                  <span className="brand__separator">|</span>
                  <span className="brand__english">SAKSHYA</span>
                </p>
                <p className="brand__sub">
                  An independent evidentiary desk for Income Tax e-Filing &bull; built for a hackathon, unaffiliated with the Income Tax Department
                </p>
              </div>
            </div>
          </div>

          <h1 className="lead">
            You paid on time. The return doesn&rsquo;t show it.
            <br />
            <span className="lead__highlight">Here is exactly which record disagrees.</span>
          </h1>
          <p className="standfirst">
            When an automated system and your own paperwork disagree, the burden
            of proof lands on you. Sakshya puts your side of the record
            together for Income Tax e-Filing &mdash; {checks.length} deterministic checks that
            work consistently, a tamper-evident cryptographic fingerprint of your
            documents, and a one-page summary you can print and carry.
          </p>
          <div className="privacy-badge">
            <ShieldCheck aria-hidden size={18} />
            <span>
              <strong>The brief is computed in your browser:</strong> every check and every SHA-256 fingerprint runs locally, and no record is uploaded. The Data Explorer tab is the one exception &mdash; it reads a hosted warehouse of the same synthetic records.
            </span>
          </div>
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
            path="/my-case"
            element={
              <RequireAuth>
                <MyCasePage />
              </RequireAuth>
            }
          />
          <Route
            path="/readiness"
            element={
              <RequireAuth>
                <ReadinessPage />
              </RequireAuth>
            }
          />
          <Route
            path="/issues"
            element={
              <RequireAuth>
                <IssuesPage />
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
        <div className="footer__inner">
          <p className="footer__disclaimer">
            Sakshya is an independent browser-based evidentiary tool. It objectively reconciles discrepancies between named tax documents. It does not provide legal or tax advice, predict tax outcomes, or state portal backend causes.
          </p>
          <p className="footer__disclaimer">
            Built with <strong>OpenAI Codex</strong> &mdash; Codex derived the failure shapes from the research corpus, wrote the {checks.length} deterministic checks and their tests, and built these surfaces. No model runs in the correctness path; every check is a pure function.
          </p>
          <div className="footer__links-section">
            <span className="footer__links-title">Official Income Tax Portals & Sources:</span>
            <ul className="footer__links">
              {officialSources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    <span>{source.label}</span>
                    <ArrowUpRight aria-hidden size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </>
  )
}

