import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Printer,
} from 'lucide-react'
import type { DocumentKind, Finding, Severity, TaxDocument } from '../domain/tax'
import { fingerprintSource, formatDateTime } from '../domain/tax'
import { profiles } from '../data/profiles'
import { checks, reviewProfile } from '../rules/checks'

const severityLabel: Record<Severity, string> = {
  'action-needed': 'Action needed',
  review: 'Review',
  ready: 'Ready',
}

const kindLabel: Record<DocumentKind, string> = {
  'form-16': 'Form 16',
  'form-26as': 'Form 26AS',
  ais: 'AIS',
  challan: 'Challan',
  return: 'Return',
  notice: 'Notice',
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === 'action-needed') return <CircleAlert aria-hidden size={18} />
  if (severity === 'review') return <FileSearch aria-hidden size={18} />
  return <CheckCircle2 aria-hidden size={18} />
}

/** Hashes each record in the browser so the ledger shows a real fingerprint. */
function useFingerprints(documents: TaxDocument[]): Record<string, string> {
  const [prints, setPrints] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const encoder = new TextEncoder()

    Promise.all(
      documents.map(async (document) => {
        const digest = await crypto.subtle.digest(
          'SHA-256',
          encoder.encode(fingerprintSource(document)),
        )
        const hex = [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        return [document.id, hex.slice(0, 16)] as const
      }),
    ).then((entries) => {
      if (!cancelled) setPrints(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [documents])

  return prints
}

function FindingCard({
  finding,
  documentLabels,
}: {
  finding: Finding
  documentLabels: Map<string, string>
}) {
  return (
    <li className={`finding finding--${finding.severity}`}>
      <p className="finding__chip">
        <SeverityIcon severity={finding.severity} />
        {severityLabel[finding.severity]}
      </p>
      <h3 className="finding__title">{finding.title}</h3>
      <p className="finding__detail">{finding.detail}</p>

      {finding.comparison && (
        <div className="compare">
          <p className="compare__label">{finding.comparison.label}</p>
          <div className="compare__pair">
            <div className="compare__cell">
              <span className="compare__source">
                {finding.comparison.left.source}
              </span>
              <strong className="compare__value">
                {finding.comparison.left.value}
              </strong>
            </div>
            <div className="compare__cell">
              <span className="compare__source">
                {finding.comparison.right.source}
              </span>
              <strong className="compare__value">
                {finding.comparison.right.value}
              </strong>
            </div>
          </div>
        </div>
      )}

      {finding.documentIds.length > 0 && (
        <p className="finding__docs">
          Records used:{' '}
          {finding.documentIds
            .map((id) => documentLabels.get(id) ?? id)
            .join(' · ')}
        </p>
      )}

      <a
        className="finding__source"
        href={finding.source.url}
        target="_blank"
        rel="noreferrer"
      >
        {finding.source.label}
        <ArrowUpRight aria-hidden size={15} />
      </a>
    </li>
  )
}

export default function BriefPage() {
  const [selectedId, setSelectedId] = useState(profiles[0].id)

  const profile = useMemo(
    () => profiles.find((item) => item.id === selectedId) ?? profiles[0],
    [selectedId],
  )
  const findings = useMemo(() => reviewProfile(profile), [profile])
  const fingerprints = useFingerprints(profile.documents)

  const documentLabels = useMemo(
    () => new Map(profile.documents.map((doc) => [doc.id, doc.label])),
    [profile],
  )

  const counts = useMemo(
    () => ({
      actionNeeded: findings.filter((f) => f.severity === 'action-needed').length,
      review: findings.filter((f) => f.severity === 'review').length,
    }),
    [findings],
  )

  return (
    <>
      <section className="panel no-print" aria-labelledby="picker-heading">
        <h2 className="panel__heading" id="picker-heading">
          Choose a situation
        </h2>
        <nav className="picker">
          {profiles.map((item) => (
            <button
              key={item.id}
              type="button"
              className="picker__item"
              aria-pressed={item.id === profile.id}
              onClick={() => setSelectedId(item.id)}
            >
              {item.personaLabel}
            </button>
          ))}
        </nav>
      </section>

      <section className="panel" aria-labelledby="case-heading">
        <div className="case">
          <div>
            <h2 className="panel__heading" id="case-heading">
              {profile.personaLabel}
            </h2>
            <p className="case__situation">{profile.situation}</p>
            <p className="case__meta">
              {profile.assessmentYear} · brief generated{' '}
              {formatDateTime(new Date().toISOString())}
            </p>
          </div>
          <button
            type="button"
            className="print-button no-print"
            onClick={() => window.print()}
          >
            <Printer aria-hidden size={17} />
            Print this brief
          </button>
        </div>

        <dl className="tally">
          <div className="tally__item tally__item--action">
            <dt>Action needed</dt>
            <dd>{counts.actionNeeded}</dd>
          </div>
          <div className="tally__item tally__item--review">
            <dt>Review</dt>
            <dd>{counts.review}</dd>
          </div>
          <div className="tally__item tally__item--ready">
            <dt>Checks run</dt>
            <dd>{checks.length}</dd>
          </div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="findings-heading">
        <h2 className="panel__heading" id="findings-heading">
          What the records show
        </h2>
        <ol className="findings">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              documentLabels={documentLabels}
            />
          ))}
        </ol>
      </section>

      <section className="panel" aria-labelledby="ledger-heading">
        <h2 className="panel__heading" id="ledger-heading">
          Evidence ledger
        </h2>
        <p className="panel__note">
          Each record is fingerprinted with SHA-256 in this browser, so the copy
          you hold can be shown to be the copy you captured.
        </p>
        <ul className="ledger">
          {profile.documents.map((document) => (
            <li className="ledger__row" key={document.id}>
              <span className="ledger__kind">{kindLabel[document.kind]}</span>
              <div className="ledger__body">
                <p className="ledger__label">{document.label}</p>
                <p className="ledger__reference">{document.reference}</p>
                <p className="ledger__note">{document.note}</p>
              </div>
              <div className="ledger__proof">
                <span>Captured {formatDateTime(document.capturedAt)}</span>
                <code>
                  {fingerprints[document.id]
                    ? `sha256:${fingerprints[document.id]}`
                    : 'fingerprinting…'}
                </code>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
