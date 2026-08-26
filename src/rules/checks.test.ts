import { describe, expect, it } from 'vitest'
import { profileById, profiles } from '../data/profiles'
import { REFUND_REVIEW_BAND_PAISE, checks, reviewProfile } from './checks'

const idsFor = (id: string) => reviewProfile(profileById(id)).map((f) => f.id)

describe('profile library', () => {
  it('covers every issue category with a distinct profile', () => {
    expect(profiles).toHaveLength(6)
    expect(new Set(profiles.map((p) => p.id)).size).toBe(6)
  })

  it('runs every check against every profile without throwing', () => {
    for (const profile of profiles) {
      expect(() => reviewProfile(profile)).not.toThrow()
      expect(reviewProfile(profile).length).toBeGreaterThan(0)
    }
  })
})

describe('challan credit', () => {
  it('flags a challan that the taxes-paid schedule does not list', () => {
    expect(idsFor('deadline-payment')).toContain(
      'challan-missing-0510308-31072026-00147',
    )
  })

  it('names an uncredited advance tax challan by its kind', () => {
    const finding = reviewProfile(profileById('refund-review')).find((f) =>
      f.id.startsWith('challan-missing-'),
    )
    expect(finding?.title).toContain('Advance tax')
  })

  it('stays silent once the schedule lists a matching credit', () => {
    expect(idsFor('clean-filing')).not.toContain(
      'challan-missing-0510902-29062026-00311',
    )
  })

  it('flags a credited challan whose amount differs', () => {
    const base = profileById('clean-filing')
    const skewed = {
      ...base,
      taxCredits: [{ cin: base.challans[0].cin, amountPaise: 1 }],
    }
    expect(reviewProfile(skewed).map((f) => f.id)).toContain(
      `challan-amount-${base.challans[0].cin}`,
    )
  })
})

describe('deadline gap', () => {
  it('reports both timestamps when payment precedes the due date but filing follows it', () => {
    const finding = reviewProfile(profileById('deadline-payment')).find(
      (f) => f.id === 'deadline-gap',
    )
    expect(finding?.comparison?.left.source).toBe('Challan receipt')
    expect(finding?.comparison?.right.source).toBe('Return acknowledgement')
  })

  it('stays silent when the return was filed before the due date', () => {
    expect(idsFor('clean-filing')).not.toContain('deadline-gap')
  })
})

describe('rebate against special-rate income', () => {
  it('flags a rebate claimed alongside special-rate income', () => {
    expect(idsFor('rebate-capital-gains')).toContain('rebate-special-rate')
  })

  it('stays silent when no special-rate income is reported', () => {
    const base = profileById('rebate-capital-gains')
    const withoutGains = { ...base, specialRateIncome: [] }
    expect(reviewProfile(withoutGains).map((f) => f.id)).not.toContain(
      'rebate-special-rate',
    )
  })
})

describe('tax deducted at source', () => {
  it('flags Form 16 disagreeing with Form 26AS', () => {
    expect(idsFor('notice-response')).toContain('tds-form16-vs-26as')
  })

  it('flags the return claiming more than Form 26AS shows', () => {
    expect(idsFor('rebate-capital-gains')).toContain('tds-claimed-vs-26as')
  })

  it('stays silent when all three records agree', () => {
    const ids = idsFor('clean-filing')
    expect(ids).not.toContain('tds-form16-vs-26as')
    expect(ids).not.toContain('tds-claimed-vs-26as')
  })
})

describe('employer contribution cap', () => {
  it('flags a claim above the Form 16 stated cap', () => {
    const finding = reviewProfile(profileById('notice-response')).find(
      (f) => f.id === 'nps-cap',
    )
    expect(finding?.comparison?.left.value).toBe('14%')
    expect(finding?.comparison?.right.value).toBe('10%')
  })

  it('stays silent when the claim matches the stated cap', () => {
    expect(idsFor('clean-filing')).not.toContain('nps-cap')
  })
})

describe('AIS entries', () => {
  it('groups repeats by payer, amount and date rather than counting rows', () => {
    const duplicates = reviewProfile(profileById('ais-duplicate')).filter((f) =>
      f.id.startsWith('ais-duplicate-'),
    )
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].detail).toContain('2 entries')
  })

  it('flags a declared interest total that differs from the AIS total', () => {
    expect(idsFor('ais-duplicate')).toContain('interest-total')
  })

  it('stays silent when the declared total matches', () => {
    expect(idsFor('clean-filing')).not.toContain('interest-total')
  })
})

describe('verification and refund band', () => {
  it('flags a submitted return with no verification date', () => {
    expect(idsFor('refund-review')).toContain('everification-pending')
  })

  it('flags a refund above the documented review band', () => {
    expect(idsFor('refund-review')).toContain('refund-band')
  })

  it('stays silent for a refund on the band boundary', () => {
    const base = profileById('clean-filing')
    const atBand = { ...base, refundClaimedPaise: REFUND_REVIEW_BAND_PAISE }
    expect(reviewProfile(atBand).map((f) => f.id)).not.toContain('refund-band')
  })
})

describe('notice evidence', () => {
  it('flags a notice naming a document that is not on record', () => {
    expect(idsFor('notice-response')).toContain('notice-missing-evidence')
  })

  it('reports ready once every named document is present', () => {
    const base = profileById('notice-response')
    const complete = {
      ...base,
      notice: base.notice && {
        ...base.notice,
        requiredDocumentIds: ['k-form16'],
      },
    }
    expect(reviewProfile(complete).map((f) => f.id)).toContain('notice-ready')
  })
})

describe('clean profile', () => {
  it('returns a single ready finding naming the number of checks run', () => {
    const findings = reviewProfile(profileById('clean-filing'))
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('ready')
    expect(findings[0].detail).toContain(`${checks.length} checks`)
  })
})
