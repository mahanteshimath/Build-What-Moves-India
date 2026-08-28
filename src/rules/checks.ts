import type { Finding, TaxProfile } from '../domain/tax'
import { formatDate, formatDateTime, formatRupees, gapBetween } from '../domain/tax'
import {
  aisFaq,
  complyToNotice,
  everifyFaq,
  everifyService,
  grievanceService,
  itrFaq,
  knowPaymentStatus,
  linkAadhaarHelp,
  linkAadhaarService,
  portalHome,
  tdsMismatchHelp,
  tracesPortal,
} from '../data/sources'

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
          title: `${kindLabel} you paid is missing from the return`,
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
          remedy: {
            route: 'Confirm the payment against the Department\u2019s own record',
            actor: 'You',
            detail:
              'Check the challan status on the portal. If the payment shows there but not in the taxes-paid schedule, the two Department records disagree with each other, and this brief records that difference with the CIN.',
            service: knowPaymentStatus,
          },
        } satisfies Finding,
      ]
    }

    if (credit.amountPaise !== challan.amountPaise) {
      return [
        {
          id: `challan-amount-${challan.cin}`,
          severity: 'action-needed',
          title: `${kindLabel}: the receipt and the return show different amounts`,
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
          remedy: {
            route: 'Confirm the paid amount against the Department\u2019s own record',
            actor: 'You',
            detail:
              'Check the challan status on the portal and compare it against the amount carried into the taxes-paid schedule.',
            service: knowPaymentStatus,
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
      title: 'You paid the tax before the due date, but the return went in after it',
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
      remedy: {
        route: 'Grievance recording the payment timestamp',
        actor: 'You',
        detail:
          'Both timestamps above, with the CIN, are the record a grievance would rest on. Print this brief and attach the challan receipt.',
        service: grievanceService,
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
      title: 'A rebate was claimed even though some income is taxed at a special rate',
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
      remedy: {
        route: 'Keep the preparation-utility computation sheet',
        actor: 'You',
        detail:
          'Save or print the computation the preparation utility produced, showing the rebate it accepted. If processing later disallows it, that sheet is the only record of what the utility showed at the time.',
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
      title: 'Form 16 and Form 26AS show different amounts of tax deducted',
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
      remedy: {
        route: 'Deductor corrects the TDS statement on TRACES',
        actor: 'Your deductor',
        detail:
          'Only the deductor can revise a filed TDS statement. Form 26AS changes after they file a correction; the Form 16 in your hand is the record of what they certified.',
        service: tracesPortal,
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
      title: 'The tax deducted claimed in the return does not match Form 26AS',
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
      remedy: {
        route: 'Reconcile the claim against the credit statement',
        actor: 'You',
        detail:
          'Either the claim in the return or the credit in Form 26AS is the one that needs correcting. Establish which record is right before changing either.',
        service: tdsMismatchHelp,
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
      title: 'The employer contribution claimed is higher than Form 16 states',
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
      remedy: {
        route: 'Ask the employer to reissue Form 16 with the current cap',
        actor: 'Your deductor',
        detail:
          'Where the Form 16 field still states an older cap, the employer is the only party who can reissue it. Keep the original alongside the reissued copy so both are on record.',
        service: tracesPortal,
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
        title: 'The same interest entry appears more than once in the AIS',
        detail: `${count} entries share the same payer, amount and reported date: ${payer}, ${formatRupees(Number(amountPaise))}, reported ${formatDate(reportedOn)}. A payer-issued certificate for this deposit shows what was actually credited.`,
        documentIds: profile.documents
          .filter((document) => document.kind === 'ais')
          .map((document) => document.id),
        source: aisFaq,
        comparison: {
          label: 'Entries for this payer and date',
          left: { source: 'Annual Information Statement', value: `${count} entries` },
          right: { source: 'Payer certificate', value: '1 entry' },
        },
        remedy: {
          route: 'AIS feedback marking the entry as duplicated',
          actor: 'You',
          detail:
            'Submit feedback against the repeated entry in the Annual Information Statement. The payer certificate for this deposit is the record that shows what was actually credited.',
          service: aisFaq,
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
      title: 'The interest total in the return does not match the AIS total',
      detail:
        'The interest income declared in the return does not equal the sum of interest entries reported in the Annual Information Statement.',
      documentIds: profile.documents
        .filter(
          (document) => document.kind === 'ais' || document.kind === 'return',
        )
        .map((document) => document.id),
      source: aisFaq,
      comparison: {
        label: 'Interest income',
        left: { source: 'Return, declared', value: formatRupees(profile.declaredInterestPaise) },
        right: { source: 'AIS total', value: formatRupees(aisTotal) },
      },
      remedy: {
        route: 'Reconcile against the payer certificates',
        actor: 'You',
        detail:
          'Total the interest certificates you hold. Where they disagree with the statement, AIS feedback is the route that records your figure against it.',
        service: aisFaq,
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
      title: 'The return was submitted, but no e-verification date is recorded',
      detail: `The return records a submission date of ${formatDate(profile.filedOn)}. No e-verification date is recorded. Official guidance describes a ${EVERIFICATION_WINDOW_DAYS}-day e-verification window after submission.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return')
        .map((document) => document.id),
      source: everifyFaq,
      comparison: {
        label: 'Verification',
        left: { source: 'Submitted on', value: formatDate(profile.filedOn) },
        right: { source: 'Verified on', value: 'Not recorded' },
      },
      remedy: {
        route: 'e-Verify the return',
        actor: 'You',
        detail: `Verification is what moves a submitted return into the processing queue. Official guidance describes a ${EVERIFICATION_WINDOW_DAYS}-day window, and several routes besides Aadhaar OTP.`,
        service: everifyService,
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
      title: 'The refund claimed is above the threshold in our research notes',
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
      remedy: {
        route: 'Keep the deduction evidence assembled',
        actor: 'The Department',
        detail:
          'Nothing needs correcting here. This notes only that the claim sits above a band research notes associate with longer automated review, so the supporting evidence is worth keeping together.',
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
        source: portalHome,        remedy: {
          route: 'Respond through Comply to Notice',
          actor: 'You',
          detail:
            'Every document the notice names is in this ledger. Confirm the notice is genuine using the Department\u2019s authentication service before responding.',
          service: complyToNotice,
        },      },
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
      remedy: {
        route: 'Respond through Comply to Notice',
        actor: 'You',
        detail:
          'Before responding, confirm the notice is genuine using the Department\u2019s own authentication service. The response carries whichever named documents you hold; this brief records which ones those are.',
        service: complyToNotice,
      },
    },
  ]
}

const bankAccountReadiness: Check = (profile) => {
  if (profile.refundClaimedPaise <= 0 || !profile.bankAccount) return []

  const { bankAccount } = profile
  const issues: string[] = []
  if (!bankAccount.preValidated) issues.push('Bank account is not pre-validated')
  if (!bankAccount.nameMatchedWithPan) issues.push('Account holder name does not match PAN database')
  if (!bankAccount.evcEnabled) issues.push('Electronic Verification Code (EVC) is not active')

  if (issues.length === 0) return []

  return [
    {
      id: 'bank-prevalidation-failed',
      severity: 'action-needed',
      title: 'Refund account pre-validation or name matching is pending',
      detail: `A refund of ${formatRupees(profile.refundClaimedPaise)} is claimed to ${bankAccount.bankName} (${bankAccount.accountMasked}), but portal readiness checks failed: ${issues.join(', ')}. Without pre-validation, the Centralised Processing Centre (CPC) cannot issue the refund credit.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return')
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'Bank refund readiness',
        left: {
          source: 'Account details',
          value: `${bankAccount.bankName} (${bankAccount.accountMasked})`,
        },
        right: {
          source: 'Readiness status',
          value: issues.join(' | '),
        },
      },
      remedy: {
        route: 'Pre-validate the refund account on the portal',
        actor: 'You',
        detail:
          'The refund cannot be credited until the account is pre-validated and the holder name matches the PAN database. This is done under Profile, in the My Bank Account section.',
        service: portalHome,
      },
    },
  ]
}

const panAadhaarOperative: Check = (profile) => {
  if (!profile.panAadhaar) return []

  const { panAadhaar } = profile
  if (panAadhaar.operative && panAadhaar.linked) return []

  return [
    {
      id: 'pan-aadhaar-inoperative',
      severity: 'action-needed',
      title: 'PAN-Aadhaar linkage is unconfirmed or marked inoperative (Section 234H)',
      detail: `Portal record as of ${formatDate(panAadhaar.lastCheckedDate)} indicates PAN is ${panAadhaar.linked ? 'linked but inoperative' : 'not linked'}. Under Section 234H, inoperative PANs are subject to higher TDS deductions and processing holds.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return' || document.kind === 'form-26as')
        .map((document) => document.id),
      source: linkAadhaarHelp,
      comparison: {
        label: 'PAN linkage status',
        left: {
          source: 'Linked status',
          value: panAadhaar.linked ? 'Linked' : 'Not linked',
        },
        right: {
          source: 'Operative status',
          value: panAadhaar.operative ? 'Operative' : 'Inoperative',
        },
      },
      remedy: {
        route: 'Link Aadhaar with PAN and check the status',
        actor: 'You',
        detail:
          'Linkage status can be checked and started from the portal without signing in. The status shown there is the record that governs.',
        service: linkAadhaarService,
      },
    },
  ]
}

const unreflectedTdsQuarter: Check = (profile) => {
  if (!profile.deductors || profile.deductors.length === 0) return []

  const missingQuarters = profile.deductors.filter((d) => !d.form16QuarterlyFiled)
  if (missingQuarters.length === 0) return []

  return missingQuarters.map((d) => ({
    id: `tds-unreflected-${d.tan}`,
    severity: 'action-needed',
    title: `TDS deducted by ${d.deductorName} is not yet filed by the deductor (TAN: ${d.tan})`,
    detail: `Employer/deductor ${d.deductorName} withheld ${formatRupees(d.amountPaise)} in TDS as recorded in Form 16, but has not uploaded the quarterly TDS return (Form 24Q/26Q) to TRACES. The credit is absent from Form 26AS.`,
    documentIds: profile.documents
      .filter((document) => document.kind === 'form-16' || document.kind === 'form-26as')
      .map((document) => document.id),
    source: tdsMismatchHelp,
    comparison: {
      label: 'Deductor quarterly filing',
      left: {
        source: 'Form 16 Part A',
        value: `${d.tan} — ${formatRupees(d.amountPaise)}`,
      },
      right: {
        source: 'TRACES 26AS Status',
        value: 'Statement not filed by deductor',
      },
    },
    remedy: {
      route: 'Deductor files the pending quarterly statement',
      actor: 'Your deductor',
      detail:
        'The credit reaches Form 26AS only after the deductor files the quarterly statement. The Form 16 in your hand is the record that they deducted it.',
      service: tracesPortal,
    },
  }))
}

const demandOffsetLedger: Check = (profile) => {
  if (!profile.outstandingDemandPaise || profile.outstandingDemandPaise <= 0) return []
  if (profile.refundClaimedPaise <= 0) return []

  return [
    {
      id: 'demand-offset-sec245',
      severity: 'review',
      title: 'Claimed refund is subject to automated set-off under Section 245(2)',
      detail: `The return claims a refund of ${formatRupees(profile.refundClaimedPaise)}, but there is an existing outstanding demand of ${formatRupees(profile.outstandingDemandPaise)} from a prior assessment year on record. CPC automated processing will propose adjustment before disbursing refund balances.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return')
        .map((document) => document.id),
      source: portalHome,
      comparison: {
        label: 'Section 245 proposed set-off',
        left: {
          source: 'Claimed refund',
          value: formatRupees(profile.refundClaimedPaise),
        },
        right: {
          source: 'Outstanding demand',
          value: formatRupees(profile.outstandingDemandPaise),
        },
      },
      remedy: {
        route: 'Ask for the assessment order behind the demand',
        actor: 'You',
        detail:
          'A demand rests on an assessment order. Where no order is on record, the absence of that document is itself the thing to put in writing, and a grievance is the route that records it.',
        service: grievanceService,
      },
    },
  ]
}

/** A return cannot be verified before it was submitted. */
const verificationBeforeFiling: Check = (profile) => {
  if (!profile.filedOn || !profile.everifiedOn) return []
  if (new Date(profile.everifiedOn).getTime() >= new Date(profile.filedOn).getTime()) return []

  return [
    {
      id: 'verification-before-filing',
      severity: 'action-needed',
      title: 'The verification date recorded is earlier than the submission date',
      detail: `The return records submission at ${formatDateTime(profile.filedOn)} and verification at ${formatDateTime(profile.everifiedOn)}. Verification cannot precede submission, so one of these two dates is transcribed wrongly.`,
      documentIds: profile.documents
        .filter((document) => document.kind === 'return')
        .map((document) => document.id),
      source: everifyFaq,
      comparison: {
        label: 'Recorded order of events',
        left: { source: 'Submitted on', value: formatDateTime(profile.filedOn) },
        right: { source: 'Verified on', value: formatDateTime(profile.everifiedOn) },
      },
      remedy: {
        route: 'Re-read both dates from the acknowledgement',
        actor: 'You',
        detail:
          'Check the submission and verification dates against the acknowledgement itself before this brief is used anywhere. A brief carrying an impossible date order will not be read past.',
        service: everifyService,
      },
    },
  ]
}

/** A return cannot claim credit for a payment made after it was submitted. */
const creditPaidAfterFiling: Check = (profile) => {
  if (!profile.filedOn) return []
  const filedAt = new Date(profile.filedOn).getTime()

  return profile.challans
    .filter((challan) => profile.taxCredits.some((credit) => credit.cin === challan.cin))
    .filter((challan) => new Date(challan.paidAt).getTime() > filedAt)
    .map((challan) => ({
      id: `credit-after-filing-${challan.cin}`,
      severity: 'action-needed',
      title: 'The return claims a payment that the receipt dates after submission',
      detail: `The taxes-paid schedule lists CIN ${challan.cin}, but the challan receipt records payment at ${formatDateTime(challan.paidAt)}, after the return was submitted at ${formatDateTime(profile.filedOn ?? '')}. One of these two dates is transcribed wrongly.`,
      documentIds: [challan.documentId],
      source: portalHome,
      comparison: {
        label: 'Recorded order of events',
        left: { source: 'Return submitted', value: formatDateTime(profile.filedOn ?? '') },
        right: { source: 'Challan paid', value: formatDateTime(challan.paidAt) },
      },
      remedy: {
        route: 'Check the payment date against the challan status',
        actor: 'You',
        detail:
          'The payment date on the portal is the record that governs. Correct whichever date was transcribed wrongly before this brief is used anywhere.',
        service: knowPaymentStatus,
      },
    } satisfies Finding))
}

export const checks: Check[] = [
  challanCredit,
  deadlineGap,
  rebateOnSpecialRate,
  tdsMatch,
  claimedTds,
  unreflectedTdsQuarter,
  npsCap,
  aisDuplicates,
  interestDeclared,
  everification,
  bankAccountReadiness,
  panAadhaarOperative,
  demandOffsetLedger,
  refundBand,
  noticeEvidence,
  verificationBeforeFiling,
  creditPaidAfterFiling,
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
