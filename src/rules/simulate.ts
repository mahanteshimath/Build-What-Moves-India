import type { Finding, TaxProfile } from '../domain/tax'

/** Edits a person can try against their own record copy, before touching anything real. */
export interface Adjustments {
  claimedTdsPaise: number
  declaredInterestPaise: number
  refundClaimedPaise: number
  everified: boolean
  challansCredited: boolean
  filedShiftMinutes: number
  bankPrevalidated: boolean
  deductorFiled: boolean
  panOperative: boolean
}

export function aisInterestTotal(profile: TaxProfile): number {
  return profile.aisInterest.reduce((total, entry) => total + entry.amountPaise, 0)
}

/** Adjustments that reproduce the profile exactly, so a diff against it starts empty. */
export function baselineAdjustments(profile: TaxProfile): Adjustments {
  return {
    claimedTdsPaise: profile.claimedTdsPaise,
    declaredInterestPaise: profile.declaredInterestPaise,
    refundClaimedPaise: profile.refundClaimedPaise,
    everified: profile.everifiedOn !== null,
    challansCredited:
      profile.challans.length > 0 &&
      profile.challans.every((challan) =>
        profile.taxCredits.some(
          (credit) =>
            credit.cin === challan.cin && credit.amountPaise === challan.amountPaise,
        ),
      ),
    filedShiftMinutes: 0,
    bankPrevalidated: profile.bankAccount ? profile.bankAccount.preValidated : true,
    deductorFiled: profile.deductors ? profile.deductors.every((d) => d.form16QuarterlyFiled) : true,
    panOperative: profile.panAadhaar ? profile.panAadhaar.operative : true,
  }
}

export function isBaseline(profile: TaxProfile, adjustments: Adjustments): boolean {
  const base = baselineAdjustments(profile)
  return (Object.keys(base) as (keyof Adjustments)[]).every(
    (key) => base[key] === adjustments[key],
  )
}

/** A copy of the profile with the simulated edits applied. The source is never mutated. */
export function applyAdjustments(
  profile: TaxProfile,
  adjustments: Adjustments,
): TaxProfile {
  const filedOn =
    profile.filedOn && adjustments.filedShiftMinutes !== 0
      ? new Date(
          new Date(profile.filedOn).getTime() + adjustments.filedShiftMinutes * 60_000,
        ).toISOString()
      : profile.filedOn

  return {
    ...profile,
    filedOn,
    everifiedOn: adjustments.everified ? (profile.everifiedOn ?? filedOn) : null,
    claimedTdsPaise: adjustments.claimedTdsPaise,
    declaredInterestPaise: adjustments.declaredInterestPaise,
    refundClaimedPaise: adjustments.refundClaimedPaise,
    bankAccount: profile.bankAccount
      ? {
          ...profile.bankAccount,
          preValidated: adjustments.bankPrevalidated,
          nameMatchedWithPan: adjustments.bankPrevalidated,
          evcEnabled: adjustments.bankPrevalidated,
        }
      : undefined,
    deductors: profile.deductors?.map((d) => ({
      ...d,
      form16QuarterlyFiled: adjustments.deductorFiled,
    })),
    panAadhaar: profile.panAadhaar
      ? {
          ...profile.panAadhaar,
          operative: adjustments.panOperative,
          linked: adjustments.panOperative,
        }
      : undefined,
    taxCredits: adjustments.challansCredited
      ? profile.challans.map((challan) => ({
          cin: challan.cin,
          amountPaise: challan.amountPaise,
        }))
      : profile.taxCredits,
  }
}

export type FindingStatus = 'carried' | 'cleared' | 'raised'

/** Status of every finding id across both runs: still open, gone, or newly opened. */
export function statusById(
  base: Finding[],
  simulated: Finding[],
): Map<string, FindingStatus> {
  const baseIds = new Set(base.map((finding) => finding.id))
  const status = new Map<string, FindingStatus>()

  for (const finding of base) status.set(finding.id, 'cleared')
  for (const finding of simulated) {
    status.set(finding.id, baseIds.has(finding.id) ? 'carried' : 'raised')
  }

  return status
}
