import type { TaxProfile } from '../domain/tax'
import { fingerprintSource } from '../domain/tax'

/**
 * A ledger anyone can re-compute. Each entry carries the exact string that was
 * hashed, so a reader can run SHA-256 over it themselves and compare, rather
 * than taking this tool's word for the digest.
 */
export function ledgerText(
  profile: TaxProfile,
  fingerprints: Record<string, string>,
  generatedAt: string,
): string {
  const lines: string[] = [
    'SAKSHYA EVIDENCE LEDGER',
    'Independent hackathon prototype. Not a Government of India service.',
    '',
    `Case: ${profile.personaLabel}`,
    `Assessment year: ${profile.assessmentYear}`,
    `Ledger generated: ${generatedAt}`,
    `Records: ${profile.documents.length}`,
    '',
    'Each fingerprint below is SHA-256 over the exact text on the "Hashed text"',
    'line, computed in the browser. To check a row independently, run SHA-256 over',
    'that text and compare the first 16 hex characters.',
    '',
  ]

  for (const [index, document] of profile.documents.entries()) {
    lines.push(
      `${index + 1}. ${document.label}`,
      `   Kind        : ${document.kind}`,
      `   Reference   : ${document.reference}`,
      `   Captured at : ${document.capturedAt}`,
      `   Note        : ${document.note || '(none)'}`,
      `   Hashed text : ${fingerprintSource(document)}`,
      `   SHA-256     : ${fingerprints[document.id] ?? '(not computed)'}`,
      '',
    )
  }

  lines.push(
    'This ledger states what the holder\u2019s own copies record. It is not a',
    'statement by, or on behalf of, the Income Tax Department.',
  )

  return lines.join('\n')
}
