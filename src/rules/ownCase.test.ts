import { describe, expect, it } from 'vitest'
import { reviewProfile } from './checks'
import {
  buildOwnProfile,
  emptyOwnCase,
  hasAnyFigures,
  istEndOfDay,
  istInstant,
  rupeesToPaise,
} from './ownCase'
import { profiles } from '../data/profiles'

describe('rupeesToPaise', () => {
  it('reads what a person copies off a statement', () => {
    expect(rupeesToPaise('1,23,456.78')).toBe(12345678)
    expect(rupeesToPaise('₹ 58,000')).toBe(5800000)
    expect(rupeesToPaise('12345')).toBe(1234500)
  })

  it('does not lose a paisa to floating point', () => {
    expect(rupeesToPaise('1234.56')).toBe(123456)
    expect(rupeesToPaise('0.07')).toBe(7)
    expect(rupeesToPaise('8.29')).toBe(829)
  })

  it('treats blank and unparseable input as zero rather than NaN', () => {
    expect(rupeesToPaise('')).toBe(0)
    expect(rupeesToPaise('   ')).toBe(0)
    expect(rupeesToPaise('abc')).toBe(0)
  })

  it('drops a stray minus sign, since no field here carries a negative', () => {
    expect(rupeesToPaise('-5000')).toBe(500000)
    expect(rupeesToPaise('\u20b9 -1,234.56')).toBe(123456)
  })
})

describe('impossible date orders', () => {
  it('reports a verification date earlier than the submission date', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        filedOn: '2026-08-01T10:00',
        everifiedOn: '2026-07-01T10:00',
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('verification-before-filing')
  })

  it('stays silent when verification follows submission', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        filedOn: '2026-07-01T10:00',
        everifiedOn: '2026-07-01T10:05',
      }),
    ).map((finding) => finding.id)

    expect(ids).not.toContain('verification-before-filing')
  })

  it('reports a claimed challan the receipt dates after submission', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        challanCin: 'CIN-LATE',
        challanAmount: '5000',
        challanPaidAt: '2026-09-15T10:00',
        challanListedInReturn: true,
        filedOn: '2026-07-10T10:00',
        everifiedOn: '2026-07-10T11:00',
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('credit-after-filing-CIN-LATE')
  })

  it('stays silent where the payment precedes submission', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        challanCin: 'CIN-OK',
        challanAmount: '5000',
        challanPaidAt: '2026-07-01T10:00',
        challanListedInReturn: true,
        filedOn: '2026-07-10T10:00',
        everifiedOn: '2026-07-10T11:00',
      }),
    ).map((finding) => finding.id)

    expect(ids).toEqual(['all-clear'])
  })

  it('does not report an unclaimed challan paid later, since nothing claims it', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        challanCin: 'CIN-UNCLAIMED',
        challanAmount: '5000',
        challanPaidAt: '2026-09-15T10:00',
        challanListedInReturn: false,
        filedOn: '2026-07-10T10:00',
        everifiedOn: '2026-07-10T11:00',
      }),
    ).map((finding) => finding.id)

    expect(ids).not.toContain('credit-after-filing-CIN-UNCLAIMED')
  })
})

describe('IST instants', () => {
  it('anchors a typed local time to Indian Standard Time', () => {
    expect(istInstant('2026-07-31T21:40')).toBe('2026-07-31T21:40:00+05:30')
  })

  it('returns null for an unfilled datetime', () => {
    expect(istInstant('')).toBeNull()
  })

  it('puts a due date at the end of its day', () => {
    expect(istEndOfDay('2026-07-31')).toBe('2026-07-31T23:59:00+05:30')
  })
})

describe('hasAnyFigures', () => {
  it('is false for an untouched form', () => {
    expect(hasAnyFigures(emptyOwnCase())).toBe(false)
  })

  it('turns true once a single figure is entered', () => {
    expect(hasAnyFigures({ ...emptyOwnCase(), form26asTds: '45000' })).toBe(true)
  })
})

describe('buildOwnProfile', () => {
  it('produces no findings from an empty form', () => {
    const findings = reviewProfile(buildOwnProfile(emptyOwnCase()))
    expect(findings.map((finding) => finding.id)).toEqual(['all-clear'])
  })

  it('reproduces the deadline-gap finding from Priya\u2019s figures', () => {
    // Same shape as the `deadline-payment` persona: paid before the due date,
    // submitted after it, with the challan absent from the taxes-paid schedule.
    const profile = buildOwnProfile({
      ...emptyOwnCase(),
      dueDate: '2026-07-31',
      challanCin: '0510308-31072026-00042',
      challanAmount: '48200',
      challanPaidAt: '2026-07-31T21:40',
      challanListedInReturn: false,
      filedOn: '2026-08-01T00:12',
      everifiedOn: '2026-08-01T00:20',
    })

    const ids = reviewProfile(profile).map((finding) => finding.id)
    expect(ids).toContain('deadline-gap')
    expect(ids).toContain('challan-missing-0510308-31072026-00042')
  })

  it('stays silent when the same challan is listed in the return', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        challanCin: 'CIN-1',
        challanAmount: '48200',
        challanPaidAt: '2026-07-30T10:00',
        challanListedInReturn: true,
        filedOn: '2026-07-30T11:00',
        everifiedOn: '2026-07-30T11:05',
      }),
    ).map((finding) => finding.id)

    expect(ids).toEqual(['all-clear'])
  })

  it('reports a challan credited for a different amount', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        challanCin: 'CIN-2',
        challanAmount: '48200',
        challanPaidAt: '2026-07-30T10:00',
        challanListedInReturn: true,
        challanAmountInReturn: '4820',
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('challan-amount-CIN-2')
  })

  it('compares Form 16 against Form 26AS', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        form16Tds: '96000',
        form26asTds: '72000',
        claimedTds: '96000',
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('tds-form16-vs-26as')
    expect(ids).toContain('tds-claimed-vs-26as')
  })

  it('finds a repeated AIS interest entry', () => {
    const row = { payer: 'State Bank of India', amount: '18400', reportedOn: '2026-05-20' }
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        interest: [row, { ...row }],
        declaredInterest: '18400',
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('ais-duplicate-State Bank of India-2026-05-20')
  })

  it('treats a notice document the taxpayer does not hold as missing', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        hasNotice: true,
        noticeCode: '139(9)',
        noticeTitle: 'Defective return',
        noticeRespondBy: '2026-09-15',
        noticeDocuments: [
          { label: 'Form 16 Part B', onRecord: true },
          { label: 'NPS contribution statement', onRecord: false },
        ],
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('notice-missing-evidence')
  })

  it('clears the notice once every named document is on record', () => {
    const ids = reviewProfile(
      buildOwnProfile({
        ...emptyOwnCase(),
        hasNotice: true,
        noticeCode: '139(9)',
        noticeRespondBy: '2026-09-15',
        noticeDocuments: [{ label: 'Form 16 Part B', onRecord: true }],
      }),
    ).map((finding) => finding.id)

    expect(ids).toContain('notice-ready')
    expect(ids).not.toContain('notice-missing-evidence')
  })

  it('keeps every entered amount in integer paise', () => {
    const profile = buildOwnProfile({
      ...emptyOwnCase(),
      form16Tds: '96000.55',
      refundClaimed: '58000.05',
    })

    expect(Number.isInteger(profile.form16TdsPaise)).toBe(true)
    expect(Number.isInteger(profile.refundClaimedPaise)).toBe(true)
    expect(profile.form16TdsPaise).toBe(9600055)
    expect(profile.refundClaimedPaise).toBe(5800005)
  })

  it('builds a profile carrying every field the personas use', () => {
    // Guards against the hand-entered and synthetic profile shapes drifting
    // apart: a field added to the personas must reach this form too.
    const personaKeys = new Set(profiles.flatMap((profile) => Object.keys(profile)))
    const ownKeys = new Set(Object.keys(buildOwnProfile(emptyOwnCase())))

    const missing = [...personaKeys].filter((key) => !ownKeys.has(key))
    expect(missing).toEqual([])
  })
})
