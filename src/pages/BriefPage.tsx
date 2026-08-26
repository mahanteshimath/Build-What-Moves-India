import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Printer,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import type { DocumentKind, Finding, Severity, TaxDocument } from '../domain/tax'
import { fingerprintSource, formatDateTime, formatRupees } from '../domain/tax'
import { profiles } from '../data/profiles'
import { checks, reviewProfile } from '../rules/checks'
import type { Adjustments, FindingStatus } from '../rules/simulate'
import {
  aisInterestTotal,
  applyAdjustments,
  baselineAdjustments,
  isBaseline,
  statusById,
} from '../rules/simulate'

const severityLabel: Record<Severity, string> = {
  'action-needed': 'Action needed',
  review: 'Review',
  ready: 'Ready',
}

/** Slider granularity, in paise. */
const STEP_PAISE = 100_00
const FILING_SHIFT_LIMIT_MINUTES = 2880

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

function MoneyLever({
  id,
  label,
  value,
  anchor,
  anchorLabel,
  onChange,
}: {
  id: string
  label: string
  value: number
  anchor: number
  anchorLabel: string
  onChange: (next: number) => void
}) {
  const ceiling = Math.max(anchor * 2, value * 2, 5_000_00)
  const max = Math.ceil(ceiling / STEP_PAISE) * STEP_PAISE

  return (
    <div className="lever">
      <label className="lever__label" htmlFor={id}>
        <span>{label}</span>
        <strong className="lever__value">{formatRupees(value)}</strong>
      </label>
      <input
        id={id}
        className="lever__range"
        type="range"
        min={0}
        max={max}
        step={STEP_PAISE}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        type="button"
        className="lever__snap"
        onClick={() => onChange(anchor)}
        disabled={value === anchor}
      >
        {value === anchor
          ? `Matches ${anchorLabel}`
          : `Match ${anchorLabel} — ${formatRupees(anchor)}`}
      </button>
    </div>
  )
}

function ToggleLever({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="lever lever--toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}

const statusLabel: Record<FindingStatus, string> = {
  carried: 'Unchanged by your edit',
  cleared: 'Cleared by your edit',
  raised: 'Raised by your edit',
}

function FindingCard({
  finding,
  documentLabels,
  status,
}: {
  finding: Finding
  documentLabels: Map<string, string>
  status?: FindingStatus
}) {
  return (
    <li className={`finding finding--${finding.severity}`}>
      <p className="finding__chip">
        <SeverityIcon severity={finding.severity} />
        {severityLabel[finding.severity]}
        {status === 'raised' && (
          <span className="finding__status">{statusLabel.raised}</span>
        )}
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
  const [adjustments, setAdjustments] = useState<Adjustments>(() =>
    baselineAdjustments(profiles[0]),
  )

  const profile = useMemo(
    () => profiles.find((item) => item.id === selectedId) ?? profiles[0],
    [selectedId],
  )

  const simulated = useMemo(
    () => applyAdjustments(profile, adjustments),
    [profile, adjustments],
  )
  const baseFindings = useMemo(() => reviewProfile(profile), [profile])
  const findings = useMemo(() => reviewProfile(simulated), [simulated])
  const status = useMemo(
    () => statusById(baseFindings, findings),
    [baseFindings, findings],
  )
  const cleared = useMemo(
    () => baseFindings.filter((f) => status.get(f.id) === 'cleared'),
    [baseFindings, status],
  )
  const atBaseline = isBaseline(profile, adjustments)

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

  const update = (patch: Partial<Adjustments>) =>
    setAdjustments((current) => ({ ...current, ...patch }))

  return (
    <>
      <section className="panel no-print" aria-labelledby="picker-heading">
        <h2 className="panel__heading" id="picker-heading">
          Which of these sounds like you?
        </h2>
        <nav className="picker">
          {profiles.map((item) => (
            <button
              key={item.id}
              type="button"
              className="picker__item"
              aria-pressed={item.id === profile.id}
              onClick={() => {
                setSelectedId(item.id)
                setAdjustments(baselineAdjustments(item))
              }}
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
          {cleared.length > 0 && (
            <div className="tally__item tally__item--cleared">
              <dt>Cleared by your edit</dt>
              <dd>{cleared.length}</dd>
            </div>
          )}
          <div className="tally__item tally__item--ready">
            <dt>Checks run</dt>
            <dd>{checks.length}</dd>
          </div>
        </dl>

        <p className="case__sample">
          <strong>Sample record.</strong> This brief is built from a made-up
          example so you can see how it works. It is not a real person&rsquo;s
          tax record, and it is not tax or legal advice.
        </p>
      </section>

      <section className="panel no-print" aria-labelledby="sim-heading">
        <div className="sim__head">
          <h2 className="panel__heading" id="sim-heading">
            <SlidersHorizontal aria-hidden size={18} /> Try a change
          </h2>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setAdjustments(baselineAdjustments(profile))}
            disabled={atBaseline}
          >
            <RotateCcw aria-hidden size={15} /> Back to the record
          </button>
        </div>
        <p className="panel__note">
          Move a value and the same {checks.length} checks re-run below, in this
          browser, against an edited copy. Nothing here is filed, sent or saved,
          and a cleared check only means two records now agree &mdash; it is not
          a prediction of any tax outcome.
        </p>

        <div className="levers">
          <MoneyLever
            id="lever-claimed-tds"
            label="Tax deducted claimed in the return"
            value={adjustments.claimedTdsPaise}
            anchor={profile.form26asTdsPaise}
            anchorLabel="Form 26AS"
            onChange={(claimedTdsPaise) => update({ claimedTdsPaise })}
          />

          <MoneyLever
            id="lever-interest"
            label="Interest income declared in the return"
            value={adjustments.declaredInterestPaise}
            anchor={aisInterestTotal(profile)}
            anchorLabel="AIS total"
            onChange={(declaredInterestPaise) => update({ declaredInterestPaise })}
          />

          <MoneyLever
            id="lever-refund"
            label="Refund claimed"
            value={adjustments.refundClaimedPaise}
            anchor={0}
            anchorLabel="no refund"
            onChange={(refundClaimedPaise) => update({ refundClaimedPaise })}
          />

          {profile.filedOn && (
            <div className="lever">
              <label className="lever__label" htmlFor="lever-filed">
                <span>Submission timestamp</span>
                <strong className="lever__value">
                  {formatDateTime(simulated.filedOn ?? profile.filedOn)}
                </strong>
              </label>
              <input
                id="lever-filed"
                className="lever__range"
                type="range"
                min={-FILING_SHIFT_LIMIT_MINUTES}
                max={FILING_SHIFT_LIMIT_MINUTES}
                step={15}
                value={adjustments.filedShiftMinutes}
                onChange={(event) =>
                  update({ filedShiftMinutes: Number(event.target.value) })
                }
              />
              <p className="lever__foot">
                Due date on record: {formatDateTime(profile.dueDate)}
              </p>
            </div>
          )}

          {profile.challans.length > 0 && (
            <ToggleLever
              id="lever-credited"
              label="The taxes-paid schedule lists every challan I paid"
              checked={adjustments.challansCredited}
              onChange={(challansCredited) => update({ challansCredited })}
            />
          )}

          {profile.filedOn && (
            <ToggleLever
              id="lever-everified"
              label="The return carries an e-verification date"
              checked={adjustments.everified}
              onChange={(everified) => update({ everified })}
            />
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="findings-heading">
        <h2 className="panel__heading" id="findings-heading">
          What the records show
        </h2>
        {!atBaseline && (
          <p className="sim__banner">
            <strong>Simulated copy.</strong> These findings come from an edited
            version of the sample record, not from the record as it stands.
          </p>
        )}
        <ol className="findings">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              documentLabels={documentLabels}
              status={status.get(finding.id)}
            />
          ))}
        </ol>

        {cleared.length > 0 && (
          <div className="cleared">
            <h3 className="cleared__heading">
              No longer flagged, after your edit
            </h3>
            <ul className="cleared__list">
              {cleared.map((finding) => (
                <li key={finding.id}>
                  <CheckCircle2 aria-hidden size={16} />
                  {finding.title}
                </li>
              ))}
            </ul>
          </div>
        )}
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
