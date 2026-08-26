# Sakshya Project Instructions

## Product

Sakshya is an independent, browser-only prototype that assembles a taxpayer's own side of the evidentiary record for Income Tax e-Filing. It runs deterministic checks over synthetic taxpayer profiles, fingerprints each record in the browser, and produces a printable brief. Scope is Income Tax only.

## Safety and Scope

- Keep `Deep Research On ALL Web Sites/` unchanged; it is research input, not application data.
- Use only synthetic, anonymized records in the demo.
- Do not add portal login, web scraping, OTP handling, government API calls, auto-filing, grievance submission, document persistence, or real document uploads.
- Do not state legal/tax outcomes, predict approvals/refunds, or claim a portal's internal cause. Describe only objective record differences, missing evidence, and documented technical prerequisites.
- Every guided action must identify an official source URL. Mark local research findings as research signals, not verified official facts.

## Implementation

- Prefer a static React + TypeScript + Vite application with no backend or external runtime dependency.
- Keep business checks pure and deterministic under `src/rules/`; add a focused test for every new non-trivial rule.
- Keep synthetic profiles in `src/data/` and product contracts in `src/domain/`. Official URLs live only in `src/data/sources.ts`, and only if verified reachable.
- Store money as integer paise. Format with `Intl.NumberFormat`, never by hand.
- A finding states an objective difference between two named records. Safe: "Form 16 shows X, Form 26AS shows Y." Unsafe: "you will be fined", "your refund is held because of risk management."
- Use native browser capabilities where sufficient, including `window.print()` for support briefs.
- Maintain accessible keyboard flows, text labels alongside color, and responsive layouts without overlapping content.

## Verification

After meaningful changes, run the narrow relevant check first. Before completion, run:

```powershell
npm run test
npm run lint
npm run build
```

Do not commit or push unless explicitly asked.
