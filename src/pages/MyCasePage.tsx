import { useMemo, useState } from 'react'
import { Eraser, Plus, Printer, ShieldCheck, Trash2 } from 'lucide-react'
import { FindingCard } from '../components/FindingCard'
import { ClockStrip } from '../components/ClockStrip'
import { ExhibitPanel } from '../components/ExhibitPanel'
import { LedgerDownload } from '../components/LedgerDownload'
import { kindLabel } from '../components/findingLabels'
import { useFingerprints } from '../components/useFingerprints'
import { formatDateTime } from '../domain/tax'
import type { ChallanKind, SpecialRateSection } from '../domain/tax'
import { checks, reviewProfile } from '../rules/checks'
import {
  DUE_DATE_OPTIONS,
  buildOwnProfile,
  emptyOwnCase,
  hasAnyFigures,
} from '../rules/ownCase'
import type { OwnCaseInput } from '../rules/ownCase'
import '../own-case.css'

const SPECIAL_RATE_SECTIONS: { value: SpecialRateSection; label: string }[] = [
  { value: '111A', label: '111A — short-term capital gains' },
  { value: '112A', label: '112A — long-term capital gains on listed equity' },
  { value: '112', label: '112 — other long-term capital gains' },
  { value: '115BBH', label: '115BBH — virtual digital assets' },
]

/** `datetime-local` wants wall-clock text, not an ISO instant. */
function localNow(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="own-field">
      <span className="own-field__label">{label}</span>
      {children}
      {hint && <span className="own-field__hint">{hint}</span>}
    </label>
  )
}

export default function MyCasePage() {
  const [input, setInput] = useState<OwnCaseInput>(() => ({
    ...emptyOwnCase(),
    capturedAt: localNow(),
  }))

  const update = <K extends keyof OwnCaseInput>(key: K, value: OwnCaseInput[K]) => {
    setInput((previous) => ({ ...previous, [key]: value }))
  }

  const profile = useMemo(() => buildOwnProfile(input), [input])
  const findings = useMemo(() => reviewProfile(profile), [profile])
  const fingerprints = useFingerprints(profile.documents)
  const started = hasAnyFigures(input)

  const documentLabels = useMemo(
    () => new Map(profile.documents.map((document) => [document.id, document.label])),
    [profile.documents],
  )

  const counts = useMemo(
    () => ({
      actionNeeded: findings.filter((finding) => finding.severity === 'action-needed').length,
      review: findings.filter((finding) => finding.severity === 'review').length,
    }),
    [findings],
  )

  return (
    <>
      <section className="panel no-print" aria-labelledby="own-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="own-heading">
              Build a brief from your own figures
            </h2>
            <p className="panel__note">
              Type what your own documents say. The same {checks.length} checks that run
              on the synthetic situations run here, against your numbers.
            </p>
          </div>
          <button
            type="button"
            className="button button--quiet button--sm"
            onClick={() => setInput({ ...emptyOwnCase(), capturedAt: localNow() })}
          >
            <Eraser aria-hidden size={14} />
            <span>Clear everything</span>
          </button>
        </div>

        <div className="privacy-badge privacy-badge--inline">
          <ShieldCheck aria-hidden size={18} />
          <span>
            <strong>Nothing you type here leaves this browser.</strong> There is no upload,
            no account and no saving &mdash; refreshing this page clears every figure. Do not
            enter a password or a one-time passcode; no part of this tool ever needs one.
          </span>
        </div>

        <form className="own-form" onSubmit={(event) => event.preventDefault()}>
          <fieldset className="own-group">
            <legend className="own-group__legend">Assessment and dates</legend>
            <div className="own-grid">
              <Field label="Assessment year">
                <input
                  type="text"
                  value={input.assessmentYear}
                  onChange={(event) => update('assessmentYear', event.target.value)}
                />
              </Field>
              <Field label="Statutory due date">
                <select
                  value={input.dueDate}
                  onChange={(event) => update('dueDate', event.target.value)}
                >
                  {DUE_DATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="When you captured these copies"
                hint="Recorded in the fingerprint of every document below."
              >
                <input
                  type="datetime-local"
                  value={input.capturedAt}
                  onChange={(event) => update('capturedAt', event.target.value)}
                />
              </Field>
              <Field label="Return submitted on" hint="Leave blank if not filed yet.">
                <input
                  type="datetime-local"
                  value={input.filedOn}
                  onChange={(event) => update('filedOn', event.target.value)}
                />
              </Field>
              <Field label="Return e-verified on" hint="Leave blank if verification is pending.">
                <input
                  type="datetime-local"
                  value={input.everifiedOn}
                  onChange={(event) => update('everifiedOn', event.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="own-group">
            <legend className="own-group__legend">Salary and tax deducted</legend>
            <div className="own-grid">
              <Field label="Deductor name" hint="As printed on Form 16.">
                <input
                  type="text"
                  value={input.deductorName}
                  onChange={(event) => update('deductorName', event.target.value)}
                />
              </Field>
              <Field label="Deductor TAN">
                <input
                  type="text"
                  value={input.deductorTan}
                  onChange={(event) => update('deductorTan', event.target.value)}
                />
              </Field>
              <Field label="TDS per Form 16 (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.form16Tds}
                  onChange={(event) => update('form16Tds', event.target.value)}
                />
              </Field>
              <Field label="TDS per Form 26AS (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.form26asTds}
                  onChange={(event) => update('form26asTds', event.target.value)}
                />
              </Field>
              <Field label="TDS claimed in the return (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.claimedTds}
                  onChange={(event) => update('claimedTds', event.target.value)}
                />
              </Field>
              <Field label="Employer NPS claimed (%)" hint="Section 80CCD(2).">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.npsClaimPercent}
                  onChange={(event) => update('npsClaimPercent', event.target.value)}
                />
              </Field>
              <Field label="Employer NPS cap stated on Form 16 (%)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.form16NpsCapPercent}
                  onChange={(event) => update('form16NpsCapPercent', event.target.value)}
                />
              </Field>
            </div>
            <label className="own-check">
              <input
                type="checkbox"
                checked={input.deductorQuarterlyFiled}
                onChange={(event) => update('deductorQuarterlyFiled', event.target.checked)}
              />
              <span>Every quarter of this deductor&rsquo;s TDS appears in Form 26AS</span>
            </label>
          </fieldset>

          <fieldset className="own-group">
            <legend className="own-group__legend">Tax you paid yourself</legend>
            <div className="own-grid">
              <Field label="Challan identification number (CIN)">
                <input
                  type="text"
                  value={input.challanCin}
                  onChange={(event) => update('challanCin', event.target.value)}
                />
              </Field>
              <Field label="Kind of payment">
                <select
                  value={input.challanKind}
                  onChange={(event) => update('challanKind', event.target.value as ChallanKind)}
                >
                  <option value="self-assessment">Self-assessment tax</option>
                  <option value="advance-tax">Advance tax</option>
                </select>
              </Field>
              <Field label="Amount on the receipt (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.challanAmount}
                  onChange={(event) => update('challanAmount', event.target.value)}
                />
              </Field>
              <Field label="Paid at">
                <input
                  type="datetime-local"
                  value={input.challanPaidAt}
                  onChange={(event) => update('challanPaidAt', event.target.value)}
                />
              </Field>
              {input.challanListedInReturn && (
                <Field
                  label="Amount shown in the taxes-paid schedule (₹)"
                  hint="Leave blank if it matches the receipt."
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={input.challanAmountInReturn}
                    onChange={(event) => update('challanAmountInReturn', event.target.value)}
                  />
                </Field>
              )}
            </div>
            <label className="own-check">
              <input
                type="checkbox"
                checked={input.challanListedInReturn}
                onChange={(event) => update('challanListedInReturn', event.target.checked)}
              />
              <span>This challan appears in the return&rsquo;s taxes-paid schedule</span>
            </label>
          </fieldset>

          <fieldset className="own-group">
            <legend className="own-group__legend">Interest income</legend>
            <div className="own-rows">
              {input.interest.map((row, index) => (
                <div className="own-row" key={index}>
                  <input
                    type="text"
                    aria-label={`Payer for interest entry ${index + 1}`}
                    placeholder="Payer, as shown in the AIS"
                    value={row.payer}
                    onChange={(event) =>
                      update(
                        'interest',
                        input.interest.map((item, position) =>
                          position === index ? { ...item, payer: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Amount for interest entry ${index + 1}`}
                    placeholder="Amount (₹)"
                    value={row.amount}
                    onChange={(event) =>
                      update(
                        'interest',
                        input.interest.map((item, position) =>
                          position === index ? { ...item, amount: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    type="date"
                    aria-label={`Reported date for interest entry ${index + 1}`}
                    value={row.reportedOn}
                    onChange={(event) =>
                      update(
                        'interest',
                        input.interest.map((item, position) =>
                          position === index ? { ...item, reportedOn: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="button button--quiet button--sm"
                    aria-label={`Remove interest entry ${index + 1}`}
                    onClick={() =>
                      update(
                        'interest',
                        input.interest.filter((_, position) => position !== index),
                      )
                    }
                  >
                    <Trash2 aria-hidden size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button button--quiet button--sm"
              onClick={() =>
                update('interest', [
                  ...input.interest,
                  { payer: '', amount: '', reportedOn: '' },
                ])
              }
            >
              <Plus aria-hidden size={14} />
              <span>Add an AIS interest entry</span>
            </button>
            <div className="own-grid">
              <Field label="Interest declared in the return (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.declaredInterest}
                  onChange={(event) => update('declaredInterest', event.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="own-group">
            <legend className="own-group__legend">Rebate and special-rate income</legend>
            <div className="own-grid">
              <Field label="Rebate claimed under section 87A (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.rebateClaimed}
                  onChange={(event) => update('rebateClaimed', event.target.value)}
                />
              </Field>
              <Field label="Income taxed at a special rate">
                <select
                  value={input.specialRateSection}
                  onChange={(event) =>
                    update('specialRateSection', event.target.value as SpecialRateSection | '')
                  }
                >
                  <option value="">None</option>
                  {SPECIAL_RATE_SECTIONS.map((section) => (
                    <option key={section.value} value={section.value}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </Field>
              {input.specialRateSection && (
                <Field label="Amount taxed at that special rate (₹)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={input.specialRateAmount}
                    onChange={(event) => update('specialRateAmount', event.target.value)}
                  />
                </Field>
              )}
            </div>
          </fieldset>

          <fieldset className="own-group">
            <legend className="own-group__legend">Refund, bank account and PAN</legend>
            <div className="own-grid">
              <Field label="Refund claimed (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.refundClaimed}
                  onChange={(event) => update('refundClaimed', event.target.value)}
                />
              </Field>
              <Field label="Outstanding demand from an earlier year (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.outstandingDemand}
                  onChange={(event) => update('outstandingDemand', event.target.value)}
                />
              </Field>
            </div>

            <label className="own-check">
              <input
                type="checkbox"
                checked={input.hasBankAccount}
                onChange={(event) => update('hasBankAccount', event.target.checked)}
              />
              <span>Record the refund bank account</span>
            </label>

            {input.hasBankAccount && (
              <>
                <div className="own-grid">
                  <Field label="Bank name">
                    <input
                      type="text"
                      value={input.bankName}
                      onChange={(event) => update('bankName', event.target.value)}
                    />
                  </Field>
                  <Field label="Account number, masked" hint="Enter only the last few digits.">
                    <input
                      type="text"
                      value={input.bankAccountMasked}
                      onChange={(event) => update('bankAccountMasked', event.target.value)}
                    />
                  </Field>
                  <Field label="IFSC">
                    <input
                      type="text"
                      value={input.bankIfsc}
                      onChange={(event) => update('bankIfsc', event.target.value)}
                    />
                  </Field>
                </div>
                <label className="own-check">
                  <input
                    type="checkbox"
                    checked={input.bankPreValidated}
                    onChange={(event) => update('bankPreValidated', event.target.checked)}
                  />
                  <span>The account is pre-validated on the portal</span>
                </label>
                <label className="own-check">
                  <input
                    type="checkbox"
                    checked={input.bankNameMatchedWithPan}
                    onChange={(event) => update('bankNameMatchedWithPan', event.target.checked)}
                  />
                  <span>The account holder name matches the PAN database</span>
                </label>
                <label className="own-check">
                  <input
                    type="checkbox"
                    checked={input.bankEvcEnabled}
                    onChange={(event) => update('bankEvcEnabled', event.target.checked)}
                  />
                  <span>Electronic Verification Code is active on this account</span>
                </label>
              </>
            )}

            <label className="own-check">
              <input
                type="checkbox"
                checked={input.panLinked}
                onChange={(event) => update('panLinked', event.target.checked)}
              />
              <span>PAN is linked with Aadhaar</span>
            </label>
            <label className="own-check">
              <input
                type="checkbox"
                checked={input.panOperative}
                onChange={(event) => update('panOperative', event.target.checked)}
              />
              <span>PAN is operative</span>
            </label>
          </fieldset>

          <fieldset className="own-group">
            <legend className="own-group__legend">A notice you received</legend>
            <label className="own-check">
              <input
                type="checkbox"
                checked={input.hasNotice}
                onChange={(event) => update('hasNotice', event.target.checked)}
              />
              <span>I have received a notice about this return</span>
            </label>

            {input.hasNotice && (
              <>
                <div className="own-grid">
                  <Field label="Section" hint="For example 139(9) or 143(1).">
                    <input
                      type="text"
                      value={input.noticeCode}
                      onChange={(event) => update('noticeCode', event.target.value)}
                    />
                  </Field>
                  <Field label="What the notice says it is about">
                    <input
                      type="text"
                      value={input.noticeTitle}
                      onChange={(event) => update('noticeTitle', event.target.value)}
                    />
                  </Field>
                  <Field label="Respond by">
                    <input
                      type="date"
                      value={input.noticeRespondBy}
                      onChange={(event) => update('noticeRespondBy', event.target.value)}
                    />
                  </Field>
                </div>

                <p className="own-group__note">
                  List each document the notice names, and tick the ones you actually hold.
                </p>
                <div className="own-rows">
                  {input.noticeDocuments.map((document, index) => (
                    <div className="own-row own-row--notice" key={index}>
                      <input
                        type="text"
                        aria-label={`Document named by the notice ${index + 1}`}
                        placeholder="Document named by the notice"
                        value={document.label}
                        onChange={(event) =>
                          update(
                            'noticeDocuments',
                            input.noticeDocuments.map((item, position) =>
                              position === index ? { ...item, label: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <label className="own-check own-check--tight">
                        <input
                          type="checkbox"
                          checked={document.onRecord}
                          onChange={(event) =>
                            update(
                              'noticeDocuments',
                              input.noticeDocuments.map((item, position) =>
                                position === index
                                  ? { ...item, onRecord: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        <span>I hold this</span>
                      </label>
                      <button
                        type="button"
                        className="button button--quiet button--sm"
                        aria-label={`Remove named document ${index + 1}`}
                        onClick={() =>
                          update(
                            'noticeDocuments',
                            input.noticeDocuments.filter((_, position) => position !== index),
                          )
                        }
                      >
                        <Trash2 aria-hidden size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="button button--quiet button--sm"
                  onClick={() =>
                    update('noticeDocuments', [
                      ...input.noticeDocuments,
                      { label: '', onRecord: false },
                    ])
                  }
                >
                  <Plus aria-hidden size={14} />
                  <span>Add a document the notice names</span>
                </button>
              </>
            )}
          </fieldset>
        </form>
      </section>

      <section className="panel" aria-labelledby="own-findings-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="own-findings-heading">
              What your records say
            </h2>
            <p className="panel__note">
              {started
                ? `${counts.actionNeeded} needing action, ${counts.review} to review, from ${checks.length} checks.`
                : 'Enter a figure above and the findings will appear here.'}
            </p>
          </div>
          {started && (
            <button
              type="button"
              className="print-button no-print"
              onClick={() => window.print()}
            >
              <Printer aria-hidden size={17} />
              <span>Print this brief</span>
            </button>
          )}
        </div>

        {started ? (
          <>
            <p className="case__meta">
              Assembled in this browser at{' '}
              <strong>{formatDateTime(new Date().toISOString())}</strong> from{' '}
              <strong>{profile.documents.length}</strong> records you described.
            </p>

            <ClockStrip profile={profile} />

            <ol className="findings">
              {findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  documentLabels={documentLabels}
                />
              ))}
            </ol>

            <ExhibitPanel
              profile={profile}
              findings={findings}
              fingerprints={fingerprints}
            />

            {profile.documents.length > 0 && (
              <div className="ledger-wrap">
                <h3 className="panel__heading">Evidence ledger</h3>
                <p className="panel__note">
                  Each fingerprint is a SHA-256 of the record description above, computed
                  in this browser. The same description always produces the same
                  fingerprint, so an altered record shows a different value.
                </p>
                <LedgerDownload profile={profile} fingerprints={fingerprints} />
                <ul className="ledger">
                  {profile.documents.map((document) => (
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
                          <code>
                            {fingerprints[document.id]
                              ? `sha256:${fingerprints[document.id]}`
                              : 'computing…'}
                          </code>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </section>
    </>
  )
}
