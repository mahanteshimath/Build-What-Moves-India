export type Severity = 'action-needed' | 'review' | 'ready'

export type DocumentKind =
  | 'form-16'
  | 'form-26as'
  | 'ais'
  | 'challan'
  | 'return'
  | 'notice'
  | 'other'

export interface OfficialSource {
  label: string
  url: string
}

/** A friction category documented in the local research report, not an official statement. */
export interface PortalIssue {
  id: string
  category: string
  title: string
  summary: string
  observations: string[]
  /** Names of the checks in src/rules/checks.ts that report this difference. */
  coveredBy: string[]
  sources: OfficialSource[]
}

export interface TaxDocument {
  id: string
  kind: DocumentKind
  label: string
  reference: string
  capturedAt: string
  note: string
}

export type ChallanKind = 'advance-tax' | 'self-assessment'

export interface Challan {
  documentId: string
  kind: ChallanKind
  cin: string
  amountPaise: number
  paidAt: string
}

/** What the return's taxes-paid schedule shows against a challan identifier. */
export interface TaxCredit {
  cin: string
  amountPaise: number
}

export interface InterestEntry {
  id: string
  payer: string
  amountPaise: number
  reportedOn: string
}

export type SpecialRateSection = '111A' | '112A' | '112' | '115BBH'

export interface SpecialRateIncome {
  section: SpecialRateSection
  label: string
  amountPaise: number
}

export interface BankAccountInfo {
  bankName: string
  accountMasked: string
  ifsc: string
  preValidated: boolean
  evcEnabled: boolean
  nameMatchedWithPan: boolean
}

export interface PanAadhaarStatus {
  linked: boolean
  operative: boolean
  lastCheckedDate: string
}

export interface DeductorRecord {
  tan: string
  deductorName: string
  form16QuarterlyFiled: boolean
  amountPaise: number
}

export interface Notice {
  documentId: string
  code: string
  title: string
  respondBy: string
  requiredDocumentIds: string[]
}

/**
 * Facts about the taxpayer's own civic record that no check can derive from a
 * single year's documents. Supplied by the person, never conferred on them.
 */
export interface CivicRecord {
  consecutiveOnTimeYears: number
  /** Of four quarterly instalments, or 4 where TDS covered the liability. */
  advanceTaxInstalmentsPaid: number
  tdsCoveredFullLiability: boolean
  literacyQuizCompleted: boolean
  budgetConsultationSubmitted: boolean
  /** When filing opened for the year, for the early-filing bonus. */
  portalOpenedOn?: string
}

export interface TaxProfile {
  id: string
  personaLabel: string
  situation: string
  assessmentYear: string
  documents: TaxDocument[]

  dueDate: string
  filedOn: string | null
  everifiedOn: string | null

  challans: Challan[]
  taxCredits: TaxCredit[]

  form16TdsPaise: number
  form26asTdsPaise: number
  claimedTdsPaise: number
  deductors?: DeductorRecord[]

  aisInterest: InterestEntry[]
  declaredInterestPaise: number

  npsClaimPercent: number
  form16NpsCapPercent: number

  rebateClaimedPaise: number
  specialRateIncome: SpecialRateIncome[]

  refundClaimedPaise: number
  bankAccount?: BankAccountInfo
  panAadhaar?: PanAadhaarStatus
  outstandingDemandPaise?: number
  notice: Notice | null
  civic?: CivicRecord
}

export interface Comparison {
  label: string
  left: { source: string; value: string }
  right: { source: string; value: string }
}

/**
 * Where a difference gets corrected, and who holds the record that has to change.
 * States the documented route only; it is not advice about what to claim.
 */
export interface Remedy {
  /** Short name of the route, e.g. "AIS feedback". */
  route: string
  /** Who has to act: the taxpayer, the deductor, or the Department. */
  actor: 'You' | 'Your deductor' | 'The Department'
  detail: string
  service?: OfficialSource
}

export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
  documentIds: string[]
  source: OfficialSource
  comparison?: Comparison
  remedy?: Remedy
}

/** Stable text a document's fingerprint is computed over. */
export function fingerprintSource(document: TaxDocument): string {
  return [
    document.kind,
    document.label,
    document.reference,
    document.capturedAt,
    document.note,
  ].join('|')
}

export function formatRupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** Whole hours and minutes between two instants, for timeline evidence. */
export function gapBetween(fromIso: string, toIso: string): string {
  const minutes = Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000,
  )
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
