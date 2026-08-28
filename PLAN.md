# Sakshya — build plan

Scope: Income Tax e-Filing only. Browser-only, synthetic data, deterministic checks.

## Positioning

Not a filing utility. Filing utilities are the diverging frontends whose logic differs from the processing engine. Sakshya builds the citizen's side of the evidentiary record: reconcile before filing, prove while filing, contest when a notice arrives.

## Milestones

- [x] Extract and analyse the Income Tax portal research
- [x] Domain contracts in `src/domain/tax.ts` — profile, document, challan, notice, finding, comparison, paise and date formatters
- [x] Six synthetic profiles in `src/data/profiles.ts`, one per issue category
- [x] Verified official URLs isolated in `src/data/sources.ts`
- [x] Eleven pure checks in `src/rules/checks.ts`
- [x] Twenty-four tests in `src/rules/checks.test.ts`, including silence cases and boundary cases
- [x] Three surfaces in `src/App.tsx` — situation picker, findings with two-value comparisons, evidence ledger
- [x] In-browser SHA-256 fingerprinting via `crypto.subtle`
- [x] Print brief via `window.print()` with print-only stylesheet
- [x] Retire the superseded EPFO and GST scenario code
- [x] `npm run test`, `npm run lint`, `npm run build` all clean

## Issue coverage

| Research issue | Checks |
| --- | --- |
| Challan sync latency, section 234F exposure | `challanCredit`, `deadlineGap` |
| Section 87A rebate against special-rate income | `rebateOnSpecialRate` |
| Aadhaar OTP and e-verification window | `everification` |
| AIS, Form 26AS and Form 16 mismatches | `tdsMatch`, `claimedTds`, `npsCap`, `aisDuplicates`, `interestDeclared` |
| Advance tax not carried into the return | `challanCredit` |
| Refund review holds | `refundBand` |
| Defective return notices | `noticeEvidence` |

Legacy demand revival under section 245 is represented as a ledger gap rather than a check, since the taxpayer's position there is the *absence* of an assessment order.

## Constraints held

- Findings state objective differences between two named records, never an outcome, eligibility, liability, or portal cause.
- Research-report figures are labelled research signals.
- Money stored as integer paise, formatted with `Intl.NumberFormat`.
- The brief makes no network calls; only the Data Explorer tab reads the hosted synthetic warehouse through `/api/query`.

## Possible next steps

- Import a real document to hash locally, with the file never leaving the browser.
- Persist the ledger to a user-chosen file via the File System Access API, still with no server.
- Add a countdown against the response date recorded on a notice.
