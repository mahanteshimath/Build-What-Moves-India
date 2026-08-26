# Sakshya — साक्ष्य

**The taxpayer's side of the evidentiary record, for Income Tax e-Filing.**

When an automated system and your own paperwork disagree, the system issues a demand — not an apology. The burden of proof lands on you. Sakshya assembles your half of that record.

## The problem

India's Income Tax e-Filing portal has 14.28 crore registered accounts and 8–9 crore active filers. Returns are assessed by automated rule engines, with 1.25 crore verified returns in the processing queue at the time of writing.

The recurring failures documented in the research all share one shape:

| What happens | The disagreement |
| --- | --- |
| Challan paid before the deadline doesn't reach the taxes-paid schedule | Your receipt says paid; the return says nothing |
| Rebate accepted in the preparation utility, disallowed at processing | Two engines disagree |
| Employer contribution claimed above the Form 16 stated cap | Return says 14%; Form 16 says 10% |
| The same interest entry appears twice in the AIS | AIS says two; the payer certificate says one |
| Return submitted but never e-verified | Submitted date recorded; verification date absent |
| Advance tax in Form 26AS never pre-fills into the return | Statement says paid; schedule says nothing |

In each case the citizen holds the contradicting record and has no way to **assemble, timestamp, or present** it. That is the gap Sakshya fills.

## What it does

**Reconcile** — 11 deterministic checks run over a taxpayer profile, each reporting an objective difference between two named records, with both values shown side by side.

**Prove** — every record is fingerprinted with SHA-256 in the browser via `crypto.subtle`, so the copy you hold can be shown to be the copy you captured.

**Contest** — the whole brief prints to one page through `window.print()`, carrying the comparisons, the records used, and the official links.

## The checks

| Check | Reports |
| --- | --- |
| `challanCredit` | A challan CIN absent from, or differing in amount from, the taxes-paid schedule |
| `deadlineGap` | Payment timestamp before the due date with a submission timestamp after it |
| `rebateOnSpecialRate` | A rebate claimed alongside income taxed at special rates |
| `tdsMatch` | Form 16 TDS against Form 26AS TDS |
| `claimedTds` | TDS claimed in the return against Form 26AS |
| `npsCap` | Employer contribution claimed above the Form 16 stated cap |
| `aisDuplicates` | AIS entries repeating payer, amount and date |
| `interestDeclared` | Declared interest against the AIS total |
| `everification` | A submitted return with no verification date recorded |
| `refundBand` | A refund above the documented review band |
| `noticeEvidence` | Documents a notice names that are not on record |

Every check is a pure function tested in [src/rules/checks.test.ts](src/rules/checks.test.ts). No model sits in the correctness path.

## Profiles

Six synthetic taxpayers, one per issue category: `deadline-payment`, `rebate-capital-gains`, `ais-duplicate`, `notice-response`, `refund-review`, and `clean-filing` — which reconciles fully and returns a ready state.

## Run it

```powershell
npm install
npm run dev
```

Checks:

```powershell
npm run test
npm run lint
npm run build
```

## Demo in two minutes

1. Open with **Priya** — tax paid 31 July 21:40, return submitted 01 Aug 00:12.
2. Read the timeline finding: both timestamps, the gap, the CIN, and the challan absent from the schedule.
3. Switch to **Kavita** — a section 139(9) notice naming a document that isn't on record, with the response date.
4. Switch to **Nandini** — every record agrees, all 11 checks clear.
5. Scroll to the evidence ledger and show the live SHA-256 fingerprints.
6. Open devtools, show zero outbound requests, then **Print this brief**.

## What it is not

No portal login, scraping, OTP handling, government API calls, auto-filing, grievance submission, document persistence, or real document uploads. It states no tax or legal outcome, predicts no approval or refund, and makes no claim about why a portal behaved as it did — only that two named records differ.

Amounts documented from the local research report are labelled research signals, not official facts. Official links are limited to URLs verified reachable, held in [src/data/sources.ts](src/data/sources.ts).

All data is synthetic.
