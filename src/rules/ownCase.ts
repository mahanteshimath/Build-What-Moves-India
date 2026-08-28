import type {
  BankAccountInfo,
  Challan,
  ChallanKind,
  DeductorRecord,
  InterestEntry,
  Notice,
  SpecialRateSection,
  TaxCredit,
  TaxDocument,
  TaxProfile,
} from '../domain/tax'

/** A row of the AIS interest table as a person reads it off the statement. */
export interface OwnCaseInterestRow {
  payer: string
  amount: string
  reportedOn: string
}

/** A document a notice names, and whether the taxpayer actually holds a copy. */
export interface OwnCaseNoticeDocument {
  label: string
  onRecord: boolean
}

/**
 * Figures as typed, before any parsing. Amounts stay strings so a half-typed
 * entry never becomes a silent zero in the findings.
 */
export interface OwnCaseInput {
  assessmentYear: string
  dueDate: string
  capturedAt: string
  filedOn: string
  everifiedOn: string

  deductorName: string
  deductorTan: string
  deductorQuarterlyFiled: boolean

  form16Tds: string
  form26asTds: string
  claimedTds: string

  npsClaimPercent: string
  form16NpsCapPercent: string

  challanCin: string
  challanKind: ChallanKind
  challanAmount: string
  challanPaidAt: string
  challanListedInReturn: boolean
  challanAmountInReturn: string

  interest: OwnCaseInterestRow[]
  declaredInterest: string

  rebateClaimed: string
  specialRateSection: SpecialRateSection | ''
  specialRateAmount: string

  refundClaimed: string
  hasBankAccount: boolean
  bankName: string
  bankAccountMasked: string
  bankIfsc: string
  bankPreValidated: boolean
  bankEvcEnabled: boolean
  bankNameMatchedWithPan: boolean

  panLinked: boolean
  panOperative: boolean

  outstandingDemand: string

  hasNotice: boolean
  noticeCode: string
  noticeTitle: string
  noticeRespondBy: string
  noticeDocuments: OwnCaseNoticeDocument[]
}

/** Statutory due dates for AY 2026-27, as recorded in the research report. */
export const DUE_DATE_OPTIONS = [
  { value: '2026-07-31', label: '31 July 2026 — salaried and other non-audit filers (ITR-1, ITR-2)' },
  { value: '2026-08-31', label: '31 August 2026 — non-audit business and professional filers (ITR-3, ITR-4)' },
] as const

const IST_OFFSET = '+05:30'

/**
 * Tax deadlines are stated in Indian Standard Time, so a browser in another
 * zone must not shift a filing across midnight.
 */
export function istInstant(local: string): string | null {
  if (!local.trim()) return null
  const withSeconds = local.length === 16 ? `${local}:00` : local
  return `${withSeconds}${IST_OFFSET}`
}

export function istEndOfDay(date: string): string {
  return `${date}T23:59:00${IST_OFFSET}`
}

/** Accepts what a person copies off a statement: "₹1,23,456.78", "12345", "". */
export function rupeesToPaise(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, '')
  if (!cleaned) return 0
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

export function percentValue(text: string): number {
  const value = Number(text.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : 0
}

export function emptyOwnCase(): OwnCaseInput {
  return {
    assessmentYear: 'AY 2026-27',
    dueDate: '2026-07-31',
    capturedAt: '',
    filedOn: '',
    everifiedOn: '',

    deductorName: '',
    deductorTan: '',
    deductorQuarterlyFiled: true,

    form16Tds: '',
    form26asTds: '',
    claimedTds: '',

    npsClaimPercent: '',
    form16NpsCapPercent: '',

    challanCin: '',
    challanKind: 'self-assessment',
    challanAmount: '',
    challanPaidAt: '',
    challanListedInReturn: true,
    challanAmountInReturn: '',

    interest: [],
    declaredInterest: '',

    rebateClaimed: '',
    specialRateSection: '',
    specialRateAmount: '',

    refundClaimed: '',
    hasBankAccount: false,
    bankName: '',
    bankAccountMasked: '',
    bankIfsc: '',
    bankPreValidated: true,
    bankEvcEnabled: true,
    bankNameMatchedWithPan: true,

    panLinked: true,
    panOperative: true,

    outstandingDemand: '',

    hasNotice: false,
    noticeCode: '',
    noticeTitle: '',
    noticeRespondBy: '',
    noticeDocuments: [],
  }
}

export const OWN_DOCUMENT_IDS = {
  form16: 'own-form-16',
  form26as: 'own-form-26as',
  ais: 'own-ais',
  challan: 'own-challan',
  return: 'own-return',
  notice: 'own-notice',
} as const

export function noticeDocumentId(index: number): string {
  return `own-notice-doc-${index}`
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Builds the same TaxProfile shape the synthetic personas use, so the entered
 * figures run through the identical checks rather than a parallel code path.
 */
export function buildOwnProfile(input: OwnCaseInput): TaxProfile {
  const capturedAt = istInstant(input.capturedAt) ?? new Date().toISOString()
  const filedOn = istInstant(input.filedOn)
  const everifiedOn = istInstant(input.everifiedOn)

  const documents: TaxDocument[] = []
  const challans: Challan[] = []
  const taxCredits: TaxCredit[] = []
  const aisInterest: InterestEntry[] = []

  if (hasText(input.form16Tds) || hasText(input.deductorTan)) {
    documents.push({
      id: OWN_DOCUMENT_IDS.form16,
      kind: 'form-16',
      label: 'Form 16',
      reference: hasText(input.deductorTan) ? `TAN ${input.deductorTan}` : 'Not stated',
      capturedAt,
      note: hasText(input.deductorName) ? `Issued by ${input.deductorName}` : '',
    })
  }

  if (hasText(input.form26asTds)) {
    documents.push({
      id: OWN_DOCUMENT_IDS.form26as,
      kind: 'form-26as',
      label: 'Form 26AS',
      reference: input.assessmentYear,
      capturedAt,
      note: '',
    })
  }

  for (const [index, row] of input.interest.entries()) {
    if (!hasText(row.payer) && !hasText(row.amount)) continue
    aisInterest.push({
      id: `own-interest-${index}`,
      payer: row.payer.trim(),
      amountPaise: rupeesToPaise(row.amount),
      reportedOn: row.reportedOn,
    })
  }

  if (aisInterest.length > 0) {
    documents.push({
      id: OWN_DOCUMENT_IDS.ais,
      kind: 'ais',
      label: 'Annual Information Statement',
      reference: `${aisInterest.length} interest entries`,
      capturedAt,
      note: '',
    })
  }

  if (hasText(input.challanCin) && hasText(input.challanAmount)) {
    const paidAt = istInstant(input.challanPaidAt)
    const amountPaise = rupeesToPaise(input.challanAmount)

    documents.push({
      id: OWN_DOCUMENT_IDS.challan,
      kind: 'challan',
      label: input.challanKind === 'advance-tax' ? 'Advance tax challan' : 'Self-assessment challan',
      reference: `CIN ${input.challanCin}`,
      capturedAt,
      note: '',
    })

    challans.push({
      documentId: OWN_DOCUMENT_IDS.challan,
      kind: input.challanKind,
      cin: input.challanCin.trim(),
      amountPaise,
      paidAt: paidAt ?? capturedAt,
    })

    if (input.challanListedInReturn) {
      taxCredits.push({
        cin: input.challanCin.trim(),
        amountPaise: hasText(input.challanAmountInReturn)
          ? rupeesToPaise(input.challanAmountInReturn)
          : amountPaise,
      })
    }
  }

  if (filedOn) {
    documents.push({
      id: OWN_DOCUMENT_IDS.return,
      kind: 'return',
      label: 'Return acknowledgement',
      reference: input.assessmentYear,
      capturedAt,
      note: '',
    })
  }

  let notice: Notice | null = null
  if (input.hasNotice && hasText(input.noticeCode)) {
    documents.push({
      id: OWN_DOCUMENT_IDS.notice,
      kind: 'notice',
      label: `Notice under section ${input.noticeCode}`,
      reference: input.noticeCode.trim(),
      capturedAt,
      note: input.noticeTitle.trim(),
    })

    const requiredDocumentIds: string[] = []
    for (const [index, document] of input.noticeDocuments.entries()) {
      if (!hasText(document.label)) continue
      const id = noticeDocumentId(index)
      requiredDocumentIds.push(id)
      if (document.onRecord) {
        documents.push({
          id,
          kind: 'other',
          label: document.label.trim(),
          reference: 'Named by the notice',
          capturedAt,
          note: '',
        })
      }
    }

    notice = {
      documentId: OWN_DOCUMENT_IDS.notice,
      code: input.noticeCode.trim(),
      title: hasText(input.noticeTitle) ? input.noticeTitle.trim() : 'Notice on record',
      respondBy: input.noticeRespondBy || input.dueDate,
      requiredDocumentIds,
    }
  }

  const deductors: DeductorRecord[] = []
  if (hasText(input.deductorTan) && hasText(input.deductorName)) {
    deductors.push({
      tan: input.deductorTan.trim(),
      deductorName: input.deductorName.trim(),
      form16QuarterlyFiled: input.deductorQuarterlyFiled,
      amountPaise: rupeesToPaise(input.form16Tds),
    })
  }

  const bankAccount: BankAccountInfo | undefined = input.hasBankAccount
    ? {
        bankName: hasText(input.bankName) ? input.bankName.trim() : 'Refund account',
        accountMasked: hasText(input.bankAccountMasked)
          ? input.bankAccountMasked.trim()
          : 'Not stated',
        ifsc: input.bankIfsc.trim(),
        preValidated: input.bankPreValidated,
        evcEnabled: input.bankEvcEnabled,
        nameMatchedWithPan: input.bankNameMatchedWithPan,
      }
    : undefined

  return {
    id: 'own-case',
    personaLabel: 'Your figures',
    situation: 'Entered by you in this browser. Nothing was uploaded.',
    assessmentYear: input.assessmentYear,
    documents,

    dueDate: istEndOfDay(input.dueDate),
    filedOn,
    everifiedOn,

    challans,
    taxCredits,

    form16TdsPaise: rupeesToPaise(input.form16Tds),
    form26asTdsPaise: rupeesToPaise(input.form26asTds),
    claimedTdsPaise: rupeesToPaise(input.claimedTds),
    deductors: deductors.length > 0 ? deductors : undefined,

    aisInterest,
    declaredInterestPaise: rupeesToPaise(input.declaredInterest),

    npsClaimPercent: percentValue(input.npsClaimPercent),
    form16NpsCapPercent: percentValue(input.form16NpsCapPercent),

    rebateClaimedPaise: rupeesToPaise(input.rebateClaimed),
    specialRateIncome:
      input.specialRateSection && hasText(input.specialRateAmount)
        ? [
            {
              section: input.specialRateSection,
              label: `Income taxed under section ${input.specialRateSection}`,
              amountPaise: rupeesToPaise(input.specialRateAmount),
            },
          ]
        : [],

    refundClaimedPaise: rupeesToPaise(input.refundClaimed),
    bankAccount,
    panAadhaar: {
      linked: input.panLinked,
      operative: input.panOperative,
      lastCheckedDate: input.capturedAt.slice(0, 10) || input.dueDate,
    },
    outstandingDemandPaise: rupeesToPaise(input.outstandingDemand),
    notice,
    // Nothing here is asked for on the form, so it stays recorded as unknown.
    civic: {
      consecutiveOnTimeYears: 0,
      advanceTaxInstalmentsPaid: 0,
      tdsCoveredFullLiability: false,
      literacyQuizCompleted: false,
      budgetConsultationSubmitted: false,
    },
  }
}

/** True once there is enough entered for any check to have something to compare. */
export function hasAnyFigures(input: OwnCaseInput): boolean {
  return (
    hasText(input.form16Tds) ||
    hasText(input.form26asTds) ||
    hasText(input.claimedTds) ||
    hasText(input.challanCin) ||
    hasText(input.refundClaimed) ||
    hasText(input.declaredInterest) ||
    hasText(input.outstandingDemand) ||
    input.interest.some((row) => hasText(row.payer) || hasText(row.amount)) ||
    Boolean(istInstant(input.filedOn)) ||
    (input.hasNotice && hasText(input.noticeCode))
  )
}
