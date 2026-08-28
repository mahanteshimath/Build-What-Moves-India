import type { TaxProfile } from '../domain/tax'
import { EVERIFICATION_WINDOW_DAYS } from './checks'

export type ClockState = 'open' | 'due-soon' | 'lapsed' | 'met'

export interface Clock {
  id: string
  label: string
  /** The date the clock runs to, as an ISO instant. */
  deadline: string
  state: ClockState
  /** Negative once the deadline has passed. */
  daysRemaining: number
  detail: string
}

const DAY_MS = 86_400_000
const DUE_SOON_DAYS = 7

/** Whole days from `now` to `deadline`, counting a partly-elapsed day as remaining. */
export function daysUntil(deadline: string, now: Date): number {
  return Math.ceil((new Date(deadline).getTime() - now.getTime()) / DAY_MS)
}

function stateFor(daysRemaining: number): ClockState {
  if (daysRemaining < 0) return 'lapsed'
  if (daysRemaining <= DUE_SOON_DAYS) return 'due-soon'
  return 'open'
}

/**
 * The dated obligations already recorded on the profile. Reports only what the
 * records show; it does not say what happens when a date passes.
 */
export function clocksFor(profile: TaxProfile, now: Date = new Date()): Clock[] {
  const clocks: Clock[] = []

  if (!profile.filedOn) {
    const daysRemaining = daysUntil(profile.dueDate, now)
    clocks.push({
      id: 'filing-due',
      label: 'Filing due date',
      deadline: profile.dueDate,
      state: stateFor(daysRemaining),
      daysRemaining,
      detail: 'No submission date is recorded against this return yet.',
    })
  }

  if (profile.filedOn && !profile.everifiedOn) {
    const deadline = new Date(
      new Date(profile.filedOn).getTime() + EVERIFICATION_WINDOW_DAYS * DAY_MS,
    ).toISOString()
    const daysRemaining = daysUntil(deadline, now)
    clocks.push({
      id: 'everification-window',
      label: `e-verification window (${EVERIFICATION_WINDOW_DAYS} days from submission)`,
      deadline,
      state: stateFor(daysRemaining),
      daysRemaining,
      detail: 'The return records a submission date but no verification date.',
    })
  }

  if (profile.filedOn && profile.everifiedOn) {
    clocks.push({
      id: 'everification-window',
      label: 'e-verification',
      deadline: profile.everifiedOn,
      state: 'met',
      daysRemaining: 0,
      detail: 'A verification date is recorded against this return.',
    })
  }

  if (profile.notice) {
    const daysRemaining = daysUntil(profile.notice.respondBy, now)
    clocks.push({
      id: 'notice-respond-by',
      label: `Response date on the section ${profile.notice.code} notice`,
      deadline: profile.notice.respondBy,
      state: stateFor(daysRemaining),
      daysRemaining,
      detail: 'This is the date printed on the notice itself.',
    })
  }

  return clocks
}

/** "in 12 days", "today", "3 days ago" — plain wording, no urgency language. */
export function describeRemaining(clock: Clock): string {
  if (clock.state === 'met') return 'recorded'
  if (clock.daysRemaining === 0) return 'today'
  if (clock.daysRemaining === 1) return 'tomorrow'
  if (clock.daysRemaining === -1) return 'yesterday'
  if (clock.daysRemaining < 0) return `${Math.abs(clock.daysRemaining)} days ago`
  return `in ${clock.daysRemaining} days`
}
