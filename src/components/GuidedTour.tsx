import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Compass, X } from 'lucide-react'
import { TOUR_EVENT } from './startTour'
import { placeCard } from './tourPlacement'
import '../guided-tour.css'

const SEEN_KEY = 'sakshya.tour.v1'

/** Storage is unavailable in some privacy modes; a refused read must not stop the app. */
function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'done'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, 'done')
  } catch {
    // Nothing to do; the tour simply offers itself again next visit.
  }
}

interface Step {
  route: string
  selector?: string
  title: string
  body: string
  tip?: string
}

const STEPS: Step[] = [
  {
    route: '/tour',
    title: 'A two-minute walk through the desk',
    body: 'Sakshya assembles your own side of the record when your paperwork and a return disagree. This walkthrough opens each surface in turn and points at the control that matters.',
    tip: 'Use the arrow keys to move, Esc to leave. You can restart it any time from Start Here.',
  },
  {
    route: '/tour',
    selector: '.topbar__nav',
    title: 'Five tabs, one order',
    body: 'Left to right: what taxpayers run into, your brief, your own figures, your readiness score, and how common the pattern is.',
  },
  {
    route: '/issues',
    selector: '.views-catalog-grid',
    title: 'Recognise the situation first',
    body: 'Each card records what taxpayers encounter — never why the portal behaved as it did — with the observations behind it and a link to the official source.',
    tip: 'The chips name the deterministic checks that cover that issue.',
  },
  {
    route: '/brief',
    selector: '.picker',
    title: 'Pick a record to read',
    body: 'These are synthetic taxpayer profiles. Everything below re-computes the moment you switch.',
  },
  {
    route: '/brief',
    selector: '.clocks',
    title: 'The windows still running',
    body: 'Each statutory window is shown in days left and marked open, due soon, lapsed, or met.',
    tip: 'Status is never colour alone — every clock carries its state in words.',
  },
  {
    route: '/brief',
    selector: '.tally-section',
    title: 'Filter by what needs doing',
    body: 'The tally counts findings by status. Click a chip to narrow the list to just that group.',
  },
  {
    route: '/brief',
    selector: '.finding',
    title: 'A finding names two records',
    body: 'Every finding states an objective difference — this document says X, that one says Y — with the documents it read and the route to raise it. No outcome is predicted.',
    tip: 'The search box above filters findings by wording.',
  },
  {
    route: '/brief',
    selector: '.levers',
    title: 'Test a what-if',
    body: 'Move one figure and the findings re-run, each marked carried, cleared, or newly raised.',
  },
  {
    route: '/brief',
    selector: '.assist',
    title: 'A draft in English or Hindi',
    body: 'A prioritised action list and a grievance draft. It is a local template, labelled as a mock-up — no model decides what a document says.',
  },
  {
    route: '/brief',
    selector: '.exhibit__tabs',
    title: 'Take it somewhere',
    body: 'The same findings as copy-ready text for three destinations: a grievance, AIS feedback, and the deductor who files the correction.',
  },
  {
    route: '/brief',
    selector: '.ledger__hash-box',
    title: 'A fingerprint you can quote',
    body: 'A SHA-256 hash of each record, computed in your browser. Anyone with the same file can re-hash it and get the same string.',
    tip: 'The copy button puts the hash on your clipboard; the ledger downloads as plain text.',
  },
  {
    route: '/brief',
    selector: '.print-button',
    title: 'Carry one page',
    body: 'Prints the brief with the screen-only controls dropped out.',
  },
  {
    route: '/my-case',
    selector: '.own-form',
    title: 'Now your own figures',
    body: 'Type your own amounts, dates and notice details. The same checks run over them here, in this tab, and nothing is uploaded or saved.',
    tip: 'Print before you close the tab — the figures are gone when you do.',
  },
  {
    route: '/readiness',
    selector: '.readiness__hero',
    title: 'Your filing readiness',
    body: 'A score with the factors that moved it, so you can see which record is costing you the most.',
  },
  {
    route: '/explorer',
    selector: '.query-grid',
    title: 'How common is this',
    body: 'The one tab that leaves your browser. It runs a fixed, named query against a warehouse of the same synthetic records — never SQL you type.',
  },
  {
    route: '/tour',
    title: 'That is the whole desk',
    body: 'It files nothing, logs into nothing, and stores nothing. It gives no legal or tax advice and predicts no refund — it only names the difference between two records you already hold.',
    tip: 'Start Here keeps the full feature list, the tips, and this walkthrough.',
  },
]

function samePlace(a: DOMRect, b: DOMRect) {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

/** Spotlights the real control on the real page, one step at a time. */
export function GuidedTour({ enabled }: { enabled: boolean }) {
  const [index, setIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardHeight, setCardHeight] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const go = useCallback((next: number | null) => {
    setRect(null)
    setIndex(next)
  }, [])

  const close = useCallback(() => {
    markSeen()
    go(null)
  }, [go])

  useEffect(() => {
    const open = () => go(0)
    window.addEventListener(TOUR_EVENT, open)
    return () => window.removeEventListener(TOUR_EVENT, open)
  }, [go])

  useEffect(() => {
    if (enabled && !seen()) go(0)
  }, [enabled, go])

  // Track the target every frame so smooth scrolling, resizing and layout shifts all follow.
  useEffect(() => {
    if (index === null) return
    const step = STEPS[index]
    if (location.pathname !== step.route) {
      navigate(step.route)
      return
    }
    if (!step.selector) return

    const selector = step.selector
    let scrolled = false
    let frame = requestAnimationFrame(function tick() {
      const element = document.querySelector(selector)
      if (element) {
        if (!scrolled) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' })
          scrolled = true
        }
        const next = element.getBoundingClientRect()
        setRect((previous) => (previous && samePlace(previous, next) ? previous : next))
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [index, location.pathname, navigate])

  useEffect(() => {
    if (index === null) return
    cardRef.current?.focus()
  }, [index])

  useLayoutEffect(() => {
    setCardHeight(cardRef.current?.offsetHeight ?? 0)
  }, [index])

  useEffect(() => {
    if (index === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowRight') go(index + 1 < STEPS.length ? index + 1 : null)
      else if (event.key === 'ArrowLeft' && index > 0) go(index - 1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go, close])

  if (index === null) return null

  const step = STEPS[index]
  const last = index === STEPS.length - 1
  const view = { width: window.innerWidth, height: window.innerHeight }
  const width = Math.min(400, view.width - 32)
  const { left, top } = placeCard(rect, { width, height: cardHeight || 280 }, view)

  return (
    <div className="tourguide no-print">
      <div className="tourguide__blocker" />
      {rect && (
        <div
          className="tourguide__spot"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div
        className="tourguide__card"
        style={{ width, left, top }}
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tourguide-title"
      >
        <div className="tourguide__head">
          <span className="tourguide__count">
            <Compass aria-hidden size={14} /> Step {index + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            className="tourguide__close"
            onClick={close}
            aria-label="Leave the walkthrough"
          >
            <X aria-hidden size={16} />
          </button>
        </div>

        <div
          className="tourguide__progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={index + 1}
        >
          <span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>

        <h2 className="tourguide__title" id="tourguide-title">
          {step.title}
        </h2>
        <p className="tourguide__body">{step.body}</p>
        {step.tip && (
          <p className="tourguide__tip">
            <strong>Tip:</strong> {step.tip}
          </p>
        )}

        <div className="tourguide__actions">
          <button type="button" className="button button--quiet button--sm" onClick={close}>
            Skip
          </button>
          <div className="tourguide__nav">
            <button
              type="button"
              className="button button--quiet button--sm"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            >
              <ChevronLeft aria-hidden size={14} /> Back
            </button>
            <button
              type="button"
              className="button button--sm"
              onClick={() => (last ? close() : go(index + 1))}
            >
              {last ? 'Finish' : 'Next'}
              {!last && <ChevronRight aria-hidden size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
