import type { CivicRecord, Finding, OfficialSource, TaxProfile } from '../domain/tax'
import {
  everifyFaq,
  itrFaq,
  linkAadhaarHelp,
  portalHome,
  tdsMismatchHelp,
} from '../data/sources'

/**
 * KarSamman (कर सम्मान) — a filing-readiness score the taxpayer computes for
 * themselves, from their own records, in their own browser.
 *
 * It is deliberately NOT a rating conferred by any authority, and it grants no
 * benefit. It reports how much of the taxpayer's own evidence is assembled, and
 * which documented consequences that assembled evidence guards against. Nobody
 * but the holder ever sees it.
 */

export const MAX_SCORE = 1000

export type FactorId =
  | 'timeliness'
  | 'streak'
  | 'accuracy'
  | 'advance-tax'
  | 'civic-literacy'

export interface FactorResult {
  id: FactorId
  label: string
  earned: number
  max: number
  /** What the records show, stated plainly. */
  detail: string
  /** Points still available, and what would earn them. */
  nextStep?: { points: number; action: string; source?: OfficialSource }
}

export interface Tier {
  level: number
  name: string
  english: string
  min: number
  max: number
  /** Maps to a CSS modifier, not an inline colour. */
  tone: 'slate' | 'bronze' | 'silver' | 'gold' | 'platinum'
}

export const TIERS: Tier[] = [
  { level: 1, name: 'आरंभ', english: 'Aarambh', min: 0, max: 149, tone: 'slate' },
  { level: 2, name: 'आरंभ', english: 'Aarambh', min: 150, max: 299, tone: 'slate' },
  { level: 3, name: 'नागरिक', english: 'Nagarik', min: 300, max: 399, tone: 'bronze' },
  { level: 4, name: 'नागरिक', english: 'Nagarik', min: 400, max: 499, tone: 'bronze' },
  { level: 5, name: 'निर्माता', english: 'Nirmata', min: 500, max: 599, tone: 'silver' },
  { level: 6, name: 'निर्माता', english: 'Nirmata', min: 600, max: 699, tone: 'silver' },
  { level: 7, name: 'रक्षक', english: 'Rakshak', min: 700, max: 774, tone: 'gold' },
  { level: 8, name: 'रक्षक', english: 'Rakshak', min: 775, max: 849, tone: 'gold' },
  { level: 9, name: 'राष्ट्र मित्र', english: 'Rashtra Mitra', min: 850, max: 924, tone: 'platinum' },
  { level: 10, name: 'राष्ट्र मित्र', english: 'Rashtra Mitra', min: 925, max: 1000, tone: 'platinum' },
]

export function tierFor(score: number): Tier {
  const clamped = Math.max(0, Math.min(MAX_SCORE, score))
  return TIERS.find((tier) => clamped >= tier.min && clamped <= tier.max) ?? TIERS[0]
}

export const EMPTY_CIVIC: CivicRecord = {
  consecutiveOnTimeYears: 0,
  advanceTaxInstalmentsPaid: 0,
  tdsCoveredFullLiability: false,
  literacyQuizCompleted: false,
  budgetConsultationSubmitted: false,
}

const DAY_MS = 86_400_000
const EARLY_FILING_DAYS = 30
const STREAK_YEAR_POINTS = 50
const STREAK_YEAR_CAP = 5

/** Finding ids that mean two of the taxpayer's records disagree on a figure. */
const ACCURACY_BREAKING_IDS = [
  'tds-form16-vs-26as',
  'tds-claimed-vs-26as',
  'interest-total',
  'nps-cap',
]

function hasAccuracyBreak(findings: Finding[]): boolean {
  return findings.some(
    (finding) =>
      ACCURACY_BREAKING_IDS.includes(finding.id) ||
      finding.id.startsWith('ais-duplicate-') ||
      finding.id.startsWith('tds-unreflected-'),
  )
}

function timeliness(profile: TaxProfile, civic: CivicRecord): FactorResult {
  const max = 300
  const base = {
    id: 'timeliness' as const,
    label: 'Filed on time',
    max,
  }

  if (!profile.filedOn) {
    return {
      ...base,
      earned: 0,
      detail: 'No submission date is recorded against this return.',
      nextStep: {
        points: 200,
        action: 'Filing on or before the due date records the full timeliness points.',
        source: itrFaq,
      },
    }
  }

  const filedAt = new Date(profile.filedOn).getTime()
  const dueAt = new Date(profile.dueDate).getTime()

  if (filedAt > dueAt) {
    return {
      ...base,
      earned: 50,
      detail: 'The return was submitted after the due date recorded on it.',
      nextStep: {
        points: 250,
        action:
          'A return submitted on or before the due date carries the full timeliness points in a later year.',
        source: itrFaq,
      },
    }
  }

  const onTime = 200
  if (!civic.portalOpenedOn) {
    return {
      ...base,
      earned: onTime,
      detail: 'The return was submitted on or before the due date.',
      nextStep: {
        points: 100,
        action: `Filing within ${EARLY_FILING_DAYS} days of filing opening records the early-filing points.`,
      },
    }
  }

  const openedAt = new Date(civic.portalOpenedOn).getTime()
  const withinEarlyWindow = filedAt - openedAt <= EARLY_FILING_DAYS * DAY_MS

  return {
    ...base,
    earned: withinEarlyWindow ? max : onTime,
    detail: withinEarlyWindow
      ? `The return was submitted within ${EARLY_FILING_DAYS} days of filing opening.`
      : 'The return was submitted on or before the due date, but outside the early-filing window.',
    nextStep: withinEarlyWindow
      ? undefined
      : {
          points: 100,
          action: `Filing within ${EARLY_FILING_DAYS} days of filing opening records the early-filing points.`,
        },
  }
}

function streak(civic: CivicRecord): FactorResult {
  const max = STREAK_YEAR_POINTS * STREAK_YEAR_CAP
  const years = Math.max(0, Math.floor(civic.consecutiveOnTimeYears))
  const counted = Math.min(years, STREAK_YEAR_CAP)
  const earned = counted * STREAK_YEAR_POINTS

  return {
    id: 'streak',
    label: 'Years filed on time in a row',
    earned,
    max,
    detail:
      years === 0
        ? 'No consecutive on-time years are recorded.'
        : `${years} consecutive year${years === 1 ? '' : 's'} filed on time${years > STREAK_YEAR_CAP ? `, counted to the ${STREAK_YEAR_CAP}-year cap` : ''}.`,
    nextStep:
      counted < STREAK_YEAR_CAP
        ? {
            points: STREAK_YEAR_POINTS,
            action: 'Each further consecutive on-time year records another 50 points.',
          }
        : undefined,
  }
}

function accuracy(profile: TaxProfile, findings: Finding[]): FactorResult {
  const max = 200
  const recordsAgree = !hasAccuracyBreak(findings)

  let verified = false
  if (profile.filedOn && profile.everifiedOn) {
    const gap = new Date(profile.everifiedOn).getTime() - new Date(profile.filedOn).getTime()
    verified = gap >= 0 && gap <= DAY_MS
  }

  const earned = (recordsAgree ? 120 : 0) + (verified ? 80 : 0)

  const detailParts: string[] = []
  detailParts.push(
    recordsAgree
      ? 'No two of these records disagree on a figure.'
      : 'At least two of these records disagree on a figure.',
  )
  detailParts.push(
    verified
      ? 'Verification was recorded within a day of submission.'
      : profile.everifiedOn
        ? 'Verification is recorded, but more than a day after submission.'
        : 'No verification date is recorded.',
  )

  let nextStep: FactorResult['nextStep']
  if (!recordsAgree) {
    nextStep = {
      points: 120,
      action:
        'Resolving the record differences listed in the brief records the accuracy points.',
      source: tdsMismatchHelp,
    }
  } else if (!verified) {
    nextStep = {
      points: 80,
      action: 'Verifying within a day of submission records the verification points.',
      source: everifyFaq,
    }
  }

  return {
    id: 'accuracy',
    label: 'Records agree, and verification is recorded',
    earned,
    max,
    detail: detailParts.join(' '),
    nextStep,
  }
}

function advanceTax(civic: CivicRecord): FactorResult {
  const max = 150
  const instalments = Math.max(0, Math.min(4, Math.floor(civic.advanceTaxInstalmentsPaid)))
  const covered = civic.tdsCoveredFullLiability || instalments === 4

  const earned = covered ? max : instalments > 0 ? 75 : 0

  return {
    id: 'advance-tax',
    label: 'Tax paid through the year',
    earned,
    max,
    detail: covered
      ? civic.tdsCoveredFullLiability
        ? 'Tax deducted at source covered the liability for the year.'
        : 'All four advance tax instalments are recorded as paid.'
      : instalments > 0
        ? `${instalments} of 4 advance tax instalments are recorded as paid.`
        : 'No advance tax instalments are recorded.',
    nextStep: covered
      ? undefined
      : {
          points: max - earned,
          action:
            'Paying tax across the year, rather than at the end, avoids interest under sections 234B and 234C.',
          source: portalHome,
        },
  }
}

function civicLiteracy(civic: CivicRecord): FactorResult {
  const max = 100
  const earned =
    (civic.literacyQuizCompleted ? 60 : 0) + (civic.budgetConsultationSubmitted ? 40 : 0)

  const done: string[] = []
  if (civic.literacyQuizCompleted) done.push('the awareness quiz')
  if (civic.budgetConsultationSubmitted) done.push('the budget consultation')

  return {
    id: 'civic-literacy',
    label: 'Took part in the public process',
    earned,
    max,
    detail:
      done.length > 0
        ? `Recorded: ${done.join(' and ')}.`
        : 'Neither the awareness quiz nor the budget consultation is recorded.',
    nextStep:
      earned < max
        ? {
            points: max - earned,
            action: !civic.literacyQuizCompleted
              ? 'Completing the taxpayer awareness quiz records 60 points.'
              : 'Submitting the budget consultation records 40 points.',
          }
        : undefined,
  }
}

export interface Readiness {
  score: number
  tier: Tier
  factors: FactorResult[]
  /** Highest-value unearned steps first. */
  boosters: FactorResult[]
}

export function readinessFor(
  profile: TaxProfile,
  findings: Finding[],
): Readiness {
  const civic = profile.civic ?? EMPTY_CIVIC

  const factors: FactorResult[] = [
    timeliness(profile, civic),
    streak(civic),
    accuracy(profile, findings),
    advanceTax(civic),
    civicLiteracy(civic),
  ]

  const score = factors.reduce((total, factor) => total + factor.earned, 0)

  const boosters = factors
    .filter((factor) => factor.nextStep)
    .sort((a, b) => (b.nextStep?.points ?? 0) - (a.nextStep?.points ?? 0))

  return { score, tier: tierFor(score), factors, boosters }
}

/** Documented consequences that assembled evidence guards against. */
export interface Protection {
  id: string
  title: string
  detail: string
  /** The factor whose points evidence this protection. */
  factor: FactorId
  source: OfficialSource
  /** True where the figure comes from the local research report. */
  researchSignal?: boolean
}

export const PROTECTIONS: Protection[] = [
  {
    id: 'late-fee',
    title: 'A late-filing fee under section 234F',
    detail:
      'Research notes record a fee of ₹5,000 on a belated return, or ₹1,000 where total income is below ₹5 lakh. A submission timestamp on or before the due date is the record that answers it.',
    factor: 'timeliness',
    source: itrFaq,
    researchSignal: true,
  },
  {
    id: 'verification-lapse',
    title: 'A return that never enters the processing queue',
    detail:
      'Official guidance describes a 30-day e-verification window after submission. A recorded verification date is what shows the window was met.',
    factor: 'accuracy',
    source: everifyFaq,
  },
  {
    id: 'defective-return',
    title: 'A defective return notice under section 139(9)',
    detail:
      'Where two of your records state different figures, the difference is what a notice asks you to explain. Records that agree leave nothing to explain.',
    factor: 'accuracy',
    source: tdsMismatchHelp,
  },
  {
    id: 'inoperative-pan',
    title: 'Higher deduction on an inoperative PAN under section 234H',
    detail:
      'Linkage status is checkable on the portal before filing, and the status shown there is the record that governs.',
    factor: 'accuracy',
    source: linkAadhaarHelp,
  },
  {
    id: 'interest-234bc',
    title: 'Interest under sections 234B and 234C',
    detail:
      'Interest arises where tax is paid at the end of the year rather than across it. Instalment receipts are the record of when it was paid.',
    factor: 'advance-tax',
    source: portalHome,
  },
]

export function protectionsEarned(readiness: Readiness): {
  protection: Protection
  held: boolean
}[] {
  const byId = new Map(readiness.factors.map((factor) => [factor.id, factor]))
  return PROTECTIONS.map((protection) => {
    const factor = byId.get(protection.factor)
    return {
      protection,
      held: factor ? factor.earned === factor.max : false,
    }
  })
}
