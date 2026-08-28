import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Award,
  CircleAlert,
  Clipboard,
  Database,
  Fingerprint,
  Keyboard,
  Languages,
  PencilLine,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  FileText,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '../auth-context'
import { portalIssues } from '../data/portalIssues'
import { profiles } from '../data/profiles'
import { checks } from '../rules/checks'
import '../tour.css'

/** Left column: the situation the paperwork leaves you in. Right: what this desk adds. */
const COMPARISON: { row: string; today: string; here: string }[] = [
  {
    row: 'Where the figures sit',
    today:
      'Form 16, Form 26AS, the AIS, challan receipts and the filed return each arrive as a separate screen or download. Reading across them is manual.',
    here: 'The disputed figures are placed on one row, and each finding names the two records that disagree.',
  },
  {
    row: 'Finding the difference',
    today: 'You compare the documents yourself, and a tired reading misses a row.',
    here: `${checks.length} deterministic checks run over the record. Same input, same output, every time — no model decides what a document says.`,
  },
  {
    row: 'Proving the file is the one you had',
    today: 'A downloaded PDF carries no fingerprint you can quote to a second desk.',
    here: 'A SHA-256 fingerprint of every record, computed in your browser and printed on the brief, so anyone can re-hash the same file and check.',
  },
  {
    row: 'Something to hand over',
    today: 'You retype the same account for the helpdesk, for AIS feedback, and for the deductor.',
    here: 'Copy-ready text for each of those three destinations, a one-page printable brief, and a downloadable plain-text ledger.',
  },
  {
    row: 'The dates still running',
    today: 'Each window sits inside its own notice or FAQ.',
    here: 'A clock strip showing the days left on every window that is open for this record.',
  },
  {
    row: 'Your own numbers',
    today: 'To test your own case you have to trust a spreadsheet you built yourself.',
    here: 'Type your own figures and the same checks run on them, in the browser, with nothing uploaded.',
  },
  {
    row: 'Whether it is only you',
    today: 'One taxpayer cannot see the shape of a pattern.',
    here: `Aggregate counts across the synthetic warehouse, alongside ${portalIssues.length} documented issue write-ups drawn from the research corpus.`,
  },
  {
    row: 'Reading it in your language',
    today: 'Guidance is largely English-first.',
    here: 'Action lists and a grievance draft in English or Hindi — clearly marked as a local template mock-up, kept out of the correctness path.',
  },
]

const STEPS: {
  to: string
  icon: LucideIcon
  title: string
  what: string
  tip: string
}[] = [
  {
    to: '/issues',
    icon: CircleAlert,
    title: 'Documented Portal Issues',
    what: `${portalIssues.length} write-ups of what taxpayers encounter, each with observations and an official source link.`,
    tip: 'Start here to recognise your situation, then follow the checks each issue is covered by.',
  },
  {
    to: '/brief',
    icon: FileText,
    title: 'Evidentiary Brief',
    what: `The core surface. Pick one of ${profiles.length} synthetic profiles and read every finding, its two disagreeing records, and the route to raise it.`,
    tip: 'Use the tally chips at the top to filter to action-needed findings, and the levers to test a what-if figure.',
  },
  {
    to: '/my-case',
    icon: PencilLine,
    title: 'Your Own Figures',
    what: 'Enter your own amounts, dates and notice details; the same checks run over them in this tab.',
    tip: 'Nothing you type here leaves the browser. Print the result before you close the tab — it is not saved.',
  },
  {
    to: '/readiness',
    icon: Award,
    title: 'KarSamman Readiness',
    what: 'A filing-readiness score with the factors that moved it, and a shareable card image.',
    tip: 'The factor bars show which record is costing you points; fix that one first.',
  },
  {
    to: '/explorer',
    icon: Database,
    title: 'How Common Is This',
    what: 'Aggregate queries over a hosted warehouse of the same synthetic records.',
    tip: 'This is the one tab that leaves your browser. It runs a fixed, named query — never SQL you type.',
  },
]

const TIPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Printer,
    title: 'Print the one-pager',
    body: 'The print button renders a carry-to-the-counter brief. Screen-only controls drop out of the printed page.',
  },
  {
    icon: Fingerprint,
    title: 'Copy a fingerprint',
    body: 'Each ledger row has a copy button for its SHA-256 hash, so you can quote it in a grievance.',
  },
  {
    icon: Clipboard,
    title: 'Take it somewhere',
    body: 'The exhibit tabs give three ready texts: a grievance note, AIS feedback, and a note for the deductor.',
  },
  {
    icon: Search,
    title: 'Filter the findings',
    body: 'The search box narrows findings by wording; the tally chips narrow by status.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Test a what-if',
    body: 'The levers adjust one figure at a time and mark each finding carried, cleared, or newly raised.',
  },
  {
    icon: Timer,
    title: 'Watch the clocks',
    body: 'The clock strip marks each window open, due soon, lapsed, or met, in days, not jargon.',
  },
  {
    icon: Languages,
    title: 'Switch language',
    body: 'The assist panel drafts in English or Hindi. It is a local template, labelled as a mock-up, never an authority.',
  },
  {
    icon: Keyboard,
    title: 'Keyboard and screen readers',
    body: 'Skip-to-content is the first tab stop, every control has a text label, and status is never colour alone.',
  },
  {
    icon: WifiOff,
    title: 'It works without the network',
    body: 'Every check and every hash runs locally. Only the Data Explorer tab makes a request.',
  },
]

export default function TourPage() {
  const { user } = useAuth()
  const gate = (path: string) => (user ? path : '/login')

  return (
    <div className="tour">
      <section className="panel tour__intro" aria-labelledby="tour-heading">
        <h2 className="panel__heading" id="tour-heading">
          Start here &mdash; what this desk does
        </h2>
        <p className="panel__note">
          Sakshya assembles your own side of the record for Income Tax e-Filing. It reads
          nothing from the portal and files nothing on your behalf. It reconciles the documents
          you already hold, and hands you a page you can carry.
        </p>
        <div className="tour__cta no-print">
          <Link className="button" to={gate('/brief')}>
            {user ? 'Open the Evidentiary Brief' : 'Sign in to the demo'}
          </Link>
          <a className="button button--quiet" href="#tour-walkthrough">
            Take the walkthrough
          </a>
        </div>
      </section>

      <section className="panel" aria-labelledby="tour-compare-heading">
        <h2 className="panel__heading" id="tour-compare-heading">
          What your paperwork leaves out, and what this adds
        </h2>
        <p className="panel__note">
          The left column is the position a taxpayer is left in when the documents disagree.
          The right column is what this prototype computes. The official portal remains the
          authoritative record; this desk only organises your own copy of it.
        </p>
        <ul className="tour__compare">
          {COMPARISON.map((item) => (
            <li key={item.row} className="tour-row">
              <p className="tour-row__label">{item.row}</p>
              <div className="tour-row__cells">
                <div className="tour-cell tour-cell--today">
                  <span className="tour-cell__tag">On your own</span>
                  <p className="tour-cell__text">{item.today}</p>
                </div>
                <div className="tour-cell tour-cell--here">
                  <span className="tour-cell__tag">In Sakshya</span>
                  <p className="tour-cell__text">{item.here}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="tour-walkthrough-heading" id="tour-walkthrough">
        <h2 className="panel__heading" id="tour-walkthrough-heading">
          Walkthrough &mdash; five tabs, in order
        </h2>
        <p className="panel__note">
          Each step is one tab in the bar above. Read them in this order the first time.
        </p>
        <ol className="tour__steps">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.to} className="tour-step">
                <span className="tour-step__number" aria-hidden>
                  {index + 1}
                </span>
                <div className="tour-step__body">
                  <Link className="tour-step__title" to={gate(step.to)}>
                    <Icon aria-hidden size={16} />
                    <span>{step.title}</span>
                  </Link>
                  <p className="tour-step__what">{step.what}</p>
                  <p className="tour-step__tip">
                    <strong>Tip:</strong> {step.tip}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="panel" aria-labelledby="tour-tips-heading">
        <h2 className="panel__heading" id="tour-tips-heading">
          Interface tips worth knowing
        </h2>
        <ul className="tour__tips">
          {TIPS.map((tip) => {
            const Icon = tip.icon
            return (
              <li key={tip.title} className="tour-tip">
                <span className="tour-tip__icon" aria-hidden>
                  <Icon size={16} />
                </span>
                <div>
                  <p className="tour-tip__title">{tip.title}</p>
                  <p className="tour-tip__body">{tip.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel" aria-labelledby="tour-limits-heading">
        <h2 className="panel__heading" id="tour-limits-heading">
          <ShieldCheck aria-hidden size={18} /> What it deliberately does not do
        </h2>
        <ul className="tour__limits">
          <li>No portal login, scraping, OTP handling, or government API call.</li>
          <li>No filing, no grievance submission, and no document is stored anywhere.</li>
          <li>
            No legal or tax advice, no prediction of a refund or an approval, and no claim about
            why a portal behaved as it did &mdash; only the objective difference between two named
            records.
          </li>
          <li>Income Tax only. All profiles are synthetic; the sign-in is a demo gate, not security.</li>
        </ul>
        <div className="tour__cta no-print">
          <Link className="button" to={gate('/brief')}>
            {user ? 'Open the Evidentiary Brief' : 'Sign in to the demo'}
          </Link>
        </div>
      </section>
    </div>
  )
}
