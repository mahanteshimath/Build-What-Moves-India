import snowflake from 'snowflake-sdk'

// Only the surface this handler touches. @vercel/node supplies these types but
// drags in 95 packages and 5 advisories to do it.
type ApiRequest = { method?: string; body?: unknown }
type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

// The app's demo login is client-side, so it protects nothing here — this
// endpoint is reachable by anyone. It therefore accepts a query NAME, never
// SQL, and every identifier is checked against the fixed sets below.

const TABLES = [
  'TAXPAYER',
  'FORM16',
  'FORM26AS',
  'RETURN_CLAIM',
  'AIS_INTEREST',
  'CHALLAN',
  'TAX_CREDIT',
  'SPECIAL_RATE_INCOME',
  'NOTICE',
] as const

const VIEWS = [
  'V_PREVALENCE',
  'V_FINDING',
  'V_THRESHOLD',
  'V_SAMPLE_TAXPAYER',
] as const

const RELATIONS: ReadonlySet<string> = new Set<string>([...TABLES, ...VIEWS])

const NAMED_QUERIES: Record<string, string> = {
  tables: `SELECT TABLE_NAME, ROW_COUNT, BYTES
           FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = 'SCH' AND TABLE_TYPE = 'BASE TABLE'
           ORDER BY TABLE_NAME`,

  views: `SELECT TABLE_NAME
          FROM INFORMATION_SCHEMA.VIEWS
          WHERE TABLE_SCHEMA = 'SCH'
          ORDER BY TABLE_NAME`,

  prevalence: `SELECT CHECK_CODE, SEVERITY, TAXPAYERS_AFFECTED, PERCENT_OF_CORPUS
               FROM V_PREVALENCE
               ORDER BY TAXPAYERS_AFFECTED DESC`,

  corpusSize: `SELECT COUNT(*) AS TOTAL, COUNT(DISTINCT TAXPAYER_ID) AS DISTINCT_IDS
               FROM TAXPAYER`,
}

snowflake.configure({ logLevel: 'ERROR' })

/**
 * The driver wants a bare account identifier. Pasting the console URL instead
 * fails as ERR_SF_RESPONSE_FAILURE (401002), which looks nothing like a config
 * error, so tolerate the URL forms.
 */
function accountIdentifier(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\.snowflakecomputing\.com.*$/i, '')
    .replace(/\/.*$/, '')
}

function connect(): Promise<snowflake.Connection> {
  const {
    SNOWFLAKE_ACCOUNT,
    SNOWFLAKE_USER,
    SNOWFLAKE_PASSWORD,
    SNOWFLAKE_WAREHOUSE,
    SNOWFLAKE_DATABASE = 'DB',
    SNOWFLAKE_SCHEMA = 'SCH',
    SNOWFLAKE_ROLE,
  } = process.env

  if (!SNOWFLAKE_ACCOUNT || !SNOWFLAKE_USER || !SNOWFLAKE_PASSWORD) {
    throw new Error('Snowflake environment variables are not configured')
  }

  const connection = snowflake.createConnection({
    account: accountIdentifier(SNOWFLAKE_ACCOUNT),
    username: SNOWFLAKE_USER,
    password: SNOWFLAKE_PASSWORD,
    warehouse: SNOWFLAKE_WAREHOUSE,
    database: SNOWFLAKE_DATABASE,
    schema: SNOWFLAKE_SCHEMA,
    role: SNOWFLAKE_ROLE,
    clientSessionKeepAlive: false,
  })

  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => (err ? reject(err) : resolve(conn)))
  })
}

function run(
  connection: snowflake.Connection,
  sqlText: string,
  binds: (string | number)[] = [],
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) =>
        err ? reject(err) : resolve((rows ?? []) as Record<string, unknown>[]),
    })
  })
}

/** Resolves the request to SQL, or throws if it is not on the allowlist. */
function resolveQuery(body: unknown): { sql: string; binds: (string | number)[] } {
  const { name, relation, limit } = (body ?? {}) as {
    name?: unknown
    relation?: unknown
    limit?: unknown
  }

  if (typeof name !== 'string') throw new Error('Missing query name')

  if (name === 'preview') {
    if (typeof relation !== 'string' || !RELATIONS.has(relation)) {
      throw new Error('Unknown relation')
    }
    const rows = Math.min(Math.max(Number(limit) || 20, 1), 100)
    // relation is a member of RELATIONS, so this interpolation cannot carry
    // caller input; Snowflake cannot bind an identifier.
    return { sql: `SELECT * FROM ${relation} LIMIT ${rows}`, binds: [] }
  }

  const sql = NAMED_QUERIES[name]
  if (!sql) throw new Error('Unknown query name')
  return { sql, binds: [] }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST' })
  }

  let resolved: { sql: string; binds: (string | number)[] }
  try {
    resolved = resolveQuery(req.body)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  let connection: snowflake.Connection | undefined
  try {
    connection = await connect()
    const rows = await run(connection, resolved.sql, resolved.binds)
    return res.status(200).json({ rows, rowCount: rows.length })
  } catch (error) {
    // Snowflake messages can name accounts and objects, so only the numeric
    // code goes back to the caller. 390100 bad credentials, 390201 no such
    // warehouse, 390189 no such role, 401001 could not connect,
    // 401002 host answered but refused the request. Full message is in the
    // Vercel runtime log.
    const { code } = error as { code?: string | number }
    console.error('query failed', error)
    return res
      .status(502)
      .json({ error: 'Query failed against Snowflake', code: code ?? null })
  } finally {
    connection?.destroy(() => undefined)
  }
}
