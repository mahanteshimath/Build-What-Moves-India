import { useMemo, useState } from 'react'
import { ArrowUpRight, Download, Flame, ShieldCheck, Sparkles } from 'lucide-react'
import { profiles } from '../data/profiles'
import type { CivicRecord } from '../domain/tax'
import { checks, reviewProfile } from '../rules/checks'
import { saveBlob } from '../rules/saveBlob'
import {
  EMPTY_CIVIC,
  MAX_SCORE,
  TIERS,
  protectionsEarned,
  readinessFor,
} from '../rules/readiness'
import '../readiness.css'

const GAUGE_RADIUS = 78
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS

function Gauge({ score, tone }: { score: number; tone: string }) {
  const fraction = Math.max(0, Math.min(1, score / MAX_SCORE))

  return (
    <svg className="gauge" viewBox="0 0 200 200" role="img" aria-label={`${score} of ${MAX_SCORE}`}>
      <circle className="gauge__track" cx="100" cy="100" r={GAUGE_RADIUS} />
      <circle
        className={`gauge__value gauge__value--${tone}`}
        cx="100"
        cy="100"
        r={GAUGE_RADIUS}
        strokeDasharray={GAUGE_CIRCUMFERENCE}
        strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - fraction)}
      />
      <text className="gauge__score" x="100" y="96">
        {score}
      </text>
      <text className="gauge__of" x="100" y="122">
        of {MAX_SCORE}
      </text>
    </svg>
  )
}

export default function ReadinessPage() {
  const [profileId, setProfileId] = useState(profiles[0].id)
  const [civic, setCivic] = useState<CivicRecord>(
    () => profiles[0].civic ?? { ...EMPTY_CIVIC, consecutiveOnTimeYears: 2 },
  )

  const base = profiles.find((item) => item.id === profileId) ?? profiles[0]
  const profile = useMemo(() => ({ ...base, civic }), [base, civic])
  const findings = useMemo(() => reviewProfile(profile), [profile])
  const readiness = useMemo(() => readinessFor(profile, findings), [profile, findings])
  const protections = protectionsEarned(readiness)

  const set = <K extends keyof CivicRecord>(key: K, value: CivicRecord[K]) =>
    setCivic((previous) => ({ ...previous, [key]: value }))

  const downloadCard = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#002855'
    ctx.fillRect(0, 0, 1200, 630)
    ctx.fillStyle = '#ff9933'
    ctx.fillRect(0, 0, 1200, 10)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 62px system-ui, sans-serif'
    ctx.fillText('कर सम्मान · KarSamman', 70, 130)

    ctx.font = '30px system-ui, sans-serif'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText('My own filing-readiness score, computed in my browser', 70, 182)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 180px system-ui, sans-serif'
    ctx.fillText(String(readiness.score), 70, 380)
    ctx.font = '40px system-ui, sans-serif'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`/ ${MAX_SCORE}`, 70 + ctx.measureText(String(readiness.score)).width + 240, 380)

    ctx.fillStyle = '#ff9933'
    ctx.font = 'bold 46px system-ui, sans-serif'
    ctx.fillText(
      `Level ${readiness.tier.level} · ${readiness.tier.english}`,
      70,
      460,
    )

    ctx.fillStyle = '#94a3b8'
    ctx.font = '24px system-ui, sans-serif'
    ctx.fillText(
      'Self-assessed from my own records. Not issued or endorsed by any authority.',
      70,
      545,
    )
    ctx.fillText('Independent hackathon prototype · synthetic data', 70, 583)

    canvas.toBlob((blob) => {
      if (!blob) return
      saveBlob(blob, `karsamman-${readiness.score}.png`)
    })
  }

  return (
    <>
      <section className="panel" aria-labelledby="readiness-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="readiness-heading">
              कर सम्मान · KarSamman — your filing-readiness score
            </h2>
            <p className="panel__note">
              How much of your own evidence is assembled, scored out of {MAX_SCORE}. You
              compute it, you hold it, and nobody else can see it.
            </p>
          </div>
        </div>

        <div className="callout callout--warn">
          <ShieldCheck aria-hidden size={18} />
          <span>
            <strong>This is not a rating anyone gives you.</strong> No authority issues,
            sees or acts on this number, and it unlocks no benefit. It is a self-check
            computed in this browser from the same {checks.length} checks that produce the
            evidentiary brief.
          </span>
        </div>

        <div className="readiness">
          <div className="readiness__hero">
            <Gauge score={readiness.score} tone={readiness.tier.tone} />
            <div className="readiness__identity">
              <span className={`tier-badge tier-badge--${readiness.tier.tone}`}>
                Level {readiness.tier.level} · {readiness.tier.name} ({readiness.tier.english})
              </span>
              <p className="readiness__persona">{base.personaLabel}</p>
              {civic.consecutiveOnTimeYears > 0 && (
                <p className="readiness__streak">
                  <Flame aria-hidden size={16} />
                  <span>
                    {civic.consecutiveOnTimeYears}-year on-time streak
                    {civic.consecutiveOnTimeYears > 5 && ' (counted to the 5-year cap)'}
                  </span>
                </p>
              )}
              <button type="button" className="button button--quiet button--sm" onClick={downloadCard}>
                <Download aria-hidden size={14} />
                <span>Download share card</span>
              </button>
            </div>
          </div>

          <div className="readiness__factors">
            {readiness.factors.map((factor) => (
              <div className="factor" key={factor.id}>
                <div className="factor__head">
                  <span className="factor__label">{factor.label}</span>
                  <span className="factor__points">
                    {factor.earned} / {factor.max}
                  </span>
                </div>
                <div
                  className="factor__bar"
                  role="progressbar"
                  aria-valuenow={factor.earned}
                  aria-valuemin={0}
                  aria-valuemax={factor.max}
                  aria-label={factor.label}
                >
                  <div
                    className={`factor__fill factor__fill--${readiness.tier.tone}`}
                    style={{ width: `${(factor.earned / factor.max) * 100}%` }}
                  />
                </div>
                <p className="factor__detail">{factor.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {readiness.boosters.length > 0 && (
        <section className="panel" aria-labelledby="boosters-heading">
          <h2 className="panel__heading" id="boosters-heading">
            <Sparkles aria-hidden size={18} /> What would raise it
          </h2>
          <p className="panel__note">
            Largest available gain first. Each states what the record would have to show,
            not what you should claim.
          </p>
          <ul className="boosters">
            {readiness.boosters.map((factor) => (
              <li className="booster" key={factor.id}>
                <span className="booster__points">+{factor.nextStep?.points}</span>
                <div>
                  <p className="booster__action">{factor.nextStep?.action}</p>
                  {factor.nextStep?.source && (
                    <a
                      className="booster__source"
                      href={factor.nextStep.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{factor.nextStep.source.label}</span>
                      <ArrowUpRight aria-hidden size={13} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel no-print" aria-labelledby="what-if-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="what-if-heading">
              Try a different record
            </h2>
            <p className="panel__note">
              Timeliness and accuracy are read from the situation&rsquo;s actual documents, so
              the score can never disagree with the brief. The rest is what you tell it.
            </p>
          </div>
        </div>

        <div className="picker picker--compact">
          {profiles.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`picker__item ${item.id === profileId ? 'picker__item--selected' : ''}`}
              aria-pressed={item.id === profileId}
              onClick={() => {
                setProfileId(item.id)
                setCivic(item.civic ?? { ...EMPTY_CIVIC })
              }}
            >
              <span className="picker__item-title">{item.personaLabel}</span>
            </button>
          ))}
        </div>

        <div className="own-grid">
          <label className="own-field">
            <span className="own-field__label">
              Consecutive years filed on time: <strong>{civic.consecutiveOnTimeYears}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              value={civic.consecutiveOnTimeYears}
              onChange={(event) => set('consecutiveOnTimeYears', Number(event.target.value))}
            />
          </label>
          <label className="own-field">
            <span className="own-field__label">
              Advance tax instalments paid: <strong>{civic.advanceTaxInstalmentsPaid} of 4</strong>
            </span>
            <input
              type="range"
              min={0}
              max={4}
              value={civic.advanceTaxInstalmentsPaid}
              onChange={(event) =>
                set('advanceTaxInstalmentsPaid', Number(event.target.value))
              }
            />
          </label>
        </div>

        <label className="own-check">
          <input
            type="checkbox"
            checked={civic.tdsCoveredFullLiability}
            onChange={(event) => set('tdsCoveredFullLiability', event.target.checked)}
          />
          <span>Tax deducted at source covered the whole liability</span>
        </label>
        <label className="own-check">
          <input
            type="checkbox"
            checked={Boolean(civic.portalOpenedOn)}
            onChange={(event) =>
              set(
                'portalOpenedOn',
                event.target.checked
                  ? new Date(
                      new Date(base.filedOn ?? base.dueDate).getTime() - 10 * 86_400_000,
                    ).toISOString()
                  : undefined,
              )
            }
          />
          <span>Filed within 30 days of filing opening</span>
        </label>
        <label className="own-check">
          <input
            type="checkbox"
            checked={civic.literacyQuizCompleted}
            onChange={(event) => set('literacyQuizCompleted', event.target.checked)}
          />
          <span>Completed the taxpayer awareness quiz</span>
        </label>
        <label className="own-check">
          <input
            type="checkbox"
            checked={civic.budgetConsultationSubmitted}
            onChange={(event) => set('budgetConsultationSubmitted', event.target.checked)}
          />
          <span>Submitted the budget public consultation</span>
        </label>
      </section>

      <section className="panel" aria-labelledby="protections-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="protections-heading">
              What this readiness answers
            </h2>
            <p className="panel__note">
              Not rewards. These are documented consequences that assembled evidence
              answers, each linked to the guidance that describes it.
            </p>
          </div>
        </div>

        <ul className="protections">
          {protections.map(({ protection, held }) => (
            <li
              key={protection.id}
              className={`protection ${held ? 'protection--held' : 'protection--open'}`}
            >
              <span className="protection__state">{held ? 'Answered' : 'Not yet answered'}</span>
              <h3 className="protection__title">{protection.title}</h3>
              <p className="protection__detail">
                {protection.detail}
                {protection.researchSignal && (
                  <em> This figure is a research signal, not an official statement.</em>
                )}
              </p>
              <a
                className="protection__source"
                href={protection.source.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>{protection.source.label}</span>
                <ArrowUpRight aria-hidden size={13} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="ladder-heading">
        <h2 className="panel__heading" id="ladder-heading">
          The ten levels
        </h2>
        <ol className="ladder">
          {TIERS.map((tier) => (
            <li
              key={tier.level}
              className={`ladder__step ladder__step--${tier.tone} ${tier.level === readiness.tier.level ? 'ladder__step--current' : ''}`}
            >
              <span className="ladder__level">L{tier.level}</span>
              <span className="ladder__name">
                {tier.name} <span className="ladder__english">{tier.english}</span>
              </span>
              <span className="ladder__range">
                {tier.min}–{tier.max}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
