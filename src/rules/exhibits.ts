import type { Finding, TaxProfile } from '../domain/tax'
import { formatDateTime, formatRupees } from '../domain/tax'
import { aisInterestTotal } from './simulate'

export type ExhibitKind = 'enivaran' | 'ais' | 'traces'

const RULE = '==================================================================='
const THIN = '-------------------------------------------------------------------'

/**
 * This text gets pasted into a real grievance form, so it has to say plainly
 * that the taxpayer compiled it themselves with an independent tool.
 */
const PROVENANCE = [
  'Prepared by the taxpayer using Sakshya, an independent tool that compares',
  'the taxpayer\u2019s own document copies against each other. It is not a',
  'Government of India service and carries no official standing. Every figure',
  'below is transcribed from documents the taxpayer holds.',
].join('\n')

function documentList(
  profile: TaxProfile,
  fingerprints: Record<string, string>,
): string {
  if (profile.documents.length === 0) return '(no records described)'
  return profile.documents
    .map(
      (document) =>
        `* ${document.label} [Ref: ${document.reference}]\n  Captured: ${document.capturedAt}\n  SHA-256: ${fingerprints[document.id] ?? '(not computed)'}`,
    )
    .join('\n')
}

/** Groups AIS entries the same way the aisDuplicates check does. */
function duplicatedAisKeys(profile: TaxProfile): string[] {
  const seen = new Map<string, number>()
  for (const entry of profile.aisInterest) {
    const key = `${entry.payer}|${entry.amountPaise}|${entry.reportedOn}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key)
}

function issueBlock(findings: Finding[]): string {
  const relevant = findings.filter(
    (finding) => finding.severity === 'action-needed' || finding.severity === 'review',
  )
  if (relevant.length === 0) {
    return 'The records examined agree with each other. No difference to report.'
  }

  return relevant
    .map((finding, index) => {
      const lines = [`${index + 1}. ${finding.title}`, `   ${finding.detail}`]
      if (finding.comparison) {
        lines.push(
          `   ${finding.comparison.label}:`,
          `     ${finding.comparison.left.source}: ${finding.comparison.left.value}`,
          `     ${finding.comparison.right.source}: ${finding.comparison.right.value}`,
        )
      }
      if (finding.remedy) {
        lines.push(
          `   Correction route: ${finding.remedy.route}`,
          `   Who has to act: ${finding.remedy.actor}`,
        )
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

function header(profile: TaxProfile, title: string, generatedAt: string): string {
  return [
    RULE,
    title,
    RULE,
    `Case: ${profile.personaLabel}`,
    `Assessment year: ${profile.assessmentYear}`,
    `Compiled: ${formatDateTime(generatedAt)}`,
    '',
    PROVENANCE,
    '',
  ].join('\n')
}

export function exhibitText(
  kind: ExhibitKind,
  profile: TaxProfile,
  findings: Finding[],
  fingerprints: Record<string, string>,
  generatedAt: string,
): string {
  if (kind === 'enivaran') {
    return [
      header(profile, 'RECORD OF DIFFERENCES BETWEEN MY DOCUMENTS', generatedAt),
      'DIFFERENCES FOUND',
      THIN,
      issueBlock(findings),
      '',
      'DOCUMENTS THESE FIGURES COME FROM',
      THIN,
      documentList(profile, fingerprints),
      '',
      RULE,
    ].join('\n')
  }

  if (kind === 'ais') {
    const duplicates = duplicatedAisKeys(profile)
    const entries =
      profile.aisInterest.length > 0
        ? profile.aisInterest
            .map(
              (entry) =>
                `- ${entry.payer} | ${formatRupees(entry.amountPaise)} | reported ${entry.reportedOn}`,
            )
            .join('\n')
        : '(no interest entries described)'

    return [
      header(profile, 'ANNUAL INFORMATION STATEMENT \u2014 FEEDBACK NOTE', generatedAt),
      `Interest declared in the return: ${formatRupees(profile.declaredInterestPaise)}`,
      `Total of the AIS entries listed below: ${formatRupees(aisInterestTotal(profile))}`,
      '',
      'AIS ENTRIES AS READ BY THE TAXPAYER',
      THIN,
      entries,
      '',
      'WHAT THIS NOTE REPORTS',
      THIN,
      duplicates.length > 0
        ? `${duplicates.length} entry group(s) repeat the same payer, amount and reported date.\nThe payer certificate for each deposit shows what was actually credited.`
        : 'No entry repeats the same payer, amount and reported date.',
      '',
      RULE,
    ].join('\n')
  }

  const deductors = profile.deductors ?? []
  const difference = Math.abs(profile.form16TdsPaise - profile.form26asTdsPaise)

  return [
    header(profile, 'TAX DEDUCTED \u2014 NOTE FOR THE DEDUCTOR', generatedAt),
    `Form 16 states: ${formatRupees(profile.form16TdsPaise)}`,
    `Form 26AS credits: ${formatRupees(profile.form26asTdsPaise)}`,
    `Difference: ${formatRupees(difference)}`,
    '',
    'DEDUCTORS ON RECORD',
    THIN,
    deductors.length > 0
      ? deductors
          .map(
            (deductor) =>
              `* ${deductor.deductorName} (TAN ${deductor.tan})\n  Deducted per Form 16: ${formatRupees(deductor.amountPaise)}\n  Quarterly statement filed: ${deductor.form16QuarterlyFiled ? 'yes' : 'not yet'}`,
          )
          .join('\n')
      : '(no deductor described)',
    '',
    'WHAT IS BEING ASKED',
    THIN,
    'A credit reaches Form 26AS only after the deductor files the quarterly',
    'statement. This note records the difference between the certificate held',
    'by the taxpayer and the credit currently shown.',
    '',
    RULE,
  ].join('\n')
}
