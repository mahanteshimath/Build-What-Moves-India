# Submission — Sakshya (साक्ष्य)

**One problem: when the Income Tax e-Filing record and your own paperwork disagree, you are the one who has to prove it — and you have no way to assemble the proof.**

Independent hackathon prototype. Not a Government of India service, not affiliated with or endorsed by the Income Tax Department. All data is synthetic.

Submission window closes 10:00 PM IST, 29 August 2026.

---

## 1. Links a reviewer needs

| | |
| --- | --- |
| **Live app** (opens in a browser, no access request) | https://sakshya-for-my-tax.vercel.app |
| **Repository** | https://github.com/mahanteshimath/Build-What-Moves-India |
| **Mock sign-in** | `demo` / `sakshya-demo` — also `asha` or `ravi`, same password |
| **Partner's registered email** | _(leave blank if solo)_ |

> The sign-in is a demo gate, not a security control. The three fictional accounts ship inside the JavaScript bundle. No real identifier, password or OTP appears anywhere in the build.

### The 90-second reviewer path

The app opens on **Start Here**, and a **16-step guided walkthrough spotlights each real control in place** — the fastest way to see the whole journey. To drive it yourself:

1. Sign in with any demo account. Land on **Start Here**.
2. **Portal Issues** — six documented failure write-ups, each with an official source link.
3. **Evidentiary Brief** → profile **Priya**. Tax paid 31 July 21:40, return submitted 01 Aug 00:12. Read the finding: both timestamps, the CIN, the challan absent from the taxes-paid schedule, and who has to act.
4. Switch to **Nandini** — all 17 checks clear. The tool does not manufacture problems.
5. Scroll to the **evidence ledger** — live SHA-256 digests. Copy one. Download the ledger as text.
6. **Take this somewhere** — copy-ready text for a grievance, for AIS feedback, or for your deductor.
7. **Your Own Figures** — type your own numbers, get the same checks, then refresh and watch it all disappear.
8. **Print this brief** — a one-page carry-to-the-counter document.

---

## 2. Project summary (234 words)

Sakshya (साक्ष्य, "evidence") is an independent prototype, not a government service.

When India's Income Tax e-Filing system and a citizen's own paperwork disagree, the citizen gets a demand, not an apology. A challan paid on 31 July never reaches the taxes-paid schedule. A rebate the preparation utility accepts is disallowed at processing. The same interest entry appears twice in the AIS. In each case the citizen holds the contradicting document and has no way to assemble, timestamp or present it, so the burden of proof lands on them and they reach the helpdesk with nothing.

Sakshya builds the citizen's half of that record. Seventeen deterministic checks compare a taxpayer's own documents against each other. Each finding states one objective difference between two named records and shows both values never a verdict, never a predicted outcome, never a claim about why the portal behaved as it did. Each names the correction route and who must act: you, your deductor, or the Department. Every document is fingerprinted with SHA-256 in the browser, and the ledger exports the exact text each digest covers, so anyone can recompute it.

Read nine synthetic taxpayers, or type your own figures and get the same checks, the same fingerprints, and copy-ready text for a grievance, AIS feedback or your deductor. Nothing is uploaded or stored.

The checks are pure functions under 137 tests. No model sits in the correctness path.

---

## 3. Judged on

### Problem — is it real and important?

The portal serves roughly 14 crore registered accounts. Returns are assessed by automated rule engines, and when an engine and a citizen's paperwork disagree, the citizen is the party asked to prove it.

Six recurring failure shapes were drawn from the research corpus and are catalogued in-app under **Portal Issues**, each with a link to the official page documenting the relevant procedure:

| What the citizen experiences | The disagreement they must prove |
| --- | --- |
| A challan paid before the deadline is not in the taxes-paid schedule | The receipt says paid; the return says nothing |
| A rebate accepted while preparing is disallowed at processing | Two engines disagree with each other |
| The same interest entry appears twice in the AIS | AIS says two; the payer certificate says one |
| TDS in Form 16 never appears in Form 26AS | The employer's certificate and the statement differ |
| A 139(9) notice names a document that isn't on record | The notice and the file disagree |
| A return is submitted but never e-verified | Submitted date recorded; verification date absent |

The gap is not information — it is **evidence assembly**. Nothing in the current journey lets a citizen put their own documents side by side, timestamp them, and carry the result to a counter.

### Working build — does the main journey work?

End to end, in the browser, today:

- **Read** — 17 deterministic checks over 9 synthetic profiles, each finding naming two records and showing both values.
- **Enter your own case** — the same 17 checks over figures you type, including notices and interest rows.
- **Prove** — SHA-256 fingerprints computed live via `crypto.subtle`; the ledger downloads as text carrying the exact string each digest was taken over.
- **Act** — every finding names the correction route, the actor, and the official service that route goes through.
- **Take it away** — three copy-ready notes (grievance, AIS feedback, deductor) and a print stylesheet producing one page.
- **Track the clock** — filing due date, the 30-day e-verification window, notice response dates, all shown as days remaining.
- **Score yourself** — KarSamman readiness out of 1000, read from the same checks so it can never flatter a record the brief contradicts.
- **See the pattern** — aggregate counts over the same synthetic records held in Snowflake.

Under it: 137 tests across 10 files, ESLint clean, TypeScript strict build.

### Usability — simpler, clearer, more accessible

- **Built for a phone.** Verified with zero horizontal overflow on all six routes at a 400px CSS viewport. The tab bar scrolls rather than breaking apart.
- **Built for a slow connection.** ~129 KB of gzipped JavaScript and ~10 KB of CSS, no web fonts and no bitmap images — icons are inline SVG and type is the system font stack. After first load every check and every hash runs offline — only the "How Common" tab makes a network request, and it says so on the page.
- **Built for limited digital experience.** A 16-step guided walkthrough spotlights the real control on the real page. Findings read as "this document says X, that one says Y", not as codes. Deadlines are days, not sections. Drafting is available in English or Hindi.
- **Accessible by construction.** Skip-to-content is the first tab stop, status is carried in words as well as colour, every control has a text label, and the walkthrough is a focused dialog with arrow-key and Escape handling.

### Product thinking — the choices, and why

- **The tool never states an outcome.** It reports that two named records differ, and stops. Predicting a refund, a penalty or an approval is the one thing a citizen cannot verify, and the one thing that hurts them if it is wrong.
- **It never explains the portal's behaviour.** "Your refund is held because of X" is unknowable from outside. Every finding is phrased as an observable difference between documents the citizen holds.
- **No model in the correctness path.** The AI panel drafts wording and prioritises actions; it is labelled a mock-up and cannot change what a check reports. Determinism is what makes the brief quotable at a counter.
- **The score is derived, never asserted.** KarSamman reads the same checks as the brief, so the two can never disagree. It is not conferred by any authority, nobody else sees it, and it unlocks nothing.
- **Fingerprints, because a screenshot proves nothing.** The ledger exports the exact input string, so the digest is reproducible by the other side.
- **Sources are verified, not assumed.** A test fails if any finding cites a URL outside the 16 verified official sources.

### End-to-end thinking — beyond the interface

- **Trust boundary.** The one server component, `api/query.ts`, accepts a **query name from a fixed allowlist**, never SQL. Identifiers are checked against a known set before interpolation, because Snowflake cannot bind them. Warehouse credentials live only in Vercel environment variables, never in a `VITE_*` var that Vite would inline into the shipped bundle.
- **Data layer.** Schema, seed, checks, export and grants are versioned SQL under `snowflake/`, including a least-privilege grants script — the read path holds no write permission.
- **Correctness as infrastructure.** Every rule is a pure function with tests; money is integer paise, formatted only at the edge with `Intl.NumberFormat`; dates carry IST intent explicitly.
- **The real-world process, not just the screen.** Each finding routes to the actor who can actually fix it. A TDS mismatch is a deductor's correction filing, not a citizen's grievance — sending it to the wrong desk is how months are lost.
- **How this would scale safely.** The citizen half stays client-side, so no correspondence corpus is ever created. To handle real documents it should read them over consented official rails — an account-aggregator-style consent artefact, or a signed export the citizen initiates — never scraping, never stored credentials. The fingerprint scheme is built for that: publish the digest algorithm and the canonical input string, and any office can verify a citizen's copy without the platform ever holding it. Grievance filing should stay a copy-and-paste handoff until an official submission API exists with explicit per-submission consent.

### Honesty — what is real and what is mocked

| Area | Status |
| --- | --- |
| The 17 checks and their findings | **Real.** Pure functions, 137 tests, run in your browser. |
| SHA-256 fingerprints and the ledger | **Real.** `crypto.subtle` over the actual record text; the export lets anyone recompute. |
| Your Own Figures | **Real.** Same checks, in-tab only, cleared on refresh. |
| Print brief, grievance/AIS/deductor notes, clocks, readiness | **Real.** Computed from the same findings. |
| Taxpayer profiles, PANs, challan IDs, notices, amounts | **Mocked.** All nine are fictional. |
| Sign-in | **Mocked.** A demo gate with three bundled accounts. Not security. |
| AI assist panel and drafts | **Mocked.** Local templates behind a `nova-lite` seam, labelled in the UI. No model is called. |
| "How Common Is This" warehouse | **Real query, synthetic data.** Reads Snowflake through the allowlist endpoint. |
| Portal connection of any kind | **Absent by design.** No login, scraping, OTP, government API, filing or grievance submission. |
| Research-derived amounts and timings | **Labelled research signals**, not official facts. |

Known limits: figures typed into Your Own Figures are lost on refresh, by choice; the warehouse tab needs a network; the checks cover the six documented failure shapes, not the whole of income tax law; and the guided walkthrough finds controls by CSS selector, falling back to a centred card if a surface changes.

---

## 4. How Codex built this

Codex was the primary development tool throughout, not a finishing touch:

- Read the deep-research corpus and derived the recurring **failure shapes** that became the nine taxpayer profiles and the six issue write-ups.
- Designed the domain contracts and wrote all **17 pure checks**, plus the **137-test suite**, including the silence cases (a clean profile must produce no findings) and the boundary cases.
- Built every surface: the brief, the hand-entry form, the SHA-256 ledger, the exhibit generator, the readiness score, the warehouse explorer, the print stylesheet, and the 16-step guided walkthrough.
- Wrote the Snowflake schema and the **allowlist-only** query endpoint, and kept credentials out of anything Vite would inline into the bundle.
- Verified every official URL before citing it, and wrote the test that fails if a finding cites an unlisted source.
- Ran the safety review that produced the project's constraint list — no legal or tax outcomes, no portal-cause claims, findings limited to objective differences between two named records — and those constraints are now enforced by tests, not by good intentions.
- Caught and fixed real defects under review, including a mobile layout overflow on the warehouse tab and a walkthrough card that could land off-screen beside a tall target; the latter is now covered by its own tests.

Full detail in the Disclosure section of [README.md](README.md).

---

## 5. Compliance

- **Independent build.** Public documentation and public reporting were read to understand the problem. No portal code copied, no portal infrastructure used, no private system reverse-engineered, no undocumented API called.
- **No live government system touched.** No login, scraping, OTP handling, government API call, auto-filing or grievance submission.
- **No real personal data.** All profiles, PANs, challan identifiers, notices, amounts and credentials are fictional. No Aadhaar, PAN, password, OTP, payment or health data belonging to any real person appears anywhere in the repository.
- **No official branding.** No government emblem, seal or departmental logo. Every page states that this is an independent prototype.
- **New work for this hackathon**, built from the standard `npm create vite` React + TypeScript template.

### Libraries, all permissively licensed

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

Hosted on Vercel. Synthetic records also held in Snowflake.

---

## 6. Demo video plan (2:00)

**Minute one — the citizen journey**

| Time | Beat |
| --- | --- |
| 0:00–0:12 | Priya paid at 21:40 on 31 July. Her return records 00:12 on 1 August. The system calls it belated. She has the receipt and nowhere to put it. |
| 0:12–0:35 | Sign in, open her brief. One finding, two named records, both timestamps, the CIN, and who has to act. |
| 0:35–0:45 | Switch to Nandini: all 17 clear. It doesn't manufacture problems. |
| 0:45–0:55 | The ledger — live SHA-256 per document, downloadable as text anyone can re-hash. Then "Take this somewhere": a grievance note, ready to paste. |
| 0:55–1:00 | Your Own Figures: type your own numbers, same checks. Refresh — gone. Print — one page to carry. |

**Minute two — how and why it was built**

| Time | Beat |
| --- | --- |
| 1:00–1:15 | The rule that shapes everything: state the difference between two named records, never the outcome, never why the portal did it. Enforced by tests, not by discipline. |
| 1:15–1:35 | Codex: research corpus → six failure shapes → 17 pure checks → 137 tests → the safety review that became the constraint list. |
| 1:35–1:50 | End to end: allowlisted query names instead of SQL, credentials out of the bundle, least-privilege grants, findings routed to the actor who can actually fix them. |
| 1:50–2:00 | Independent prototype, synthetic data, no government connection, no model in the correctness path — and what it would take to run this safely at national scale. |
