import { useState } from 'react'
import { Check, ClipboardCopy, FileSignature, Wand2 } from 'lucide-react'
import type { Finding, TaxProfile } from '../domain/tax'
import type { Lang } from '../ai/mockNova'
import { MOCK_NOTICE, draftGrievance, priorityActions, withLatency } from '../ai/mockNova'
import { MockAiBadge } from './MockAiBadge'

export function AiAssistPanel({
  profile,
  findings,
  lang,
  onLangChange,
}: {
  profile: TaxProfile
  findings: Finding[]
  lang: Lang
  onLangChange: (next: Lang) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [copied, setCopied] = useState(false)

  const actions = priorityActions(findings, lang)

  const generate = async () => {
    setDrafting(true)
    setCopied(false)
    // Held briefly so the working state is visible; no request is made.
    const text = await withLatency(draftGrievance(profile, findings, lang))
    setDraft(text)
    setDrafting(false)
  }

  const copy = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked in some embeds; the textarea is still selectable.
    }
  }

  return (
    <section className="panel no-print" aria-labelledby="assist-heading">
      <div className="assist">
        <div className="assist__head">
          <h2 className="assist__title" id="assist-heading">
            <Wand2 aria-hidden size={17} /> Assisted Drafting
          </h2>
          <MockAiBadge />
        </div>
        <p className="assist__note">
          A mock-up of what an on-device language model would add. Every line below is
          produced by a local template from findings the deterministic checks already
          computed — no model is invoked, no data leaves the page, and nothing here can
          create, remove, or change a finding.
        </p>

        <div className="assist__controls">
          <div className="assist__lang" role="group" aria-label="Draft language">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => onLangChange('en')}>
              English
            </button>
            <button type="button" aria-pressed={lang === 'hi'} onClick={() => onLangChange('hi')}>
              हिन्दी
            </button>
          </div>
          <button
            type="button"
            className="button button--quiet button--sm"
            onClick={generate}
            disabled={drafting}
          >
            <FileSignature aria-hidden size={14} />
            <span>{drafting ? 'Assembling…' : 'Draft a covering letter'}</span>
          </button>
          {draft && (
            <button type="button" className="button button--quiet button--sm" onClick={copy}>
              {copied ? <Check aria-hidden size={14} /> : <ClipboardCopy aria-hidden size={14} />}
              <span>{copied ? 'Copied' : 'Copy draft'}</span>
            </button>
          )}
        </div>

        <h3 className="assist__title" style={{ fontSize: '0.92rem' }}>
          {lang === 'hi' ? 'पहले क्या करें' : 'What to take up first'}
        </h3>
        {actions.length === 0 ? (
          <p className="assist__note">
            {lang === 'hi' ? 'कोई अंतर दर्ज नहीं है।' : 'No differences are recorded.'}
          </p>
        ) : (
          <ol className="assist__list">
            {actions.map((action, index) => (
              <li key={action.findingId} className="assist__item">
                <span className="assist__rank">{index + 1}</span>
                <div>
                  <span className="assist__item-title">{action.title}</span>
                  <p className="assist__item-line">{action.line}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {draft && (
          <>
            <label className="assist__note" htmlFor="assist-draft" style={{ display: 'block', marginTop: 14 }}>
              {lang === 'hi'
                ? 'नमूना पत्र — भेजने से पहले स्वयं जाँच लें।'
                : 'Draft letter — read it yourself before sending it anywhere.'}
            </label>
            <textarea
              id="assist-draft"
              className="assist__draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
            />
            <small className="explain__foot">{MOCK_NOTICE[lang]}</small>
          </>
        )}
      </div>
    </section>
  )
}
