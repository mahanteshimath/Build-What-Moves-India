import { describe, expect, it } from 'vitest'
import { profileById, profiles } from '../data/profiles'
import { officialSources } from '../data/sources'
import type { CivicRecord, TaxProfile } from '../domain/tax'
import { reviewProfile } from './checks'
import {
  EMPTY_CIVIC,
  MAX_SCORE,
  PROTECTIONS,
  TIERS,
  protectionsEarned,
  readinessFor,
  tierFor,
} from './readiness'

const score = (profile: TaxProfile) => readinessFor(profile, reviewProfile(profile)).score

const withCivic = (profile: TaxProfile, civic: Partial<CivicRecord>): TaxProfile => ({
  ...profile,
  civic: { ...EMPTY_CIVIC, ...civic },
})

describe('tiers', () => {
  it('covers 0 to 1000 with no gap and no overlap', () => {
    expect(TIERS[0].min).toBe(0)
    expect(TIERS[TIERS.length - 1].max).toBe(MAX_SCORE)
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i].min).toBe(TIERS[i - 1].max + 1)
    }
  })

  it('resolves a tier for every score in range', () => {
    for (let value = 0; value <= MAX_SCORE; value += 1) {
      expect(tierFor(value)).toBeDefined()
    }
  })

  it('clamps scores outside the range rather than returning nothing', () => {
    expect(tierFor(-50).level).toBe(1)
    expect(tierFor(5000).level).toBe(10)
  })

  it('places the documented tier boundaries on the right level', () => {
    expect(tierFor(299).english).toBe('Aarambh')
    expect(tierFor(300).english).toBe('Nagarik')
    expect(tierFor(499).english).toBe('Nagarik')
    expect(tierFor(500).english).toBe('Nirmata')
    expect(tierFor(699).english).toBe('Nirmata')
    expect(tierFor(700).english).toBe('Rakshak')
    expect(tierFor(849).english).toBe('Rakshak')
    expect(tierFor(850).english).toBe('Rashtra Mitra')
  })
})

describe('score bounds', () => {
  it('never exceeds the maximum for any profile, however generous the civic record', () => {
    const generous: CivicRecord = {
      consecutiveOnTimeYears: 40,
      advanceTaxInstalmentsPaid: 9,
      tdsCoveredFullLiability: true,
      literacyQuizCompleted: true,
      budgetConsultationSubmitted: true,
      portalOpenedOn: '2026-04-01T00:00:00+05:30',
    }
    for (const profile of profiles) {
      const value = score(withCivic(profile, generous))
      expect(value).toBeLessThanOrEqual(MAX_SCORE)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('never goes negative on nonsense civic input', () => {
    const nonsense = withCivic(profileById('clean-filing'), {
      consecutiveOnTimeYears: -5,
      advanceTaxInstalmentsPaid: -3,
    })
    expect(score(nonsense)).toBeGreaterThanOrEqual(0)
  })

  it('every factor stays within its own maximum', () => {
    for (const profile of profiles) {
      const { factors } = readinessFor(profile, reviewProfile(profile))
      for (const factor of factors) {
        expect(factor.earned).toBeLessThanOrEqual(factor.max)
        expect(factor.earned).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('sums the factors exactly, with no hidden adjustment', () => {
    for (const profile of profiles) {
      const { factors, score: total } = readinessFor(profile, reviewProfile(profile))
      expect(factors.reduce((sum, f) => sum + f.earned, 0)).toBe(total)
    }
  })
})

describe('timeliness derives from the actual filing record', () => {
  it('awards nothing where no submission date is recorded', () => {
    const profile = { ...profileById('clean-filing'), filedOn: null, everifiedOn: null }
    const factor = readinessFor(profile, reviewProfile(profile)).factors[0]
    expect(factor.earned).toBe(0)
  })

  it('awards the belated amount where the return went in after the due date', () => {
    // Priya filed 01 Aug against a 31 July due date.
    const profile = profileById('deadline-payment')
    const factor = readinessFor(profile, reviewProfile(profile)).factors[0]
    expect(factor.earned).toBe(50)
  })

  it('awards the on-time amount without an early-filing window', () => {
    const profile = withCivic(profileById('clean-filing'), { portalOpenedOn: undefined })
    const factor = readinessFor(profile, reviewProfile(profile)).factors[0]
    expect(factor.earned).toBe(200)
  })

  it('adds the early-filing bonus only inside the 30-day window', () => {
    const clean = profileById('clean-filing')
    const filedAt = new Date(clean.filedOn ?? '').getTime()

    const inside = withCivic(clean, {
      portalOpenedOn: new Date(filedAt - 10 * 86_400_000).toISOString(),
    })
    const outside = withCivic(clean, {
      portalOpenedOn: new Date(filedAt - 60 * 86_400_000).toISOString(),
    })

    expect(readinessFor(inside, reviewProfile(inside)).factors[0].earned).toBe(300)
    expect(readinessFor(outside, reviewProfile(outside)).factors[0].earned).toBe(200)
  })
})

describe('accuracy derives from the findings, not from a separate flag', () => {
  it('withholds the accuracy points where two records disagree', () => {
    // Kavita's Form 16 and Form 26AS disagree on TDS.
    const profile = profileById('notice-response')
    const factor = readinessFor(profile, reviewProfile(profile)).factors[2]
    expect(factor.earned).toBeLessThan(factor.max)
  })

  it('awards the accuracy points where every record agrees', () => {
    const profile = profileById('clean-filing')
    const factor = readinessFor(profile, reviewProfile(profile)).factors[2]
    expect(factor.earned).toBe(200)
  })

  it('cannot contradict the brief: a clean profile outscores a mismatched one', () => {
    expect(score(profileById('clean-filing'))).toBeGreaterThan(
      score(profileById('notice-response')),
    )
  })

  it('withholds verification points where verification came more than a day later', () => {
    const clean = profileById('clean-filing')
    const late = {
      ...clean,
      everifiedOn: new Date(
        new Date(clean.filedOn ?? '').getTime() + 5 * 86_400_000,
      ).toISOString(),
    }
    expect(readinessFor(late, reviewProfile(late)).factors[2].earned).toBe(120)
  })
})

describe('streak', () => {
  it('awards 50 points a year', () => {
    const profile = withCivic(profileById('clean-filing'), { consecutiveOnTimeYears: 3 })
    expect(readinessFor(profile, reviewProfile(profile)).factors[1].earned).toBe(150)
  })

  it('caps at five years', () => {
    const profile = withCivic(profileById('clean-filing'), { consecutiveOnTimeYears: 12 })
    expect(readinessFor(profile, reviewProfile(profile)).factors[1].earned).toBe(250)
  })
})

describe('advance tax', () => {
  it('awards the full amount for four instalments', () => {
    const profile = withCivic(profileById('clean-filing'), { advanceTaxInstalmentsPaid: 4 })
    expect(readinessFor(profile, reviewProfile(profile)).factors[3].earned).toBe(150)
  })

  it('awards the full amount where TDS covered the liability', () => {
    const profile = withCivic(profileById('clean-filing'), { tdsCoveredFullLiability: true })
    expect(readinessFor(profile, reviewProfile(profile)).factors[3].earned).toBe(150)
  })

  it('awards the partial amount for some instalments', () => {
    const profile = withCivic(profileById('clean-filing'), { advanceTaxInstalmentsPaid: 2 })
    expect(readinessFor(profile, reviewProfile(profile)).factors[3].earned).toBe(75)
  })
})

describe('boosters', () => {
  it('offers the largest available gain first', () => {
    const profile = profileById('deadline-payment')
    const { boosters } = readinessFor(profile, reviewProfile(profile))
    const points = boosters.map((factor) => factor.nextStep?.points ?? 0)
    expect(points).toEqual([...points].sort((a, b) => b - a))
  })

  it('offers nothing once every factor is at maximum', () => {
    const clean = profileById('clean-filing')
    const perfect = withCivic(clean, {
      consecutiveOnTimeYears: 5,
      advanceTaxInstalmentsPaid: 4,
      tdsCoveredFullLiability: true,
      literacyQuizCompleted: true,
      budgetConsultationSubmitted: true,
      portalOpenedOn: new Date(
        new Date(clean.filedOn ?? '').getTime() - 5 * 86_400_000,
      ).toISOString(),
    })
    const result = readinessFor(perfect, reviewProfile(perfect))
    expect(result.score).toBe(MAX_SCORE)
    expect(result.boosters).toHaveLength(0)
  })
})

describe('protections', () => {
  it('cites only official sources already on record', () => {
    const known = new Set(officialSources.map((source) => source.url))
    for (const protection of PROTECTIONS) {
      expect(known, `${protection.id} cites an unlisted URL`).toContain(protection.source.url)
    }
  })

  it('marks a protection held only where its factor is at maximum', () => {
    const profile = profileById('deadline-payment')
    const readiness = readinessFor(profile, reviewProfile(profile))
    for (const { protection, held } of protectionsEarned(readiness)) {
      const factor = readiness.factors.find((item) => item.id === protection.factor)
      expect(held).toBe(factor?.earned === factor?.max)
    }
  })

  it('describes a consequence rather than promising a reward', () => {
    // Guards the framing: these are things evidence answers, not benefits granted.
    for (const protection of PROTECTIONS) {
      expect(protection.title.toLowerCase()).not.toMatch(/discount|coupon|reward|offer|lounge/)
    }
  })
})
