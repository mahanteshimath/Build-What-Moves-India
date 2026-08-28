import { describe, expect, it } from 'vitest'
import { profileById } from '../data/profiles'
import { reviewProfile } from './checks'
import { exhibitText } from './exhibits'
import { buildOwnProfile, emptyOwnCase } from './ownCase'

const AT = '2026-08-29T02:00:00+05:30'
const profile = profileById('deadline-payment')
const findings = reviewProfile(profile)

describe('exhibitText', () => {
  it('states on every exhibit that this is not an official document', () => {
    for (const kind of ['enivaran', 'ais', 'traces'] as const) {
      const text = exhibitText(kind, profile, findings, {}, AT)
      expect(text).toContain('not a')
      expect(text).toContain('Government of India service')
      expect(text).toContain('carries no official standing')
    }
  })

  it('carries the correction route and who must act for each difference', () => {
    const text = exhibitText('enivaran', profile, findings, {}, AT)
    expect(text).toContain('Correction route:')
    expect(text).toContain('Who has to act:')
  })

  it('shows both sides of every comparison', () => {
    const text = exhibitText('enivaran', profile, findings, {}, AT)
    const withComparison = findings.find((finding) => finding.comparison)
    expect(withComparison).toBeDefined()
    expect(text).toContain(withComparison!.comparison!.left.value)
    expect(text).toContain(withComparison!.comparison!.right.value)
  })

  it('says so plainly when nothing disagrees', () => {
    const clean = profileById('clean-filing')
    const text = exhibitText('enivaran', clean, reviewProfile(clean), {}, AT)
    expect(text).toContain('agree with each other')
  })

  it('reports repeated AIS entries using the same grouping as the check', () => {
    const duplicate = profileById('ais-duplicate')
    const text = exhibitText('ais', duplicate, reviewProfile(duplicate), {}, AT)
    expect(text).toContain('entry group(s) repeat the same payer')
  })

  it('does not claim a duplicate where entries merely share an amount', () => {
    const profileWithDistinctDates = {
      ...profileById('ais-duplicate'),
      aisInterest: [
        { id: 'a', payer: 'Bank', amountPaise: 100, reportedOn: '2026-05-01' },
        { id: 'b', payer: 'Bank', amountPaise: 100, reportedOn: '2026-06-01' },
      ],
    }
    const text = exhibitText('ais', profileWithDistinctDates, [], {}, AT)
    expect(text).toContain('No entry repeats')
  })

  it('names the deductor and whether the quarterly statement is filed', () => {
    const karan = profileById('unreflected-tds-q4')
    const text = exhibitText('traces', karan, reviewProfile(karan), {}, AT)
    expect(text).toContain('Apex Cloud Solutions India LLP')
    expect(text).toContain('Quarterly statement filed: not yet')
  })

  it('marks fingerprints that have not been computed', () => {
    const text = exhibitText('enivaran', profile, findings, {}, AT)
    expect(text).toContain('(not computed)')
  })

  it('works on a hand-entered case with nothing filled in', () => {
    const own = buildOwnProfile(emptyOwnCase())
    for (const kind of ['enivaran', 'ais', 'traces'] as const) {
      const text = exhibitText(kind, own, reviewProfile(own), {}, AT)
      expect(text).toContain('Government of India service')
      expect(text.length).toBeGreaterThan(0)
    }
  })
})
