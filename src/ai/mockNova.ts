import type { Finding, Remedy, TaxProfile } from '../domain/tax'
import { formatDate } from '../domain/tax'

/**
 * A stand-in for amazon.nova-lite-v1:0. Nothing here calls a model, opens a
 * socket, or needs credentials — every line is produced by a local template so
 * the demo is reproducible and the deterministic checks stay the only authority
 * on what a record says. Swapping in a real Bedrock call means replacing the
 * bodies below with a fetch to a server function; the signatures are the seam.
 */

export type Lang = 'en' | 'hi'

export const MODEL_ID = 'amazon.nova-lite-v1:0'

export const MOCK_NOTICE: Record<Lang, string> = {
  en: 'Mock-up. No AI model is called — this text comes from a local template.',
  hi: 'यह केवल एक नमूना है। कोई AI मॉडल नहीं चलाया गया — यह पाठ स्थानीय टेम्पलेट से बना है।',
}

/** Lets the UI show a working state without pretending a model answered. */
export function withLatency<T>(value: T, ms = 420): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const HI_TERMS: Record<string, string> = {
  'Form 16': 'फॉर्म 16',
  'Form 26AS': 'फॉर्म 26AS',
  'Challan receipt': 'चालान रसीद',
  'Taxes-paid schedule': 'कर-भुगतान अनुसूची',
  'Return': 'रिटर्न',
  'Filed return': 'दाखिल रिटर्न',
  'AIS': 'AIS',
  'Notice': 'नोटिस',
}

function term(source: string): string {
  return HI_TERMS[source] ?? source
}

const ACTOR_EN: Record<Remedy['actor'], string> = {
  You: 'you',
  'Your deductor': 'your deductor',
  'The Department': 'the Department',
}

const ACTOR_HI: Record<Remedy['actor'], string> = {
  You: 'आप',
  'Your deductor': 'आपका कटौतीकर्ता (deductor)',
  'The Department': 'विभाग',
}

function firstSentence(text: string): string {
  const end = text.indexOf('. ')
  return end === -1 ? text : `${text.slice(0, end)}.`
}

/**
 * Restates one already-computed finding in everyday words. It only reorders
 * facts the finding already carries — it never adds a consequence, an amount,
 * or a reason the records disagree.
 */
export function explainFinding(finding: Finding, lang: Lang): string {
  const actor = finding.remedy?.actor

  if (lang === 'hi') {
    const tail = actor
      ? ` जिस रिकॉर्ड को बदलना है, वह ${ACTOR_HI[actor]} के पास है।`
      : ''
    if (finding.comparison) {
      const { left, right } = finding.comparison
      return `सीधे शब्दों में: ${term(left.source)} में ${left.value} दर्ज है, और ${term(right.source)} में ${right.value}। ये दोनों रिकॉर्ड आपस में मेल नहीं खाते।${tail}`
    }
    return `सीधे शब्दों में: आपके अपने रिकॉर्ड में इस मद पर अंतर दर्ज है। ${firstSentence(finding.detail)}${tail}`
  }

  const tail = actor ? ` The record that has to change is held by ${ACTOR_EN[actor]}.` : ''
  if (finding.comparison) {
    const { left, right } = finding.comparison
    return `In plain terms: ${left.source} records ${left.value}, and ${right.source} records ${right.value}. The two do not agree.${tail}`
  }
  return `In plain terms: your own records differ on this item. ${firstSentence(finding.detail)}${tail}`
}

export interface PriorityAction {
  findingId: string
  title: string
  actor: Remedy['actor'] | null
  line: string
}

const SEVERITY_RANK = { 'action-needed': 0, review: 1, ready: 2 } as const
const ACTOR_RANK: Record<Remedy['actor'], number> = {
  You: 0,
  'Your deductor': 1,
  'The Department': 2,
}

/**
 * Orders findings so the ones the taxpayer can act on themselves come first.
 * The ordering is deterministic; the model-flavoured part is only the wording.
 */
export function priorityActions(findings: Finding[], lang: Lang): PriorityAction[] {
  return [...findings]
    .sort((a, b) => {
      const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (severity !== 0) return severity
      const actorA = a.remedy ? ACTOR_RANK[a.remedy.actor] : 3
      const actorB = b.remedy ? ACTOR_RANK[b.remedy.actor] : 3
      return actorA - actorB
    })
    .map((finding) => {
      const remedy = finding.remedy
      let line: string
      if (!remedy) {
        line =
          lang === 'hi'
            ? 'इस अंतर के लिए कोई प्रलेखित मार्ग दर्ज नहीं है।'
            : 'No documented route is recorded for this difference.'
      } else if (lang === 'hi') {
        line = `${ACTOR_HI[remedy.actor]} इस पर कार्रवाई कर सकते हैं — ${remedy.route}।`
      } else {
        line = `${remedy.actor} can act on this — ${remedy.route}.`
      }
      return {
        findingId: finding.id,
        title: finding.title,
        actor: remedy?.actor ?? null,
        line,
      }
    })
}

/**
 * Assembles a copy-ready covering letter listing the record differences. It
 * quotes only figures the checks already produced and closes by disclaiming any
 * assertion about the outcome, so nothing here states a tax position.
 */
export function draftGrievance(
  profile: TaxProfile,
  findings: Finding[],
  lang: Lang,
): string {
  const hi = lang === 'hi'
  const lines: string[] = []

  lines.push(hi ? `[${MOCK_NOTICE.hi}]` : `[${MOCK_NOTICE.en}]`)
  lines.push('')
  lines.push(
    hi
      ? `विषय: निर्धारण वर्ष ${profile.assessmentYear} के रिकॉर्ड में अंतर`
      : `Subject: Differences between my records for AY ${profile.assessmentYear}`,
  )
  lines.push(
    hi
      ? `नियत तिथि: ${formatDate(profile.dueDate)}`
      : `Filing due date on record: ${formatDate(profile.dueDate)}`,
  )
  lines.push('')
  lines.push(
    hi
      ? 'मेरे पास मौजूद रिकॉर्ड की तुलना करने पर नीचे दर्ज अंतर मिले। प्रत्येक मद के साथ दोनों रिकॉर्ड के मान दिए गए हैं।'
      : 'Comparing the records I hold produced the differences listed below. Each item names both records and the value each one carries.',
  )
  lines.push('')

  if (findings.length === 0) {
    lines.push(
      hi
        ? 'इस समय कोई अंतर दर्ज नहीं है।'
        : 'No differences are recorded at this time.',
    )
  }

  findings.forEach((finding, index) => {
    lines.push(`${index + 1}. ${finding.title}`)
    if (finding.comparison) {
      const { left, right } = finding.comparison
      lines.push(`   ${left.source}: ${left.value}`)
      lines.push(`   ${right.source}: ${right.value}`)
    }
    if (finding.remedy) {
      lines.push(
        hi
          ? `   मार्ग: ${finding.remedy.route} (${ACTOR_HI[finding.remedy.actor]})`
          : `   Route: ${finding.remedy.route} (${finding.remedy.actor})`,
      )
    }
    lines.push('')
  })

  lines.push(
    hi
      ? 'यह पत्र केवल रिकॉर्ड के बीच अंतर बताता है। यह किसी परिणाम, देयता या पात्रता का दावा नहीं करता।'
      : 'This letter states differences between records only. It asserts no outcome, liability, or eligibility.',
  )
  lines.push(
    hi
      ? 'Sakshya से तैयार — एक स्वतंत्र प्रोटोटाइप, भारत सरकार की सेवा नहीं।'
      : 'Prepared with Sakshya — an independent prototype, not a Government of India service.',
  )

  return lines.join('\n')
}

export interface QueryMatch {
  /** Must stay in step with the allowlist in api/query.ts. */
  name: string
  why: string
  confidence: number
}

const QUERY_KEYWORDS: { name: string; words: string[] }[] = [
  { name: 'corpusSize', words: ['how many', 'corpus', 'scale', 'total', 'population', 'size of the set'] },
  { name: 'prevalence', words: ['common', 'often', 'frequent', 'prevalence', 'most', 'share', 'affected'] },
  { name: 'cooccurrence', words: ['together', 'both', 'co-occur', 'cooccur', 'correlat', 'pair', 'same return', 'lift'] },
  { name: 'tables', words: ['table', 'storage', 'rows', 'bytes', 'compression', 'footprint'] },
  { name: 'views', words: ['view', 'check', 'sql', 'logic', 'definition', 'rule'] },
]

/**
 * Maps a plain-English question onto a query NAME from the fixed allowlist.
 * It can never emit SQL, so a hostile question has nothing to reach — the worst
 * outcome is the wrong card being selected.
 */
export function matchQuery(question: string): QueryMatch | null {
  const text = question.toLowerCase()
  if (!text.trim()) return null

  let best: { name: string; hits: string[] } | null = null
  for (const entry of QUERY_KEYWORDS) {
    const hits = entry.words.filter((word) => text.includes(word))
    if (hits.length > 0 && (!best || hits.length > best.hits.length)) {
      best = { name: entry.name, hits }
    }
  }
  if (!best) return null

  return {
    name: best.name,
    why: `Matched on ${best.hits.map((h) => `"${h}"`).join(', ')}.`,
    confidence: Math.min(1, best.hits.length / 2),
  }
}
