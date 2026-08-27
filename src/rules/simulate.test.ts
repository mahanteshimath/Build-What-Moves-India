import { describe, expect, it } from 'vitest'
import { profileById, profiles } from '../data/profiles'
import { reviewProfile } from './checks'
import {
  aisInterestTotal,
  applyAdjustments,
  baselineAdjustments,
  isBaseline,
  statusById,
} from './simulate'

const idsOf = (profile: Parameters<typeof reviewProfile>[0]) =>
  reviewProfile(profile).map((finding) => finding.id)

describe('baseline', () => {
  it('reproduces every profile exactly, so an untouched simulation shows no change', () => {
    for (const profile of profiles) {
      const adjustments = baselineAdjustments(profile)
      expect(isBaseline(profile, adjustments)).toBe(true)
      expect(idsOf(applyAdjustments(profile, adjustments))).toEqual(idsOf(profile))
    }
  })

  it('leaves the source profile untouched', () => {
    const profile = profileById('deadline-payment')
    const before = JSON.stringify(profile)
    applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      challansCredited: true,
      claimedTdsPaise: 1,
    })
    expect(JSON.stringify(profile)).toBe(before)
  })
})

describe('adjustments clear the finding they address', () => {
  it('crediting the challan clears the missing-credit finding', () => {
    const profile = profileById('deadline-payment')
    const cin = profile.challans[0].cin
    expect(idsOf(profile)).toContain(`challan-missing-${cin}`)

    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      challansCredited: true,
    })
    expect(idsOf(simulated)).not.toContain(`challan-missing-${cin}`)
  })

  it('matching claimed TDS to Form 26AS clears the mismatch', () => {
    const profile = profileById('rebate-capital-gains')
    expect(idsOf(profile)).toContain('tds-claimed-vs-26as')

    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      claimedTdsPaise: profile.form26asTdsPaise,
    })
    expect(idsOf(simulated)).not.toContain('tds-claimed-vs-26as')
  })

  it('matching declared interest to the AIS total clears the mismatch', () => {
    const profile = profiles.find((item) =>
      idsOf(item).includes('interest-total'),
    )!
    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      declaredInterestPaise: aisInterestTotal(profile),
    })
    expect(idsOf(simulated)).not.toContain('interest-total')
  })

  it('moving submission before the due date clears the deadline gap', () => {
    const profile = profileById('deadline-payment')
    expect(idsOf(profile)).toContain('deadline-gap')

    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      filedShiftMinutes: -60,
    })
    expect(idsOf(simulated)).not.toContain('deadline-gap')
  })

  it('dropping the e-verification date raises the pending finding', () => {
    const profile = profileById('clean-filing')
    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      everified: false,
    })
    expect(idsOf(simulated)).toContain('everification-pending')
  })

  it('toggling bank pre-validation clears the stalled refund finding', () => {
    const profile = profileById('bank-preval-stalled')
    expect(idsOf(profile)).toContain('bank-prevalidation-failed')

    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      bankPrevalidated: true,
    })
    expect(idsOf(simulated)).not.toContain('bank-prevalidation-failed')
  })

  it('toggling deductor filed clears unreflected TDS finding', () => {
    const profile = profileById('unreflected-tds-q4')
    expect(idsOf(profile)).toContain('tds-unreflected-DELK08192E')

    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      deductorFiled: true,
    })
    expect(idsOf(simulated)).not.toContain('tds-unreflected-DELK08192E')
  })

  it('toggling PAN operative status clears the Section 234H finding', () => {
    const profile = profileById('pan-inoperative-234h')
    expect(idsOf(profile)).toContain('pan-aadhaar-inoperative')

    const simulated = applyAdjustments(profile, {
      ...baselineAdjustments(profile),
      panOperative: true,
    })
    expect(idsOf(simulated)).not.toContain('pan-aadhaar-inoperative')
  })
})

describe('statusById', () => {
  it('marks findings as cleared, carried or raised', () => {
    const profile = profileById('deadline-payment')
    const base = reviewProfile(profile)
    const simulated = reviewProfile(
      applyAdjustments(profile, {
        ...baselineAdjustments(profile),
        challansCredited: true,
        everified: false,
      }),
    )
    const status = statusById(base, simulated)

    expect(status.get(`challan-missing-${profile.challans[0].cin}`)).toBe('cleared')
    expect(status.get('deadline-gap')).toBe('carried')
    expect(status.get('everification-pending')).toBe('raised')
  })
})
