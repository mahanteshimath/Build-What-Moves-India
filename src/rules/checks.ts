import type { Finding, TaxProfile } from '../domain/tax'
import { formatDate, formatDateTime, formatRupees, gapBetween } from '../domain/tax'
import { itrFaq, portalHome } from '../data/sources'

/** Amounts and windows below come from the local research report, not an official page. */
const RESEARCH_NOTE =
  'This threshold comes from the local research report and is a research signal, not an official statement.'

export const REFUND_REVIEW_BAND_PAISE = 2_000_000
export const EVERIFICATION_WINDOW_DAYS = 30

type Check = (profile: TaxProfile) => Finding[]

const challanCredit: Check = (profile) =>
  profile.challans.flatMap((challan) => {
    const credit = profile.taxCredits.find((item) => item.cin === challan.cin)
    const kindLabel =
      challan.kind === 'advance-tax' ? 'Advance tax' : 'Self-assessment tax'

    if (!credit) {
      return [
        {
          id: `challan-missing-${challan.cin}`,
          severity: 'action-needed',
          title: `${kindLabel} challan is not in the taxes-paid schedule`,
          detail: `The challan receipt records ${formatRupees(challan.amountPaise)} paid on ${formatDateTime(challan.paidAt)}. The return's taxes-paid schedule lists no entry for this CIN.`,
          documentIds: [challan.documentId],
          source: portalHome,
          comparison: {
            label: 'Challan credit',
            left: {
              source: 'Challan receipt',
              value: `${challan.cin} — ${formatRupees(challan.amountPaise)}`,
            },
            right: { source: 'Taxes-paid schedule', value: 'Not listed' },
          },
        } satisfies Finding,
      ]
    }

    if (credit.amountPaise !== challan.amountPaise) {
      return [
        {
          id: `challan-amount-${challan.cin}`,
          severity: 'action-needed',
          title: `${kindLabel} challan amount differs from the schedule`,
          detail: `The challan receipt and the taxes-paid schedule record different amounts for CIN ${challan.cin}.`,
          documentIds: [challan.documentId],
          source: portalHome,
          comparison: {
            label: 'Challan amount',
            left: {
              source: 'Challan receipt',
              value: formatRupees(challan.amountPaise),
            },
            right: {
              source: 'Taxes-paid schedule',
              value: formatRupees(credit.amountPaise),
            },
          },
        } satisfies Finding,
      ]
    }

    return []
  })

const deadlineGap: Check = (profile) => {
  if (!profile.filedOn) return []

  const filedAt = new Date(profile.filedOn).getTime()
  const dueAt = new Date(profile.dueDate).getTime()
  if (filedAt <= dueAt) return []

  const paidInTime = profile.challans.find(
    (challan) => new Date(challan.paidAt).getTime() <= dueAt,
  )
  if (!paidInTime) return []

  return [
    {
      id: 'deadline-gap',
      severity: 'action-needed',
      title: 'Tax was paid before the due date, the return was submitted after it',
      detail: `The challan records payment at ${formatDateTime(paidInTime.paidAt)}, which is before the due date. The return records submission at ${formatDateTime(profile.filedOn)}, a gap of ${gapBetween(paidInTime.paidAt, profile.filedOn)}. ${RESEARCH_NOTE}`,
      documentIds: [paidInTime.documentId],
      source: portalHome,
      comparison: {
        label: 'Recorded timestamps',
        left: {
          source: 'Challan receipt',
          value: formatDateTime(paidInTime.paidAt),
        },
        right: {
          source: 'Return acknowledgement',
          value: formatDateTime(profile.filedOn),
        },
      },
    },
  ]
}

const rebateOnSpecialRate: Check = (profile) => {
  if (profile.rebateClaimedPaise <= 0) return []
  if (profile.specialRateIncome.length === 0) return []

  const sections = profile.specialRateIncome
    .map((income) => `section ${income.section}`)
    .join(', ')

  return [
    {
      id: 'rebate-special-rate',
      severity: 'review',
      title: 'Rebate claimed alongside special-rate income',
      detail: `The return claims a rebate of ${formatRupees(profile.rebateClaimedPaise)} and also reports income taxed at special rates (${sections}). Research notes record returns in this shape being processed differently from the preparation utility. ${RESEARCH_NOTE} Keep the draft computation sheet, so both figures stay on record.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return' || document.kind === 'ais')
        .map((document) => document.id),
      source: itrFaq,
      comparison: {
        label: 'Rebate against special-rate income',
        left: {
          source: 'Return, rebate claimed',
          value: formatRupees(profile.rebateClaimedPaise),
        },
        right: { source: 'Special-rate income reported', value: sections },
      },
    },
  ]
}

const tdsMatch: Check = (profile) => {
  if (profile.form16TdsPaise === profile.form26asTdsPaise) return []

  return [
    {
      id: 'tds-form16-vs-26as',
      severity: 'action-needed',
      title: 'Form 16 and Form 26AS report different TDS',
      detail:
        'The employer statement and the tax credit statement record different amounts of tax deducted for the same year.',
      documentIds: profile.documents
        .filter(
          (document) =>
            document.kind === 'form-16' || document.kind === 'form-26as',
        )
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'Tax deducted at source',
        left: { source: 'Form 16', value: formatRupees(profile.form16TdsPaise) },
        right: {
          source: 'Form 26AS',
          value: formatRupees(profile.form26asTdsPaise),
        },
      },
    },
  ]
}

const claimedTds: Check = (profile) => {
  if (profile.claimedTdsPaise === profile.form26asTdsPaise) return []

  return [
    {
      id: 'tds-claimed-vs-26as',
      severity: 'action-needed',
      title: 'TDS claimed in the return differs from Form 26AS',
      detail:
        'The amount of tax deducted claimed in the return does not match the amount shown in the tax credit statement.',
      documentIds: profile.documents
        .filter(
          (document) =>
            document.kind === 'return' || document.kind === 'form-26as',
        )
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'TDS claimed',
        left: {
          source: 'Return',
          value: formatRupees(profile.claimedTdsPaise),
        },
        right: {
          source: 'Form 26AS',
          value: formatRupees(profile.form26asTdsPaise),
        },
      },
    },
  ]
}

const npsCap: Check = (profile) => {
  if (profile.npsClaimPercent <= profile.form16NpsCapPercent) return []

  return [
    {
      id: 'nps-cap',
      severity: 'action-needed',
      title: 'Employer contribution claim exceeds the Form 16 stated cap',
      detail: `The return claims ${profile.npsClaimPercent}% of salary as an employer contribution deduction. The Form 16 field states ${profile.form16NpsCapPercent}%. These two records disagree.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'form-16')
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'Employer contribution deduction',
        left: { source: 'Return', value: `${profile.npsClaimPercent}%` },
        right: { source: 'Form 16', value: `${profile.form16NpsCapPercent}%` },
      },
    },
  ]
}

const aisDuplicates: Check = (profile) => {
  const seen = new Map<string, number>()
  for (const entry of profile.aisInterest) {
    const key = `${entry.payer}|${entry.amountPaise}|${entry.reportedOn}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [payer, amountPaise, reportedOn] = key.split('|')
      return {
        id: `ais-duplicate-${payer}-${reportedOn}`,
        severity: 'action-needed',
        title: 'Repeated entry in the Annual Information Statement',
        detail: `${count} entries share the same payer, amount and reported date: ${payer}, ${formatRupees(Number(amountPaise))}, reported ${formatDate(reportedOn)}. A payer-issued certificate for this deposit shows what was actually credited.`,
        documentIds: profile.documents
          .filter((document) => document.kind === 'ais')
          .map((document) => document.id),
        source: portalHome,
        comparison: {
          label: 'Entries for this payer and date',
          left: { source: 'Annual Information Statement', value: `${count} entries` },
          right: { source: 'Payer certificate', value: '1 entry' },
        },
      } satisfies Finding
    })
}

const interestDeclared: Check = (profile) => {
  const aisTotal = profile.aisInterest.reduce(
    (total, entry) => total + entry.amountPaise,
    0,
  )
  if (aisTotal === profile.declaredInterestPaise) return []

  return [
    {
      id: 'interest-total',
      severity: 'review',
      title: 'Interest total in the return differs from the AIS total',
      detail:
        'The interest income declared in the return does not equal the sum of interest entries reported in the Annual Information Statement.',
      documentIds: profile.documents
        .filter(
          (document) => document.kind === 'ais' || document.kind === 'return',
        )
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'Interest income',
        left: { source: 'Return, declared', value: formatRupees(profile.declaredInterestPaise) },
        right: { source: 'AIS total', value: formatRupees(aisTotal) },
      },
    },
  ]
}

const everification: Check = (profile) => {
  if (!profile.filedOn || profile.everifiedOn) return []

  return [
    {
      id: 'everification-pending',
      severity: 'action-needed',
      title: 'Return submitted, no verification date recorded',
      detail: `The return records a submission date of ${formatDate(profile.filedOn)}. No e-verification date is recorded. Official guidance describes a ${EVERIFICATION_WINDOW_DAYS}-day e-verification window after submission.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return')
        .map((document) => document.id),
      source: itrFaq,
      comparison: {
        label: 'Verification',
        left: { source: 'Submitted on', value: formatDate(profile.filedOn) },
        right: { source: 'Verified on', value: 'Not recorded' },
      },
    },
  ]
}

const refundBand: Check = (profile) => {
  if (profile.refundClaimedPaise <= REFUND_REVIEW_BAND_PAISE) return []

  return [
    {
      id: 'refund-band',
      severity: 'review',
      title: 'Refund claimed is above the documented review band',
      detail: `The return claims a refund of ${formatRupees(profile.refundClaimedPaise)}, which is above the ${formatRupees(REFUND_REVIEW_BAND_PAISE)} band that research notes associate with longer automated review. ${RESEARCH_NOTE} Keep the deduction evidence together while the return is in the processing queue.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return')
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'Refund claimed',
        left: {
          source: 'Return',
          value: formatRupees(profile.refundClaimedPaise),
        },
        right: {
          source: 'Research review band',
          value: formatRupees(REFUND_REVIEW_BAND_PAISE),
        },
      },
    },
  ]
}

const noticeEvidence: Check = (profile) => {
  const { notice } = profile
  if (!notice) return []

  const held = new Set(profile.documents.map((document) => document.id))
  const missing = notice.requiredDocumentIds.filter((id) => !held.has(id))

  if (missing.length === 0) {
    return [
      {
        id: 'notice-ready',
        severity: 'review',
        title: `Notice under section ${notice.code} — every named document is on record`,
        detail: `${notice.title}. The response date recorded on the notice is ${formatDate(notice.respondBy)}.`,
        documentIds: [notice.documentId, ...notice.requiredDocumentIds],
        source: portalHome,
      },
    ]
  }

  return [
    {
      id: 'notice-missing-evidence',
      severity: 'action-needed',
      title: `Notice under section ${notice.code} names a document not on record`,
      detail: `${notice.title}. ${missing.length} of ${notice.requiredDocumentIds.length} named documents are not in this ledger. The response date recorded on the notice is ${formatDate(notice.respondBy)}.`,
      documentIds: [notice.documentId],
      source: portalHome,
      comparison: {
        label: 'Documents named by the notice',
        left: {
          source: 'Named on the notice',
          value: `${notice.requiredDocumentIds.length}`,
        },
        right: {
          source: 'Present in ledger',
          value: `${notice.requiredDocumentIds.length - missing.length}`,
        },
      },
    },
  ]
}

export const checks: Check[] = [
  challanCredit,
  deadlineGap,
  rebateOnSpecialRate,
  tdsMatch,
  claimedTds,
  npsCap,
  aisDuplicates,
  interestDeclared,
  everification,
  refundBand,
  noticeEvidence,
]

export function reviewProfile(profile: TaxProfile): Finding[] {
  const findings = checks.flatMap((check) => check(profile))
  if (findings.length > 0) return findings

  return [
    {
      id: 'all-clear',
      severity: 'ready',
      title: 'Every checked record agrees',
      detail: `All ${checks.length} checks ran against this profile and found no differences between the records held and the return as submitted.`,
      documentIds: profile.documents.map((document) => document.id),
      source: portalHome,
    },
  ]
}
