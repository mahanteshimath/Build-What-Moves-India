import type { DocumentKind, Severity } from '../domain/tax'
import type { FindingStatus } from '../rules/simulate'

export const severityLabel: Record<Severity, string> = {
  'action-needed': 'Action needed',
  review: 'Review',
  ready: 'Ready',
}

export const kindLabel: Record<DocumentKind, string> = {
  'form-16': 'Form 16',
  'form-26as': 'Form 26AS',
  ais: 'AIS',
  challan: 'Challan',
  return: 'Return',
  notice: 'Notice',
  other: 'Supporting document',
}

export const statusLabel: Record<FindingStatus, string> = {
  carried: 'Unchanged by your edit',
  cleared: 'Cleared by your edit',
  raised: 'Raised by your edit',
}
