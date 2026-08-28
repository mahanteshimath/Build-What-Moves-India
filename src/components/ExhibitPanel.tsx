import { useMemo, useState } from 'react'
import { Check, Copy, SendHorizontal } from 'lucide-react'
import type { Finding, TaxProfile } from '../domain/tax'
import { exhibitText } from '../rules/exhibits'
import type { ExhibitKind } from '../rules/exhibits'

const TABS: { id: ExhibitKind; label: string; note: string }[] = [
  {
    id: 'enivaran',
    label: 'Grievance note',
    note: 'A record of the differences, for a grievance or a helpdesk visit.',
  },
  {
    id: 'ais',
    label: 'AIS feedback note',
    note: 'For submitting feedback against an entry in the Annual Information Statement.',
  },
  {
    id: 'traces',
    label: 'Note for the deductor',
    note: 'For the employer or deductor who has to file the correction.',
  },
]

/** Copy-ready text of the same findings, for the places a person has to take them. */
export function ExhibitPanel({
  profile,
  findings,
  fingerprints,
}: {
  profile: TaxProfile
  findings: Finding[]
  fingerprints: Record<string, string>
}) {
  const [tab, setTab] = useState<ExhibitKind>('enivaran')
  const [copied, setCopied] = useState(false)

  const text = useMemo(
    () => exhibitText(tab, profile, findings, fingerprints, new Date().toISOString()),
    [tab, profile, findings, fingerprints],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard permission refused; the text stays selectable below.
    }
  }

  const active = TABS.find((item) => item.id === tab)

  return (
    <div className="exhibit no-print">
      <div className="panel__header-row">
        <div>
          <h3 className="panel__heading">
            <SendHorizontal aria-hidden size={18} /> Take this somewhere
          </h3>
          <p className="panel__note">{active?.note}</p>
        </div>
        <button type="button" className="button button--quiet button--sm" onClick={copy}>
          {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
          <span>{copied ? 'Copied' : 'Copy this text'}</span>
        </button>
      </div>

      <div className="exhibit__tabs" role="tablist" aria-label="Exhibit format">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`exhibit__tab ${tab === item.id ? 'exhibit__tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <pre className="exhibit__text" aria-label="Copy-ready text">
        {text}
      </pre>
    </div>
  )
}
