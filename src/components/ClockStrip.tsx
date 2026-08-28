import { CalendarClock } from 'lucide-react'
import type { TaxProfile } from '../domain/tax'
import { formatDate } from '../domain/tax'
import { clocksFor, describeRemaining } from '../rules/clocks'

/** Dated obligations already recorded on the profile, with the plain time left. */
export function ClockStrip({ profile }: { profile: TaxProfile }) {
  const clocks = clocksFor(profile)
  if (clocks.length === 0) return null

  return (
    <div className="clocks">
      <p className="clocks__label">
        <CalendarClock aria-hidden size={14} />
        <span>Dates recorded on these documents</span>
      </p>
      <ul className="clocks__list">
        {clocks.map((clock) => (
          <li key={clock.id} className={`clock clock--${clock.state}`}>
            <span className="clock__label">{clock.label}</span>
            <span className="clock__date">{formatDate(clock.deadline)}</span>
            <span className="clock__remaining">{describeRemaining(clock)}</span>
            <span className="clock__detail">{clock.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
