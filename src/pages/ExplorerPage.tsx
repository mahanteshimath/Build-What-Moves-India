import { useCallback, useState } from 'react'
import { CircleAlert, Database } from 'lucide-react'

// The `name` values must stay in step with the allowlist in api/query.ts.
// Sending anything else gets a 400 from the server, which is the point.
const RELATIONS = [
  { name: 'TAXPAYER', label: 'The people in our practice set' },
  { name: 'FORM16', label: 'Form 16 — salary and tax deducted, from the employer' },
  { name: 'FORM26AS', label: 'Form 26AS — tax actually credited against the PAN' },
  { name: 'RETURN_CLAIM', label: 'What was claimed in the return' },
  { name: 'AIS_INTEREST', label: 'Interest income reported by banks' },
  { name: 'CHALLAN', label: 'Tax payment receipts (challans)' },
  { name: 'TAX_CREDIT', label: 'Tax credits' },
  { name: 'SPECIAL_RATE_INCOME', label: 'Income taxed at a special rate' },
  { name: 'NOTICE', label: 'Notices received' },
  { name: 'PREVALENCE_SUMMARY', label: 'Summary — how often each problem appeared' },
  { name: 'COOCCURRENCE_SUMMARY', label: 'Summary — which problems turned up together' },
  { name: 'FINDING_FLAT', label: 'Every problem found, one line each' },
  { name: 'V_THRESHOLD', label: 'The limits each check uses' },
  { name: 'V_SAMPLE_TAXPAYER', label: 'One sample person, start to finish' },
]

const NAMED = [
  { name: 'corpusSize', label: 'How many people we tested on' },
  { name: 'prevalence', label: 'How often each problem appeared' },
  { name: 'cooccurrence', label: 'Which problems turned up together' },
  { name: 'views', label: 'The checks we run' },
  { name: 'tables', label: 'The records we compare' },
]

const COLUMN_LABELS: Record<string, string> = {
  CHECK_CODE: 'Check',
  SEVERITY: 'How serious',
  TAXPAYERS_AFFECTED: 'People affected',
  PERCENT_OF_CORPUS: 'Share of practice set',
  TABLE_NAME: 'Name',
  ROW_COUNT: 'Records',
  BYTES: 'Size',
  TOTAL: 'Total records',
  DISTINCT_IDS: 'Unique people',
  CHECK_A: 'One problem',
  CHECK_B: 'The other problem',
  TAXPAYERS_WITH_BOTH: 'People with both',
  LIFT: 'How much more often than chance',
}

type Row = Record<string, unknown>

function columnLabel(name: string): string {
  const known = COLUMN_LABELS[name]
  if (known) return known
  const words = name.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ExplorerPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [caption, setCaption] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [relation, setRelation] = useState(RELATIONS[0].name)

  const send = useCallback(async (body: Record<string, unknown>, label: string) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as {
        rows?: Row[]
        error?: string
      }
      if (!response.ok) {
        setRows([])
        setColumns([])
        setError(payload.error ?? `Request failed (${response.status})`)
        return
      }
      const received = payload.rows ?? []
      setRows(received)
      setColumns(received.length > 0 ? Object.keys(received[0]) : [])
      setCaption(label)
    } catch {
      setRows([])
      setColumns([])
      setError('Could not reach the query endpoint.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <>
      <section className="panel" aria-labelledby="explorer-heading">
        <h2 className="panel__heading" id="explorer-heading">
          <Database aria-hidden size={19} /> How we tested this
        </h2>
        <p className="panel__note">
          Before you trust the checks, here is the proof they work. We ran every
          check against a practice set of made-up taxpayer files and kept a
          record of what happened. You can look at any part of it below.
        </p>
        <p className="callout callout--warn">
          <CircleAlert aria-hidden size={17} />
          <span>
            Everything here is invented for testing. These are not real people,
            and the percentages below are not real figures about India.
          </span>
        </p>

        <div className="toolbar">
          {NAMED.map((item) => (
            <button
              key={item.name}
              type="button"
              className="button button--quiet"
              disabled={busy}
              onClick={() => send({ name: item.name }, item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <label className="field field--inline">
            <span className="field__label">Or look at one set of records</span>
            <select
              className="field__input"
              value={relation}
              onChange={(event) => setRelation(event.target.value)}
            >
              {RELATIONS.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => {
              const chosen = RELATIONS.find((item) => item.name === relation)
              send(
                { name: 'preview', relation, limit: 20 },
                `${chosen?.label ?? relation} — first 20`,
              )
            }}
          >
            Show me
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="result-heading" aria-busy={busy}>
        <h2 className="panel__heading" id="result-heading">
          {caption ?? 'Results'}
        </h2>

        {busy && <p className="panel__note">Fetching…</p>}

        {error && (
          <p className="callout callout--warn" role="alert">
            <CircleAlert aria-hidden size={17} />
            <span>
              We could not fetch the results just now. Please try again in a
              moment. Nothing on your side has gone wrong.
            </span>
          </p>
        )}

        {!busy && !error && rows.length === 0 && (
          <p className="panel__note">Pick one of the buttons above.</p>
        )}

        {rows.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((name) => (
                    <th key={name} scope="col">
                      {columnLabel(name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((name) => (
                      <td key={name}>{cell(row[name])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
