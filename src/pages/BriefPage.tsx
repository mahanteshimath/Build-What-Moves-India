import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DownloadCloud,
  FileCheck,
  Filter,
  KeyRound,
  Landmark,
  Link2,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { Severity } from '../domain/tax'
import { formatDate, formatDateTime, formatRupees } from '../domain/tax'
import { FindingCard } from '../components/FindingCard'
import { ExhibitPanel } from '../components/ExhibitPanel'
import { ClockStrip } from '../components/ClockStrip'
import { LedgerDownload } from '../components/LedgerDownload'
import { kindLabel } from '../components/findingLabels'
import { useFingerprints } from '../components/useFingerprints'
import { profiles } from '../data/profiles'
import { checks, reviewProfile } from '../rules/checks'
import type { Adjustments } from '../rules/simulate'
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

/** Slider granularity, in paise. */
const STEP_PAISE = 100_00
const FILING_SHIFT_LIMIT_MINUTES = 2880

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

export default function BriefPage() {
  const [selectedId, setSelectedId] = useState(profiles[0].id)
  const [adjustments, setAdjustments] = useState<Adjustments>(() =>
    baselineAdjustments(profiles[0]),
  )
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity | 'cleared'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null)

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
                  <span className="picker__item-badge">{item.assessmentYear}</span>
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
              <span className="badge badge--neutral">{profile.assessmentYear}</span>
              <span className="badge badge--regime">{profile.documents.length} Records Verified</span>
            </div>
            <h2 className="case__title" id="case-heading">
              {profile.situation}
            </h2>
            <p className="case__meta">
              Filing Due: <strong>{formatDateTime(profile.dueDate)}</strong> &bull; Brief assembled in browser: <strong>{formatDateTime(new Date().toISOString())}</strong>
            </p>
            <ClockStrip profile={profile} />
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

      {/* Copy-ready text of the same findings, shared with the own-figures page. */}
      <section className="panel no-print" aria-labelledby="exhibit-heading">
        <div id="exhibit-heading" className="visually-hidden">
          Copy-ready text
        </div>
        <ExhibitPanel
          profile={profile}
          findings={findings}
          fingerprints={fingerprints}
        />
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
            <LedgerDownload profile={profile} fingerprints={fingerprints} />
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
