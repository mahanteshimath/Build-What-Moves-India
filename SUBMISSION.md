# Submission — Sakshya

Everything the hackathon form asks for, ready to copy. Deadline: 28 August 2026, 8:00 PM IST.

## Live public browser link

```
https://sakshya-for-my-tax.vercel.app
```

## Mock consumer credentials

```
Username: demo
Password: sakshya-demo
```

> Fictional demo-gate credentials, shipped inside the JavaScript bundle. Not a security control. No real identifier, password or OTP appears anywhere in the build.

`asha` and `ravi` also work with the same password.

## Project summary (249 words)

Sakshya (साक्ष्य, "evidence") is an independent hackathon prototype. It is not a government service.

When India's Income Tax e-Filing system and a citizen's own paperwork disagree, the system issues a demand — not an apology. A challan paid on 31 July never reaches the taxes-paid schedule. A rebate the preparation utility accepts is disallowed at processing. The same interest entry appears twice in the AIS. In every case the citizen holds the contradicting record and has no way to assemble, timestamp or present it. The burden of proof lands on them, and they arrive at the helpdesk with nothing.

Sakshya builds the citizen's half of that record. Fifteen deterministic checks compare a taxpayer's own documents against each other, each reporting one objective difference between two named records with both values shown — never a verdict, never a predicted outcome, never a claim about why the portal behaved. Every finding names the correction route and who must act: you, your deductor, or the Department. Each document is fingerprinted with SHA-256 in the browser, and the ledger exports carrying the exact text each digest was taken over, so anyone can recompute it.

Browse nine synthetic taxpayers, or enter your own figures and get the same checks, the same fingerprints, and a copy-ready grievance note. Nothing is uploaded or stored; refreshing clears it.

The checks are pure functions with 93 tests; no model sits in the correctness path.

No portal login, scraping, OTP handling, government API, or auto-filing. All data is fictional.

## How Codex contributed

Codex was the primary development tool. It read the deep-research corpus and derived the recurring failure shapes that became the taxpayer profiles; designed the domain contracts and the fifteen pure checks; wrote the 93-test suite including the silence and boundary cases; built the React surfaces, the hand-entry form, the SHA-256 evidence ledger, the grievance-note generator and the print stylesheet; verified every official URL before citing it, and wrote the test that fails if a finding cites an unlisted one; wrote the Snowflake SQL and the allowlist-only query endpoint; and ran the safety review that produced the project's constraint list — no legal or tax outcomes, no portal-cause claims, findings limited to objective differences between two named records.

Full detail in the Disclosure section of [README.md](README.md).

## Other tools and libraries

All under permissive licences:

| Component | Licence | Use |
| --- | --- | --- |
| React, React DOM | MIT | UI |
| React Router | MIT | Routing |
| Vite, `@vitejs/plugin-react` | MIT | Build |
| TypeScript | Apache-2.0 | Types |
| Vitest | MIT | Tests |
| ESLint, `typescript-eslint` | MIT | Lint |
| `lucide-react` | ISC | Icons |
| `snowflake-sdk` | Apache-2.0 | Read-only warehouse queries |

Scaffolded from the standard `npm create vite` React + TypeScript template. Hosted on Vercel; synthetic records also held in Snowflake.

## Compliance statements

- **Independent build.** Public documentation and reporting about the e-Filing portal were read to understand the problem. No portal code was copied, no portal infrastructure used, no private system reverse-engineered.
- **No live government system.** No portal login, scraping, OTP handling, government API call, auto-filing or grievance submission. Every record is a simulated integration over synthetic data.
- **No real user data.** All nine profiles, PANs, challan identifiers, notices and amounts are fictional.
- **No official branding.** No government emblem, seal or departmental logo. Every page states that this is an independent prototype.

## Demo video (2 minutes)

| Time | Beat |
| --- | --- |
| 0:00–0:10 | Priya paid 31 July 21:40. Return submitted 1 Aug 00:12. The portal says she filed late. |
| 0:10–0:50 | Sign in as `demo`. Read one finding showing both values and the CIN, and the route that corrects it. Switch to Kavita (139(9) notice naming a document not on record). Switch to Nandini (all fifteen clear — the tool doesn't manufacture problems). |
| 0:50–1:00 | Open **Your Own Figures**, type the same numbers in by hand, and get the same findings plus a copy-ready grievance note. Refresh: everything is gone. |
| 1:00–1:20 | Why this shape: every finding names two records and shows both numbers. Never predicts an outcome. Enforced by the tests. |
| 1:20–1:45 | How Codex built it — research corpus → failure shapes → fifteen checks → 93 tests → the safety review. |
| 1:45–2:00 | Independent prototype, synthetic data, no government connection, no model in the correctness path. |

## Repository

```
https://github.com/mahanteshimath/Build-What-Moves-India
```
