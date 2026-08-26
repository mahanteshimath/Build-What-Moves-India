import { useCallback, useState } from 'react'
import { CircleAlert, Database } from 'lucide-react'

// Must stay in step with the allowlist in api/query.ts. Sending anything else
// gets a 400 from the server, which is the point.
const RELATIONS = [
  'TAXPAYER',
  'FORM16',
  'FORM26AS',
  'RETURN_CLAIM',
  'AIS_INTEREST',
  'CHALLAN',
  'TAX_CREDIT',
  'SPECIAL_RATE_INCOME',
  'NOTICE',
  'V_PREVALENCE',
  'V_FINDING',
  'V_THRESHOLD',
  'V_SAMPLE_TAXPAYER',
]

const NAMED = [
  { name: 'tables', label: 'Tables' },
  { name: 'views', label: 'Views' },
  { name: 'prevalence', label: 'Check prevalence' },
  { name: 'corpusSize', label: 'Corpus size' },
]

type Row = Record<string, unknown>

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
  const [relation, setRelation] = useState(RELATIONS[0])

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
          <Database aria-hidden size={19} /> Snowflake explorer
        </h2>
        <p className="panel__note">
          Runs against the synthetic corpus built by the scripts in{' '}
          <code>snowflake/</code>. The browser sends a query <em>name</em>; the
          server holds the SQL and the credentials. Arbitrary SQL is not
          accepted, because this endpoint is reachable without signing in.
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
            <span className="field__label">Preview a relation</span>
            <select
              className="field__input"
              value={relation}
              onChange={(event) => setRelation(event.target.value)}
            >
              {RELATIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() =>
              send({ name: 'preview', relation, limit: 20 }, `${relation} (first 20 rows)`)
            }
          >
            Preview
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="result-heading" aria-busy={busy}>
        <h2 className="panel__heading" id="result-heading">
          {caption ?? 'Result'}
        </h2>

        {busy && <p className="panel__note">Querying Snowflake…</p>}

        {error && (
          <p className="callout callout--warn" role="alert">
            <CircleAlert aria-hidden size={17} />
            <span>
              {error} If this says the query failed, the most likely causes are
              that the Snowflake environment variables are not set on the
              deployment, or the warehouse is suspended.
            </span>
          </p>
        )}

        {!busy && !error && rows.length === 0 && (
          <p className="panel__note">Choose a query above.</p>
        )}

        {rows.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((name) => (
                    <th key={name} scope="col">
                      {name}
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
