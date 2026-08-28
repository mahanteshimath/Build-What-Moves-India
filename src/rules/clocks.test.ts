import { describe, expect, it } from 'vitest'
import { profileById } from '../data/profiles'
import { clocksFor, daysUntil, describeRemaining } from './clocks'
import type { Clock } from './clocks'

const at = (iso: string) => new Date(iso)

describe('daysUntil', () => {
  it('counts a partly-elapsed day as still remaining', () => {
    expect(daysUntil('2026-08-10T23:59:00+05:30', at('2026-08-09T00:00:00+05:30'))).toBe(2)
  })

  it('goes negative once the deadline has passed', () => {
    expect(daysUntil('2026-08-01T23:59:00+05:30', at('2026-08-05T00:00:00+05:30'))).toBe(-3)
  })
})

describe('clocksFor', () => {
  it('counts down to the filing due date while nothing is filed', () => {
    const profile = { ...profileById('deadline-payment'), filedOn: null, everifiedOn: null }
    const clock = clocksFor(profile, at('2026-07-20T10:00:00+05:30')).find(
      (item) => item.id === 'filing-due',
    )

    expect(clock?.state).toBe('open')
    expect(clock?.daysRemaining).toBe(12)
  })

  it('marks the filing due date lapsed after it passes', () => {
    const profile = { ...profileById('deadline-payment'), filedOn: null, everifiedOn: null }
    const clock = clocksFor(profile, at('2026-08-05T10:00:00+05:30')).find(
      (item) => item.id === 'filing-due',
    )

    expect(clock?.state).toBe('lapsed')
  })

  it('drops the filing clock once a submission date exists', () => {
    const clocks = clocksFor(profileById('deadline-payment'), at('2026-08-02T10:00:00+05:30'))
    expect(clocks.find((clock) => clock.id === 'filing-due')).toBeUndefined()
  })

  it('runs the e-verification window 30 days from submission', () => {
    const profile = { ...profileById('deadline-payment'), everifiedOn: null }
    const clock = clocksFor(profile, at('2026-08-02T00:00:00+05:30')).find(
      (item) => item.id === 'everification-window',
    )

    // Submitted 2026-08-01T00:12+05:30, so the window runs to 2026-08-31.
    expect(clock?.state).toBe('open')
    expect(clock?.daysRemaining).toBe(30)
  })

  it('reports verification as met when a date is recorded', () => {
    const clock = clocksFor(profileById('deadline-payment'), at('2026-08-02T00:00:00+05:30')).find(
      (item) => item.id === 'everification-window',
    )

    expect(clock?.state).toBe('met')
  })

  it('flags a deadline inside the coming week as due soon', () => {
    const profile = { ...profileById('deadline-payment'), filedOn: null, everifiedOn: null }
    const clock = clocksFor(profile, at('2026-07-28T10:00:00+05:30')).find(
      (item) => item.id === 'filing-due',
    )

    expect(clock?.state).toBe('due-soon')
  })

  it('counts down to the response date printed on a notice', () => {
    const profile = profileById('notice-response')
    const clock = clocksFor(profile, at('2026-08-02T10:00:00+05:30')).find(
      (item) => item.id === 'notice-respond-by',
    )

    expect(clock).toBeDefined()
    expect(clock?.deadline).toBe(profile.notice?.respondBy)
  })

  it('produces no notice clock where there is no notice', () => {
    const clocks = clocksFor(profileById('clean-filing'), at('2026-08-02T10:00:00+05:30'))
    expect(clocks.find((clock) => clock.id === 'notice-respond-by')).toBeUndefined()
  })
})

describe('describeRemaining', () => {
  const clock = (daysRemaining: number, state: Clock['state'] = 'open'): Clock => ({
    id: 'x',
    label: 'x',
    deadline: '2026-08-10T00:00:00+05:30',
    state,
    daysRemaining,
    detail: '',
  })

  it('uses plain wording either side of the deadline', () => {
    expect(describeRemaining(clock(0))).toBe('today')
    expect(describeRemaining(clock(1))).toBe('tomorrow')
    expect(describeRemaining(clock(12))).toBe('in 12 days')
    expect(describeRemaining(clock(-1))).toBe('yesterday')
    expect(describeRemaining(clock(-4))).toBe('4 days ago')
    expect(describeRemaining(clock(0, 'met'))).toBe('recorded')
  })
})
