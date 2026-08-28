import { useState } from 'react'
import { ArrowUpRight, CheckCircle2, CircleAlert, FileSearch, FlaskConical, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import type { Finding, Severity } from '../domain/tax'
import type { FindingStatus } from '../rules/simulate'
import type { Lang } from '../ai/mockNova'
import { MOCK_NOTICE, explainFinding } from '../ai/mockNova'
import { authenticateNotice } from '../data/sources'
import { severityLabel, statusLabel } from './findingLabels'

export function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === 'action-needed') return <CircleAlert aria-hidden size={18} />
  if (severity === 'review') return <FileSearch aria-hidden size={18} />
  return <CheckCircle2 aria-hidden size={18} />
}

export function FindingCard({
  finding,
  documentLabels,
  status,
  lang = 'en',
}: {
  finding: Finding
  documentLabels: Map<string, string>
  status?: FindingStatus
  lang?: Lang
}) {
  const [explained, setExplained] = useState(false)
  return (
    <li className={`finding finding--${finding.severity} ${status ? `finding--status-${status}` : ''}`}>
      <div className="finding__top">
        <div className="finding__chip">
          <SeverityIcon severity={finding.severity} />
          <span>{severityLabel[finding.severity]}</span>
        </div>
        {status === 'raised' && (
          <span className="finding__status finding__status--raised">
            <Sparkles aria-hidden size={13} />
            {statusLabel.raised}
          </span>
        )}
      </div>

      <h3 className="finding__title">{finding.title}</h3>
      <p className="finding__detail">{finding.detail}</p>

      {finding.comparison && (
        <div className="compare">
          <p className="compare__label">{finding.comparison.label}</p>
          <div className="compare__pair">
            <div className="compare__cell">
              <span className="compare__source">{finding.comparison.left.source}</span>
              <strong className="compare__value">{finding.comparison.left.value}</strong>
            </div>
            <div className="compare__cell">
              <span className="compare__source">{finding.comparison.right.source}</span>
              <strong className="compare__value">{finding.comparison.right.value}</strong>
            </div>
          </div>
        </div>
      )}

      {finding.documentIds.length > 0 && (
        <div className="finding__docs-wrap">
          <span className="finding__docs-label">Records on file:</span>
          <div className="finding__doc-chips">
            {finding.documentIds.map((id) => (
              <span key={id} className="finding__doc-chip">
                {documentLabels.get(id) ?? id}
              </span>
            ))}
          </div>
        </div>
      )}

      {finding.remedy && (
        <div className="remedy">
          <div className="remedy__head">
            <Wrench aria-hidden size={14} />
            <span className="remedy__route">{finding.remedy.route}</span>
            <span className="remedy__actor">{finding.remedy.actor}</span>
          </div>
          <p className="remedy__detail">{finding.remedy.detail}</p>
          {finding.remedy.service && (
            <a
              className="remedy__service"
              href={finding.remedy.service.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>{finding.remedy.service.label}</span>
              <ArrowUpRight aria-hidden size={13} />
            </a>
          )}
        </div>
      )}

      <div className="explain no-print">
        <button
          type="button"
          className="explain__button"
          aria-expanded={explained}
          onClick={() => setExplained((open) => !open)}
        >
          <FlaskConical aria-hidden size={13} />
          <span>
            {explained
              ? 'Hide the plain-language version'
              : lang === 'hi'
                ? 'सरल भाषा में समझाएँ (नमूना)'
                : 'Explain this plainly (mock-up)'}
          </span>
        </button>
        {explained && (
          <>
            <p className="explain__text">{explainFinding(finding, lang)}</p>
            <small className="explain__foot">{MOCK_NOTICE[lang]}</small>
          </>
        )}
      </div>

      <div className="finding__footer">
        <a
          className="finding__source"
          href={finding.source.url}
          target="_blank"
          rel="noreferrer"
        >
          <span>{finding.source.label}</span>
          <ArrowUpRight aria-hidden size={14} />
        </a>
        {finding.id.startsWith('notice-') && (
          <a
            className="finding__source"
            href={authenticateNotice.url}
            target="_blank"
            rel="noreferrer"
          >
            <ShieldCheck aria-hidden size={14} />
            <span>Check this notice is genuine</span>
          </a>
        )}
      </div>
    </li>
  )
}
