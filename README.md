# Sakshya — साक्ष्य

**An independent hackathon prototype. Not a Government of India service, and not affiliated with or endorsed by the Income Tax Department.**

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

**Reconcile** — 15 deterministic checks run over a taxpayer profile, each reporting an objective difference between two named records, with both values shown side by side.

**Use your own figures** — the same 15 checks run against numbers you type in yourself, at `/my-case`. Nothing is uploaded, nothing is stored, and refreshing the page clears it.

**Act** — every finding names the correction route, who has to act on it (you, your deductor, or the Department), and links the portal service that route goes through.

**Track the clock** — the dates already on the documents (filing due date, the 30-day e-verification window, a notice response date) are shown with the plain time remaining.

**Prove** — every record is fingerprinted with SHA-256 in the browser via `crypto.subtle`, and the ledger downloads as text carrying the exact string each digest was taken over, so a third party can recompute it.

**Contest** — the whole brief prints to one page, carrying the comparisons, the records used, and the official links.

## The checks

| Check | Reports |
| --- | --- |
| `challanCredit` | A challan CIN absent from, or differing in amount from, the taxes-paid schedule |
| `deadlineGap` | Payment timestamp before the due date with a submission timestamp after it |
| `rebateOnSpecialRate` | A rebate claimed alongside income taxed at special rates |
| `tdsMatch` | Form 16 TDS against Form 26AS TDS |
| `claimedTds` | TDS claimed in the return against Form 26AS |
| `unreflectedTdsQuarter` | A quarter present in Form 16 but absent from Form 26AS |
| `npsCap` | Employer contribution claimed above the Form 16 stated cap |
| `aisDuplicates` | AIS entries repeating payer, amount and date |
| `interestDeclared` | Declared interest against the AIS total |
| `everification` | A submitted return with no verification date recorded |
| `bankAccountReadiness` | A refund claim with no validated refund bank account on record |
| `panAadhaarOperative` | An inoperative PAN against a return claiming credit |
| `demandOffsetLedger` | A demand offset with no assessment order on record |
| `refundBand` | A refund above the documented review band |
| `noticeEvidence` | Documents a notice names that are not on record |

Every check is a pure function tested in [src/rules/checks.test.ts](src/rules/checks.test.ts). No model sits in the correctness path.

A test asserts that every finding carries a remedy naming who has to act, and that every URL a remedy cites is one of the verified sources in [src/data/sources.ts](src/data/sources.ts).

## Profiles

Nine synthetic taxpayers, one per issue category: `deadline-payment`, `rebate-capital-gains`, `ais-duplicate`, `unreflected-tds-q4`, `bank-preval-stalled`, `pan-inoperative-234h`, `notice-response`, `refund-review`, and `clean-filing` — which reconciles fully and returns a ready state.

The research records two statutory due dates for AY 2026-27: 31 July for salaried and other non-audit filers, and 31 August for non-audit business and professional filers. `refund-review` files against the later one.

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
4. Switch to **Nandini** — every record agrees, all 15 checks clear.
5. Scroll to the evidence ledger and show the live SHA-256 fingerprints.
6. Open devtools, show the brief making no outbound request, then **Print this brief**.
7. Open **Your Own Figures** and type Priya’s numbers in by hand — the same three findings come back. Refresh, and they are gone.

Demo sign-in: `demo` / `sakshya-demo`. These credentials are fictional and ship inside the bundle; the gate exists to show the walkthrough, not to protect anything.

## What it is not

No portal login, scraping, OTP handling, government API calls, auto-filing, grievance submission, document persistence, or real document uploads. It states no tax or legal outcome, predicts no approval or refund, and makes no claim about why a portal behaved as it did — only that two named records differ.

Amounts documented from the local research report are labelled research signals, not official facts. Official links are limited to URLs verified reachable, held in [src/data/sources.ts](src/data/sources.ts).

All data is synthetic.

## Disclosure

**Independence.** Sakshya is an independent build for this hackathon. Public documentation and public reporting about the e-Filing portal were read to understand the problem; no portal code was copied, no portal infrastructure was used, and no private system was reverse-engineered.

**No live government system.** There is no portal login, scraping, OTP handling, government API call, auto-filing, or grievance submission. Every record is a simulated integration over synthetic data.

**No real data.** All nine taxpayer profiles, PANs, challan identifiers, notices and amounts are fictional. The demo sign-in credentials are fictional. No real identifier, password, OTP or payment detail appears anywhere in the repository.

**No official branding.** No government emblem, seal or departmental logo is used. The header states on every page that this is an independent prototype.

**How Codex contributed.** Codex was the primary development tool for this build:

- Read the deep-research corpus in `Deep Research On ALL Web Sites/` and derived the recurring failure shapes that became the profiles.
- Designed the domain contracts in `src/domain/tax.ts` and the fifteen pure checks in `src/rules/checks.ts`.
- Wrote the test suite in `src/rules/checks.test.ts`, including the silence and boundary cases.
- Built the React surfaces, the SHA-256 evidence ledger, and the print stylesheet.
- Wrote `snowflake/*.sql` and the allowlist-only `api/query.ts` endpoint.
- Ran the safety review that produced the constraints in [AGENTS.md](AGENTS.md) — no legal or tax outcomes, no portal-cause claims, findings limited to objective differences between two named records.

**Third-party components**, all under permissive licences:

| Component | Licence | Use |
| --- | --- | --- |
| React, React DOM | MIT | UI |
| React Router | MIT | Routing |
| Vite, `@vitejs/plugin-react` | MIT | Build |
| TypeScript | Apache-2.0 | Types |
| Vitest | MIT | Tests |
| ESLint, `typescript-eslint` | MIT | Lint |
| `lucide-react` | ISC | Icons |
| `snowflake-sdk` | Apache-2.0 | Read-only warehouse queries in `api/query.ts` |

Scaffolded from the standard `npm create vite` React + TypeScript template.

**Network behaviour.** The brief, the checks and the fingerprints are computed entirely in the browser. The optional Data Explorer tab is the only network path: it posts a query *name* from a fixed allowlist to `/api/query`, which runs a read-only statement against a Snowflake warehouse holding the same synthetic records. No SQL crosses the wire and no credential is present in the bundle.
