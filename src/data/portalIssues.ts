import type { PortalIssue } from '../domain/tax'
import {
  aisFaq,
  everifyFaq,
  itrFaq,
  linkAadhaarHelp,
  portalHome,
  staticPasswordHelp,
  tdsMismatchHelp,
} from './sources'

/**
 * Drawn from the local research report on the Income Tax e-Filing portal. Each line
 * records what taxpayers encounter, never why the portal behaved as it did.
 */
export const portalIssues: PortalIssue[] = [
  {
    id: 'challan-sync',
    category: 'Payments & Deadlines',
    title: 'A challan you paid does not appear in the return',
    summary:
      'Research notes record e-Pay Tax challans carrying a valid CIN and BSR code that are not listed in the return’s taxes-paid schedule at the moment of filing.',
    observations: [
      'Research notes record a window of 24 hours to 5 days before a paid challan is reflected.',
      'Where filing then crosses midnight on the due date, the return is recorded as belated under section 139(4).',
      'Research notes record a fee under section 234F of ₹5,000 on a belated return, or ₹1,000 where total income is below ₹5 lakh.',
      'Research notes record manual CIN and BSR entry producing validation mismatches and repeated refresh attempts.',
    ],
    coveredBy: ['challanCredit', 'deadlineGap', 'creditPaidAfterFiling'],
    sources: [tdsMismatchHelp, portalHome],
  },
  {
    id: 'rebate-special-rate',
    category: 'Deductions & Rebates',
    title: 'A rebate accepted while preparing the return is disallowed at processing',
    summary:
      'Research notes record returns where the section 87A rebate is accepted in the preparation utility and then disallowed when the return is processed.',
    observations: [
      'Under the new regime in section 115BAC, research notes record a rebate ceiling of ₹60,000 for total income up to ₹12 lakh.',
      'The disagreement concerns income taxed at special rates: section 111A short-term gains at 20%, section 112A long-term gains at 12.5% above ₹1.25 lakh, section 112 at 12.5% or 20%, and section 115BBH virtual digital assets at 30%.',
      'A Bangalore ITAT ruling recorded in the research notes holds that the rebate cannot be denied on section 112 gains in the absence of an explicit bar of the kind written into section 112A(6).',
      'Research notes record the preparation utility changing its calculation mid-season, so a draft prepared earlier and one prepared later do not agree.',
      'Where the rebate is disallowed, research notes record an intimation under section 143(1) alongside interest under sections 234B and 234C.',
    ],
    coveredBy: ['rebateOnSpecialRate'],
    sources: [itrFaq],
  },
  {
    id: 'verification-window',
    category: 'Access & Verification',
    title: 'The return is submitted but verification never completes',
    summary:
      'Research notes record submitted returns left unverified because the one-time password does not arrive in time, or the attempt is locked out before it succeeds.',
    observations: [
      'Official guidance documents a 30-day window to e-verify a submitted return.',
      'Research notes record UIDAI gateway latency delivering the one-time password after its 15-minute validity has lapsed.',
      'Research notes record three failed attempts producing a 30-minute lockout.',
      'Research notes record ad-blockers and browser security settings suppressing the OTP dialog with no error message shown.',
    ],
    coveredBy: ['everification', 'panAadhaarOperative', 'verificationBeforeFiling'],
    sources: [everifyFaq, staticPasswordHelp, linkAadhaarHelp],
  },
  {
    id: 'statement-mismatch',
    category: 'Statements & Credits',
    title: 'The AIS, Form 26AS and Form 16 do not agree with each other',
    summary:
      'Research notes record the three statements a taxpayer relies on carrying different figures for the same income or the same deduction.',
    observations: [
      'Research notes record duplicate AIS entries for interest income, and the same stock transaction reported by more than one intermediary.',
      'Research notes record AIS feedback that does not reprocess before the filing deadline.',
      'The employer contribution limit under section 80CCD(2) was raised to 14%, while research notes record Form 16 text fields still stating the earlier 10% cap.',
      'Research notes record that difference being read as a defect and answered with a notice under section 139(9).',
      'Research notes record advance tax that appears in Form 26AS but does not pre-populate into the return, leaving the tax due overstated.',
    ],
    coveredBy: [
      'tdsMatch',
      'claimedTds',
      'npsCap',
      'aisDuplicates',
      'interestDeclared',
      'unreflectedTdsQuarter',
    ],
    sources: [aisFaq, tdsMismatchHelp],
  },
  {
    id: 'refund-hold',
    category: 'Refunds',
    title: 'A refund sits in automated review',
    summary:
      'Research notes record refunds above a documented band being held in automated risk review rather than issued on the usual timeline.',
    observations: [
      'Research notes associate refunds above ₹20,000 with automated review.',
      'Research notes record the usual 2 to 4 weeks becoming 3 to 6 months where a hold applies.',
      'Research notes record taxpayers being prompted to file a revised return giving up valid deductions in order to release the hold.',
    ],
    coveredBy: ['refundBand', 'bankAccountReadiness'],
    sources: [portalHome],
  },
  {
    id: 'legacy-demand',
    category: 'Demands & Notices',
    title: 'An old demand is revived and set off against this year’s refund',
    summary:
      'Research notes record demands raised in earlier assessment years being revived and adjusted against a current refund under section 245.',
    observations: [
      'Research notes record revived demands 10 to 15 years old, from assessment years 2008-09 to 2012-13.',
      'Research notes record the demands originating in the paper-filing era, including clerical errors and TDS shown on Form 16A that was never credited.',
      'Research notes record taxpayers no longer holding records from that period, so the assessment order behind the demand cannot be produced.',
    ],
    coveredBy: ['demandOffsetLedger', 'noticeEvidence'],
    sources: [portalHome],
  },
]
