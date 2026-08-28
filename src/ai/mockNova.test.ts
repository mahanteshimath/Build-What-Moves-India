import { describe, expect, it } from 'vitest'
import { profileById } from '../data/profiles'
import { reviewProfile } from '../rules/checks'
import { draftGrievance, explainFinding, matchQuery, priorityActions } from './mockNova'

const profile = profileById('deadline-payment')
const findings = reviewProfile(profile)

describe('explainFinding', () => {
  it('restates both sides of a comparison without adding a consequence', () => {
    const withComparison = findings.find((f) => f.comparison)
    expect(withComparison).toBeDefined()
    const text = explainFinding(withComparison!, 'en')
    expect(text).toContain(withComparison!.comparison!.left.value)
    expect(text).toContain(withComparison!.comparison!.right.value)
    expect(text).not.toMatch(/penalt|fine|refund will|you will owe|liable/i)
  })

  it('produces Devanagari for the Hindi variant', () => {
    const text = explainFinding(findings[0], 'hi')
    expect(text).toMatch(/[\u0900-\u097F]/)
  })
})

describe('priorityActions', () => {
  it('puts action-needed ahead of review', () => {
    const ranked = priorityActions(findings, 'en')
    const severities = ranked.map(
      (item) => findings.find((f) => f.id === item.findingId)!.severity,
    )
    const firstReview = severities.indexOf('review')
    const lastAction = severities.lastIndexOf('action-needed')
    if (firstReview !== -1 && lastAction !== -1) {
      expect(lastAction).toBeLessThan(firstReview)
    }
    expect(ranked).toHaveLength(findings.length)
  })
})

describe('draftGrievance', () => {
  it('labels itself a mock-up and disclaims any outcome', () => {
    const letter = draftGrievance(profile, findings, 'en')
    expect(letter).toContain('No AI model is called')
    expect(letter).toContain('asserts no outcome, liability, or eligibility')
    expect(letter).toContain(profile.assessmentYear)
  })
})

describe('matchQuery', () => {
  it('maps a question onto an allowlisted query name', () => {
    expect(matchQuery('which mismatch is most common?')?.name).toBe('prevalence')
    expect(matchQuery('how many records are in the corpus')?.name).toBe('corpusSize')
    expect(matchQuery('which checks show up together')?.name).toBe('cooccurrence')
  })

  it('returns nothing rather than guessing', () => {
    expect(matchQuery('')).toBeNull()
    expect(matchQuery('what is the weather in Pune')).toBeNull()
  })

  it('can only ever return an allowlisted name, even for hostile input', () => {
    const allowed = ['corpusSize', 'prevalence', 'cooccurrence', 'tables', 'views']
    const hostile = matchQuery('DROP TABLE TAXPAYER; -- show me rows')
    expect(hostile).not.toBeNull()
    expect(allowed).toContain(hostile!.name)
  })
})
