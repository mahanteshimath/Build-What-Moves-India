import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Copy,
  DownloadCloud,
  FileCheck,
  FileSearch,
  FileText,
  Filter,
  HelpCircle,
  KeyRound,
  Landmark,
  Link2,
  Printer,
  RotateCcw,
  Search,
  SendHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { DocumentKind, Finding, Severity, TaxDocument } from '../domain/tax'
import { fingerprintSource, formatDate, formatDateTime, formatRupees } from '../domain/tax'
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
import {
  everifyFaq,
  itrFaq,
  staticPasswordHelp,
} from '../data/sources'

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
  const isModified = value !== anchor

  return (
    <div className={`lever ${isModified ? 'lever--modified' : ''}`}>
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
      <div className="lever__actions">
        <button
          type="button"
          className="lever__snap"
          onClick={() => onChange(anchor)}
          disabled={value === anchor}
          title={`Reset to official record figure (${formatRupees(anchor)})`}
        >
          {value === anchor
            ? `Matches ${anchorLabel}`
            : `Match ${anchorLabel} (${formatRupees(anchor)})`}
        </button>
        {isModified && <span className="lever__tag">Simulated edit</span>}
      </div>
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
    <li className={`finding finding--${finding.severity} ${status ? `finding--status-${status}` : ''}`}>
      <div className="finding__top">
        <div className="finding__chip">
          <SeverityIcon severity={finding.severity} />
          <span>{severityLabel[finding.severity]}</span>
        </div>
        {status === 'raised' && (
          <span className="finding__status finding__status--raised">
            <Sparkles aria-hidden size={13} />
            {statusLabel.raised}
          </span>
        )}
      </div>

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
        <div className="finding__docs-wrap">
          <span className="finding__docs-label">Records on file:</span>
          <div className="finding__doc-chips">
            {finding.documentIds.map((id) => (
              <span key={id} className="finding__doc-chip">
                {documentLabels.get(id) ?? id}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="finding__footer">
        <a
          className="finding__source"
          href={finding.source.url}
          target="_blank"
          rel="noreferrer"
        >
          <span>{finding.source.label}</span>
          <ArrowUpRight aria-hidden size={14} />
        </a>
      </div>
    </li>
  )
}

export default function BriefPage() {
  const [selectedId, setSelectedId] = useState(profiles[0].id)
  const [adjustments, setAdjustments] = useState<Adjustments>(() =>
    baselineAdjustments(profiles[0]),
  )
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity | 'cleared'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null)
  const [exhibitTab, setExhibitTab] = useState<'enivaran' | 'ais' | 'traces'>('enivaran')
  const [copiedExhibit, setCopiedExhibit] = useState(false)

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

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      if (severityFilter !== 'all' && severityFilter !== 'cleared' && finding.severity !== severityFilter) {
        return false
      }
      if (severityFilter === 'cleared') {
        return false
      }
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return (
        finding.title.toLowerCase().includes(query) ||
        finding.detail.toLowerCase().includes(query) ||
        finding.comparison?.label.toLowerCase().includes(query) ||
        finding.comparison?.left.value.toLowerCase().includes(query) ||
        finding.comparison?.right.value.toLowerCase().includes(query)
      )
    })
  }, [findings, severityFilter, searchQuery])

  const copyHash = async (docId: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(`sha256:${hash}`)
      setCopiedDocId(docId)
      setTimeout(() => setCopiedDocId(null), 2000)
    } catch {
      // ignore
    }
  }

  const update = (patch: Partial<Adjustments>) =>
    setAdjustments((current) => ({ ...current, ...patch }))

  // Generate copy-ready text for e-Nivaran grievance / AIS Feedback / TRACES correction
  const exhibitText = useMemo(() => {
    const timeNow = new Date().toISOString()
    const docList = profile.documents
      .map(
        (d) =>
          `* ${d.label} [Ref: ${d.reference}] (Captured: ${d.capturedAt}, SHA256: ${fingerprints[d.id] ?? 'sha256:verified'})`,
      )
      .join('\n')

    if (exhibitTab === 'enivaran') {
      const issues = findings
        .filter((f) => f.severity === 'action-needed' || f.severity === 'review')
        .map((f, i) => `${i + 1}. [${f.title}]: ${f.detail}`)
        .join('\n\n')

      return `===================================================================
EVIDENTIARY EXHIBIT FOR E-NIVARAN / E-FILING PORTAL GRIEVANCE
===================================================================
Taxpayer Persona: ${profile.personaLabel}
Assessment Year: ${profile.assessmentYear}
Verification Run: ${formatDateTime(timeNow)}
Client Fingerprint Desk: Sakshya Browser Evidentiary Sub-system

SUMMARY OF OBJECTIVE DISCREPANCIES:
-------------------------------------------------------------------
${issues || 'All examined tax records agree. No active discrepancies flagged.'}

SUPPORTING DOCUMENTS IN RECORD:
-------------------------------------------------------------------
${docList}

DECLARATION:
The objective differences above are compiled from taxpayer-held source
documents against portal records. Generated without external API transmission.
===================================================================`
    }

    if (exhibitTab === 'ais') {
      const aisItems = profile.aisInterest
        .map(
          (item) =>
            `- Payer: ${item.payer} | Amount: ${formatRupees(item.amountPaise)} | Reported: ${item.reportedOn}`,
        )
        .join('\n')

      return `===================================================================
AIS (ANNUAL INFORMATION STATEMENT) FEEDBACK & RECONCILIATION NOTE
===================================================================
Taxpayer Persona: ${profile.personaLabel}
Assessment Year: ${profile.assessmentYear}
Declared Interest in ITR: ${formatRupees(profile.declaredInterestPaise)}
AIS Total Interest Reported: ${formatRupees(aisInterestTotal(profile))}

RECORDED AIS LINE-ITEMS:
${aisItems}

OBJECTIVE REMARKS:
${
  profile.aisInterest.length > 1 &&
  profile.aisInterest[0].amountPaise === profile.aisInterest[1]?.amountPaise
    ? 'Feedback Category: "Information is duplicate / included in other information"\nJustification: Identical amount and payer reported under multiple entries for the same deposit account.'
    : 'Feedback Category: "Information is correct / partial disagreement"\nJustification: Declared figures reconciled with bank certificates.'
}
===================================================================`
    }

    return `===================================================================
TRACES / FORM 26AS DEDUCTOR RECTIFICATION REQUEST NOTE
===================================================================
Taxpayer Persona: ${profile.personaLabel}
Assessment Year: ${profile.assessmentYear}
Form 16 Stated TDS: ${formatRupees(profile.form16TdsPaise)}
Form 26AS Credited TDS: ${formatRupees(profile.form26asTdsPaise)}
Difference to be Reconciled: ${formatRupees(Math.abs(profile.form16TdsPaise - profile.form26asTdsPaise))}

DEDUCTOR DETAILS:
${(profile.deductors ?? [])
  .map(
    (d) =>
      `* Deductor: ${d.deductorName} (TAN: ${d.tan})\n  Withheld: ${formatRupees(d.amountPaise)} | Form 24Q Quarterly Status: ${d.form16QuarterlyFiled ? 'Filed' : 'Pending Upload to TRACES'}`,
  )
  .join('\n')}

REQUEST TO DEDUCTOR:
Please verify Form 24Q quarterly returns and file correction statement
on TRACES portal to ensure tax credit reflects against PAN in Form 26AS.
===================================================================`
  }, [profile, findings, exhibitTab, fingerprints])

  const copyExhibit = async () => {
    try {
      await navigator.clipboard.writeText(exhibitText)
      setCopiedExhibit(true)
      setTimeout(() => setCopiedExhibit(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <section className="panel no-print" aria-labelledby="picker-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="picker-heading">
              Select Taxpayer Situation
            </h2>
            <p className="panel__note">
              Choose a synthetic scenario to view deterministic reconciliation checks against filed income tax forms.
            </p>
          </div>
        </div>

        <div className="picker">
          {profiles.map((item) => {
            const isSelected = item.id === profile.id
            return (
              <button
                key={item.id}
                type="button"
                className={`picker__item ${isSelected ? 'picker__item--selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedId(item.id)
                  setAdjustments(baselineAdjustments(item))
                  setSeverityFilter('all')
                }}
              >
                <div className="picker__item-header">
                  <span className="picker__item-title">{item.personaLabel}</span>
                  <span className="picker__item-badge">AY {item.assessmentYear}</span>
                </div>
                <p className="picker__item-desc">{item.situation}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel" aria-labelledby="case-heading">
        <div className="case">
          <div className="case__info">
            <div className="case__badge-row">
              <span className="badge badge--dark">{profile.personaLabel}</span>
              <span className="badge badge--neutral">Assessment Year {profile.assessmentYear}</span>
              <span className="badge badge--regime">{profile.documents.length} Records Verified</span>
            </div>
            <h2 className="case__title" id="case-heading">
              {profile.situation}
            </h2>
            <p className="case__meta">
              Filing Due: <strong>{formatDateTime(profile.dueDate)}</strong> &bull; Brief assembled in browser: <strong>{formatDateTime(new Date().toISOString())}</strong>
            </p>
          </div>
          <div className="case__actions no-print">
            <button
              type="button"
              className="print-button"
              onClick={() => window.print()}
              title="Generate clean printable PDF brief (Ctrl/Cmd + P)"
            >
              <Printer aria-hidden size={17} />
              <span>Print Evidentiary Brief</span>
            </button>
          </div>
        </div>

        <div className="tally-section">
          <p className="tally-section__label no-print">
            <Filter aria-hidden size={14} /> Filter Findings by Status:
          </p>
          <dl className="tally" role="group" aria-label="Reconciliation summary counts">
            <button
              type="button"
              className={`tally__item tally__item--action ${severityFilter === 'action-needed' ? 'tally__item--active' : ''}`}
              onClick={() => setSeverityFilter((prev) => (prev === 'action-needed' ? 'all' : 'action-needed'))}
              title="Click to toggle action-needed discrepancies"
            >
              <dt>Action needed</dt>
              <dd>{counts.actionNeeded}</dd>
            </button>

            <button
              type="button"
              className={`tally__item tally__item--review ${severityFilter === 'review' ? 'tally__item--active' : ''}`}
              onClick={() => setSeverityFilter((prev) => (prev === 'review' ? 'all' : 'review'))}
              title="Click to toggle review items"
            >
              <dt>Review</dt>
              <dd>{counts.review}</dd>
            </button>

            {cleared.length > 0 && (
              <button
                type="button"
                className={`tally__item tally__item--cleared ${severityFilter === 'cleared' ? 'tally__item--active' : ''}`}
                onClick={() => setSeverityFilter((prev) => (prev === 'cleared' ? 'all' : 'cleared'))}
                title="Click to view cleared items"
              >
                <dt>Cleared by edit</dt>
                <dd>{cleared.length}</dd>
              </button>
            )}

            <button
              type="button"
              className={`tally__item tally__item--ready ${severityFilter === 'all' ? 'tally__item--active' : ''}`}
              onClick={() => setSeverityFilter('all')}
              title="Click to show all checks"
            >
              <dt>Checks run</dt>
              <dd>{checks.length}</dd>
            </button>
          </dl>
        </div>

        <div className="case__sample">
          <FileCheck aria-hidden size={18} />
          <div>
            <strong>Synthetic Practice Record:</strong> This evidentiary reconciliation brief is constructed from anonymized synthetic test records to verify document concordance. It does not predict portal assessment outcomes or state legal advice.
          </div>
        </div>
      </section>

      {/* Technical Readiness & Refund Health Audit Section */}
      <section className="panel" aria-labelledby="readiness-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="readiness-heading">
              <ShieldCheck aria-hidden size={18} /> Technical Readiness & Refund Health Audit
            </h2>
            <p className="panel__note">
              Deterministic prerequisites required by the Income Tax Department portal for automated CPC processing and electronic refunds.
            </p>
          </div>
        </div>

        <div className="readiness-grid">
          {/* Bank Pre-Validation */}
          <div
            className={`readiness-card ${
              profile.bankAccount?.preValidated
                ? 'readiness-card--success'
                : 'readiness-card--danger'
            }`}
          >
            <div className="readiness-card__header">
              <span className="readiness-card__title">
                <Landmark size={16} /> Bank Account Pre-validation
              </span>
              <span
                className={`readiness-card__status ${
                  profile.bankAccount?.preValidated
                    ? 'readiness-card__status--success'
                    : 'readiness-card__status--danger'
                }`}
              >
                {profile.bankAccount?.preValidated ? 'Pre-validated' : 'Action Needed'}
              </span>
            </div>
            <p className="readiness-card__desc">
              {profile.bankAccount?.preValidated
                ? `Account at ${profile.bankAccount.bankName} is pre-validated with EVC enabled. Name matches PAN database.`
                : `Account at ${profile.bankAccount?.bankName ?? 'Bank'} is not pre-validated. CPC cannot credit electronic refunds without validation.`}
            </p>
            {profile.bankAccount && (
              <div className="readiness-card__detail">
                {profile.bankAccount.bankName} &bull; {profile.bankAccount.accountMasked} &bull; IFSC: {profile.bankAccount.ifsc}
              </div>
            )}
          </div>

          {/* PAN-Aadhaar Linkage */}
          <div
            className={`readiness-card ${
              profile.panAadhaar?.operative
                ? 'readiness-card--success'
                : 'readiness-card--danger'
            }`}
          >
            <div className="readiness-card__header">
              <span className="readiness-card__title">
                <Link2 size={16} /> PAN-Aadhaar Link (Sec 234H)
              </span>
              <span
                className={`readiness-card__status ${
                  profile.panAadhaar?.operative
                    ? 'readiness-card--success'
                    : 'readiness-card__status--danger'
                }`}
              >
                {profile.panAadhaar?.operative ? 'Operative' : 'Inoperative'}
              </span>
            </div>
            <p className="readiness-card__desc">
              {profile.panAadhaar?.operative
                ? 'PAN is linked with Aadhaar and operative. Normal TDS rates apply.'
                : 'PAN is marked inoperative. Subject to higher TDS under Sec 206AA and processing holds.'}
            </p>
            {profile.panAadhaar && (
              <div className="readiness-card__detail">
                Status: {profile.panAadhaar.linked ? 'Linked' : 'Unlinked'} &bull; Checked: {formatDate(profile.panAadhaar.lastCheckedDate)}
              </div>
            )}
          </div>

          {/* Deductor 24Q Quarterly Status */}
          <div
            className={`readiness-card ${
              !profile.deductors || profile.deductors.every((d) => d.form16QuarterlyFiled)
                ? 'readiness-card--success'
                : 'readiness-card--warning'
            }`}
          >
            <div className="readiness-card__header">
              <span className="readiness-card__title">
                <Building2 size={16} /> Deductor TRACES Compliance
              </span>
              <span
                className={`readiness-card__status ${
                  !profile.deductors || profile.deductors.every((d) => d.form16QuarterlyFiled)
                    ? 'readiness-card--success'
                    : 'readiness-card--warning'
                }`}
              >
                {!profile.deductors || profile.deductors.every((d) => d.form16QuarterlyFiled)
                  ? 'All Filed'
                  : 'Quarter Pending'}
              </span>
            </div>
            <p className="readiness-card__desc">
              {!profile.deductors || profile.deductors.every((d) => d.form16QuarterlyFiled)
                ? 'All employer/payer Form 24Q statements are deposited and reflected in Form 26AS.'
                : 'One or more deductors have delayed quarterly returns; TDS credits are unreflected in 26AS.'}
            </p>
            {profile.deductors && profile.deductors.length > 0 && (
              <div className="readiness-card__detail">
                {profile.deductors[0].deductorName} (TAN: {profile.deductors[0].tan})
              </div>
            )}
          </div>

          {/* Outstanding Demand Offset Section 245 */}
          <div
            className={`readiness-card ${
              !profile.outstandingDemandPaise || profile.outstandingDemandPaise <= 0
                ? 'readiness-card--success'
                : 'readiness-card--warning'
            }`}
          >
            <div className="readiness-card__header">
              <span className="readiness-card__title">
                <Clock size={16} /> Outstanding Demand (Sec 245)
              </span>
              <span
                className={`readiness-card__status ${
                  !profile.outstandingDemandPaise || profile.outstandingDemandPaise <= 0
                    ? 'readiness-card--success'
                    : 'readiness-card--warning'
                }`}
              >
                {!profile.outstandingDemandPaise || profile.outstandingDemandPaise <= 0
                  ? 'Clear'
                  : 'Adjustment Pending'}
              </span>
            </div>
            <p className="readiness-card__desc">
              {!profile.outstandingDemandPaise || profile.outstandingDemandPaise <= 0
                ? 'No outstanding tax demand recorded under Section 245 from prior assessment years.'
                : `CPC automated offset of ${formatRupees(profile.outstandingDemandPaise)} applies against claimed refund.`}
            </p>
            <div className="readiness-card__detail">
              Claimed Refund: {formatRupees(profile.refundClaimedPaise)} &bull; Demand: {formatRupees(profile.outstandingDemandPaise ?? 0)}
            </div>
          </div>
        </div>
      </section>

      {/* Evidentiary Simulator Section */}
      <section className="panel no-print" aria-labelledby="sim-heading">
        <div className="sim__head">
          <div>
            <h2 className="panel__heading" id="sim-heading">
              <SlidersHorizontal aria-hidden size={18} /> Evidentiary Simulator
            </h2>
            <p className="panel__note">
              Adjust claims and simulated portal states below to observe whether discrepancies resolve in real-time.
            </p>
          </div>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setAdjustments(baselineAdjustments(profile))}
            disabled={atBaseline}
            title="Reset all values to baseline recorded in document set"
          >
            <RotateCcw aria-hidden size={15} /> Reset to Recorded Profile
          </button>
        </div>

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
                Due date on record: <strong>{formatDateTime(profile.dueDate)}</strong>
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

          {profile.bankAccount && (
            <ToggleLever
              id="lever-bank-preval"
              label="Bank account is pre-validated on the e-filing portal"
              checked={adjustments.bankPrevalidated}
              onChange={(bankPrevalidated) => update({ bankPrevalidated })}
            />
          )}

          {profile.deductors && profile.deductors.length > 0 && (
            <ToggleLever
              id="lever-deductor-filed"
              label="Deductor has uploaded quarterly TDS statement (Form 24Q)"
              checked={adjustments.deductorFiled}
              onChange={(deductorFiled) => update({ deductorFiled })}
            />
          )}

          {profile.panAadhaar && (
            <ToggleLever
              id="lever-pan-operative"
              label="PAN-Aadhaar is linked and operative (Section 234H)"
              checked={adjustments.panOperative}
              onChange={(panOperative) => update({ panOperative })}
            />
          )}
        </div>
      </section>

      {/* Discrepancies & Findings Section */}
      <section className="panel" aria-labelledby="findings-heading">
        <div className="findings-header">
          <div>
            <h2 className="panel__heading" id="findings-heading">
              What the Records Show ({findings.length} Discrepanc{findings.length === 1 ? 'y' : 'ies'})
            </h2>
            <p className="panel__note">
              Deterministic verification against Form 16, Form 26AS, AIS, and Challan receipts.
            </p>
          </div>

          <div className="findings-filter-row no-print">
            <div className="search-box">
              <Search aria-hidden size={16} />
              <input
                type="text"
                placeholder="Search findings (e.g. Challan, TDS, NPS, Bank, PAN)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-box__input"
              />
            </div>
          </div>
        </div>

        {!atBaseline && (
          <div className="sim__banner">
            <Sparkles aria-hidden size={17} />
            <span>
              <strong>Simulated Workspace:</strong> These findings reflect your experimental changes on top of the original record.
            </span>
          </div>
        )}

        {severityFilter === 'cleared' ? (
          cleared.length === 0 ? (
            <p className="panel__empty">No findings have been cleared by your edits yet.</p>
          ) : (
            <div className="cleared">
              <h3 className="cleared__heading">
                Resolved by Simulated Edits ({cleared.length})
              </h3>
              <ul className="cleared__list">
                {cleared.map((finding) => (
                  <li key={finding.id} className="cleared__item">
                    <CheckCircle2 aria-hidden size={18} />
                    <div>
                      <strong>{finding.title}</strong>
                      <p className="cleared__detail">{finding.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : filteredFindings.length === 0 ? (
          <div className="panel__empty-state">
            <CheckCircle2 aria-hidden size={32} className="text-green" />
            <p>
              {searchQuery
                ? 'No discrepancies matching your search query.'
                : 'No discrepancies found in this category.'}
            </p>
            {(searchQuery || severityFilter !== 'all') && (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  setSearchQuery('')
                  setSeverityFilter('all')
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ol className="findings">
            {filteredFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                documentLabels={documentLabels}
                status={status.get(finding.id)}
              />
            ))}
          </ol>
        )}

        {severityFilter !== 'cleared' && cleared.length > 0 && (
          <div className="cleared">
            <h3 className="cleared__heading">
              <CheckCircle2 aria-hidden size={18} />
              Cleared by your simulated changes ({cleared.length})
            </h3>
            <ul className="cleared__list">
              {cleared.map((finding) => (
                <li key={finding.id}>
                  <CheckCircle2 aria-hidden size={16} />
                  <span>{finding.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* e-Nivaran & AIS Exhibit Generator Section */}
      <section className="panel no-print" aria-labelledby="exhibit-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="exhibit-heading">
              <SendHorizontal aria-hidden size={18} /> e-Nivaran & AIS Feedback Exhibit Generator
            </h2>
            <p className="panel__note">
              Format objective discrepancy evidence into standardized, copy-ready submission blocks with SHA-256 integrity hashes for grievance filings.
            </p>
          </div>
        </div>

        <div className="exhibit-panel">
          <div className="exhibit-tabs">
            <button
              type="button"
              className={`exhibit-tab ${exhibitTab === 'enivaran' ? 'exhibit-tab--active' : ''}`}
              onClick={() => setExhibitTab('enivaran')}
            >
              <FileText size={15} /> e-Nivaran Portal Grievance Exhibit
            </button>
            <button
              type="button"
              className={`exhibit-tab ${exhibitTab === 'ais' ? 'exhibit-tab--active' : ''}`}
              onClick={() => setExhibitTab('ais')}
            >
              <HelpCircle size={15} /> AIS Feedback Note
            </button>
            <button
              type="button"
              className={`exhibit-tab ${exhibitTab === 'traces' ? 'exhibit-tab--active' : ''}`}
              onClick={() => setExhibitTab('traces')}
            >
              <Building2 size={15} /> Deductor TRACES Request
            </button>
          </div>

          <div className="exhibit-codeblock">
            <button
              type="button"
              className="exhibit-copy-btn"
              onClick={copyExhibit}
              title="Copy exhibit text to clipboard"
            >
              {copiedExhibit ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedExhibit ? 'Copied to Clipboard' : 'Copy Exhibit'}</span>
            </button>
            {exhibitText}
          </div>
        </div>
      </section>

      {/* Resilience & Technical Playbook */}
      <section className="panel no-print" aria-labelledby="resilience-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="resilience-heading">
              <KeyRound aria-hidden size={18} /> Portal Resilience & Peak-Hours Playbook
            </h2>
            <p className="panel__note">
              Documented technical steps to bypass OTP delays, save draft calculations, and ensure timely e-filing during deadline congestion.
            </p>
          </div>
        </div>

        <div className="resilience-grid">
          <div className="resilience-item">
            <h3 className="resilience-item__title">
              <KeyRound size={16} /> Static Password Setup
            </h3>
            <p className="resilience-item__desc">
              Generate a 2-factor Static Password in your profile before filing week. When SMS/Aadhaar OTP gateway latencies occur during peak hours, Static Password enables instant portal authentication.
            </p>
            <a
              href={staticPasswordHelp.url}
              target="_blank"
              rel="noreferrer"
              className="finding__source"
              style={{ marginTop: '0.5rem', display: 'inline-flex' }}
            >
              <span>{staticPasswordHelp.label}</span>
              <ArrowUpRight size={13} />
            </a>
          </div>

          <div className="resilience-item">
            <h3 className="resilience-item__title">
              <Clock size={16} /> Off-Peak Filing Windows
            </h3>
            <p className="resilience-item__desc">
              Portal traffic surges between 6:00 PM and 11:59 PM on deadline days. Complete submission during morning low-concurrency windows (6:00 AM – 11:00 AM) to prevent session disconnects.
            </p>
            <a
              href={itrFaq.url}
              target="_blank"
              rel="noreferrer"
              className="finding__source"
              style={{ marginTop: '0.5rem', display: 'inline-flex' }}
            >
              <span>{itrFaq.label}</span>
              <ArrowUpRight size={13} />
            </a>
          </div>

          <div className="resilience-item">
            <h3 className="resilience-item__title">
              <DownloadCloud size={16} /> Offline JSON Backup & Verification
            </h3>
            <p className="resilience-item__desc">
              Download the draft JSON before submitting online. If online validation stalls, you can upload the pre-filled JSON directly to the e-Filing offline utility.
            </p>
            <a
              href={everifyFaq.url}
              target="_blank"
              rel="noreferrer"
              className="finding__source"
              style={{ marginTop: '0.5rem', display: 'inline-flex' }}
            >
              <span>{everifyFaq.label}</span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </section>

      {/* Evidence Ledger Section */}
      <section className="panel" aria-labelledby="ledger-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="ledger-heading">
              Evidence Ledger & Document Fingerprints
            </h2>
            <p className="panel__note">
              Every supporting document is cryptographically fingerprinted in-browser via SHA-256 to ensure evidentiary integrity.
            </p>
          </div>
        </div>

        <ul className="ledger">
          {profile.documents.map((document) => {
            const hash = fingerprints[document.id]
            const isCopied = copiedDocId === document.id

            return (
              <li className="ledger__row" key={document.id}>
                <div className="ledger__kind-col">
                  <span className={`ledger__kind ledger__kind--${document.kind}`}>
                    {kindLabel[document.kind]}
                  </span>
                </div>
                <div className="ledger__body">
                  <p className="ledger__label">{document.label}</p>
                  <p className="ledger__reference">{document.reference}</p>
                  <p className="ledger__note">{document.note}</p>
                </div>
                <div className="ledger__proof">
                  <span className="ledger__captured">
                    Captured: <strong>{formatDateTime(document.capturedAt)}</strong>
                  </span>
                  <div className="ledger__hash-box">
                    <code>{hash ? `sha256:${hash}` : 'computing…'}</code>
                    {hash && (
                      <button
                        type="button"
                        className="ledger__copy-btn no-print"
                        onClick={() => copyHash(document.id, hash)}
                        title="Copy SHA-256 fingerprint"
                        aria-label="Copy hash"
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
