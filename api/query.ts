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
  // Built once by 03_checks.sql. The views they summarise are too large to
  // scan inside a request once the corpus passes a few million rows.
  'FINDING_FLAT',
  'PREVALENCE_SUMMARY',
  'CORPUS_SUMMARY',
  'COOCCURRENCE_SUMMARY',
] as const

const VIEWS = [
  'V_CHECK_TDS_FORM16_VS_26AS',
  'V_CHECK_CLAIMED_TDS',
  'V_CHECK_CHALLAN_NOT_CREDITED',
  'V_CHECK_DEADLINE_GAP',
  'V_CHECK_AIS_DUPLICATES',
  'V_CHECK_INTEREST_TOTAL',
  'V_CHECK_NPS_CAP',
  'V_CHECK_REBATE_SPECIAL_RATE',
  'V_CHECK_EVERIFICATION',
  'V_CHECK_REFUND_BAND',
  'V_CHECK_NOTICE_EVIDENCE',
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
               FROM PREVALENCE_SUMMARY
               ORDER BY TAXPAYERS_AFFECTED DESC`,

  cooccurrence: `SELECT CHECK_A, CHECK_B, TAXPAYERS_WITH_BOTH, PERCENT_OF_CORPUS, LIFT
                 FROM COOCCURRENCE_SUMMARY
                 ORDER BY LIFT DESC, TAXPAYERS_WITH_BOTH DESC`,

  corpusSize: `SELECT TOTAL, DISTINCT_IDS FROM CORPUS_SUMMARY`,
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

function getMockData(name: string, relation?: string, limit?: number): Record<string, unknown>[] {
  if (name === 'corpusSize') {
    return [{ TOTAL: 150000000, DISTINCT_IDS: 150000000 }]
  }

  if (name === 'prevalence') {
    return [
      { CHECK_CODE: 'V_CHECK_REBATE_SPECIAL_RATE', SEVERITY: 'action-needed', TAXPAYERS_AFFECTED: 25050000, PERCENT_OF_CORPUS: 16.7 },
      { CHECK_CODE: 'V_CHECK_DUPLICATE_AIS_ENTRY', SEVERITY: 'review', TAXPAYERS_AFFECTED: 10650000, PERCENT_OF_CORPUS: 7.1 },
      { CHECK_CODE: 'V_CHECK_NPS_EMPLOYER_CAP', SEVERITY: 'action-needed', TAXPAYERS_AFFECTED: 8850000, PERCENT_OF_CORPUS: 5.9 },
      { CHECK_CODE: 'V_CHECK_INTEREST_UNDER_DECLARED', SEVERITY: 'action-needed', TAXPAYERS_AFFECTED: 7950000, PERCENT_OF_CORPUS: 5.3 },
      { CHECK_CODE: 'V_CHECK_TDS_FORM16_VS_26AS', SEVERITY: 'action-needed', TAXPAYERS_AFFECTED: 7500000, PERCENT_OF_CORPUS: 5.0 },
      { CHECK_CODE: 'V_CHECK_CHALLAN_NOT_CREDITED', SEVERITY: 'action-needed', TAXPAYERS_AFFECTED: 6000000, PERCENT_OF_CORPUS: 4.0 },
      { CHECK_CODE: 'V_CHECK_DEADLINE_GAP', SEVERITY: 'review', TAXPAYERS_AFFECTED: 6000000, PERCENT_OF_CORPUS: 4.0 },
      { CHECK_CODE: 'V_CHECK_EVERIFICATION_PENDING', SEVERITY: 'action-needed', TAXPAYERS_AFFECTED: 6000000, PERCENT_OF_CORPUS: 4.0 },
      { CHECK_CODE: 'V_CHECK_NOTICE_UNANSWERED', SEVERITY: 'urgent', TAXPAYERS_AFFECTED: 4500000, PERCENT_OF_CORPUS: 3.0 },
    ]
  }

  if (name === 'cooccurrence') {
    return [
      { CHECK_A: 'V_CHECK_DEADLINE_GAP', CHECK_B: 'V_CHECK_CHALLAN_NOT_CREDITED', TAXPAYERS_WITH_BOTH: 6000000, PERCENT_OF_CORPUS: 4.0, LIFT: 25.0 },
      { CHECK_A: 'V_CHECK_TDS_FORM16_VS_26AS', CHECK_B: 'V_CHECK_CLAIMED_TDS', TAXPAYERS_WITH_BOTH: 3750000, PERCENT_OF_CORPUS: 2.5, LIFT: 10.0 },
      { CHECK_A: 'V_CHECK_DUPLICATE_AIS_ENTRY', CHECK_B: 'V_CHECK_INTEREST_UNDER_DECLARED', TAXPAYERS_WITH_BOTH: 5325000, PERCENT_OF_CORPUS: 3.55, LIFT: 9.4 },
    ]
  }

  if (name === 'tables') {
    return [
      { TABLE_NAME: 'RETURN_CLAIM', ROW_COUNT: 150000000, BYTES: 56371445760, UNCOMPRESSED_BYTES: 180000000000, AVG_ROW_BYTES: 375, COMPRESSION: '3.2x' },
      { TABLE_NAME: 'AIS_INTEREST', ROW_COUNT: 320000000, BYTES: 49820958720, UNCOMPRESSED_BYTES: 134400000000, AVG_ROW_BYTES: 155, COMPRESSION: '2.7x' },
      { TABLE_NAME: 'FORM16', ROW_COUNT: 150000000, BYTES: 37044092928, UNCOMPRESSED_BYTES: 112500000000, AVG_ROW_BYTES: 246, COMPRESSION: '3.0x' },
      { TABLE_NAME: 'FORM26AS', ROW_COUNT: 150000000, BYTES: 30601641984, UNCOMPRESSED_BYTES: 96000000000, AVG_ROW_BYTES: 204, COMPRESSION: '3.1x' },
      { TABLE_NAME: 'TAXPAYER', ROW_COUNT: 150000000, BYTES: 26627784704, UNCOMPRESSED_BYTES: 72000000000, AVG_ROW_BYTES: 177, COMPRESSION: '2.7x' },
      { TABLE_NAME: 'FINDING_FLAT', ROW_COUNT: 75000000, BYTES: 9663676416, UNCOMPRESSED_BYTES: 27000000000, AVG_ROW_BYTES: 128, COMPRESSION: '2.8x' },
      { TABLE_NAME: 'CHALLAN', ROW_COUNT: 45000000, BYTES: 6281389824, UNCOMPRESSED_BYTES: 17100000000, AVG_ROW_BYTES: 139, COMPRESSION: '2.7x' },
      { TABLE_NAME: 'TAX_CREDIT', ROW_COUNT: 43200000, BYTES: 5336739840, UNCOMPRESSED_BYTES: 14688000000, AVG_ROW_BYTES: 123, COMPRESSION: '2.8x' },
      { TABLE_NAME: 'SPECIAL_RATE_INCOME', ROW_COUNT: 25050000, BYTES: 2963554304, UNCOMPRESSED_BYTES: 8016000000, AVG_ROW_BYTES: 118, COMPRESSION: '2.7x' },
      { TABLE_NAME: 'NOTICE', ROW_COUNT: 4500000, BYTES: 754974720, UNCOMPRESSED_BYTES: 2250000000, AVG_ROW_BYTES: 167, COMPRESSION: '3.0x' },
      { TABLE_NAME: 'PREVALENCE_SUMMARY', ROW_COUNT: 9, BYTES: 1024, UNCOMPRESSED_BYTES: 2048, AVG_ROW_BYTES: 113, COMPRESSION: '2.0x' },
      { TABLE_NAME: 'COOCCURRENCE_SUMMARY', ROW_COUNT: 36, BYTES: 4096, UNCOMPRESSED_BYTES: 8192, AVG_ROW_BYTES: 113, COMPRESSION: '2.0x' },
      { TABLE_NAME: 'CORPUS_SUMMARY', ROW_COUNT: 1, BYTES: 128, UNCOMPRESSED_BYTES: 256, AVG_ROW_BYTES: 128, COMPRESSION: '2.0x' },
    ]
  }

  if (name === 'views') {
    return [
      { TABLE_NAME: 'V_CHECK_AIS_DUPLICATES' },
      { TABLE_NAME: 'V_CHECK_CHALLAN_NOT_CREDITED' },
      { TABLE_NAME: 'V_CHECK_CLAIMED_TDS' },
      { TABLE_NAME: 'V_CHECK_DEADLINE_GAP' },
      { TABLE_NAME: 'V_CHECK_EVERIFICATION' },
      { TABLE_NAME: 'V_CHECK_INTEREST_TOTAL' },
      { TABLE_NAME: 'V_CHECK_NOTICE_EVIDENCE' },
      { TABLE_NAME: 'V_CHECK_NPS_CAP' },
      { TABLE_NAME: 'V_CHECK_REBATE_SPECIAL_RATE' },
      { TABLE_NAME: 'V_CHECK_REFUND_BAND' },
      { TABLE_NAME: 'V_CHECK_TDS_FORM16_VS_26AS' },
      { TABLE_NAME: 'V_FINDING' },
      { TABLE_NAME: 'V_PREVALENCE' },
      { TABLE_NAME: 'V_SAMPLE_TAXPAYER' },
      { TABLE_NAME: 'V_THRESHOLD' },
    ]
  }

  if (name === 'preview') {
    const rowLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
    if (relation === 'TAXPAYER') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: i + 1,
        PAN_MASKED: `ABCDE${String(1000 + i).slice(-4)}F`,
        REGIME: i % 3 === 0 ? 'old' : 'new',
        TOTAL_INCOME_PAISE: 125000000 + i * 500000,
        DUE_DATE: '2026-07-31 23:59:00',
        FILED_ON: i % 25 === 0 ? '2026-08-01 00:14:00' : '2026-07-31 18:30:00',
        EVERIFIED_ON: i % 25 === 0 ? null : '2026-07-31 19:00:00',
      }))
    }
    if (relation === 'FORM16') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: i + 1,
        EMPLOYER_TAN: `BLRP0${String(1000 + i).slice(-4)}C`,
        GROSS_SALARY_PAISE: 120000000 + i * 500000,
        TDS_PAISE: 18640000 + (i % 20 === 3 ? 1000000 : 0),
        SECTION_80CCD_2_CAP_PERCENT: 10,
      }))
    }
    if (relation === 'FORM26AS') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: i + 1,
        DEDUCTOR_TAN: `BLRP0${String(1000 + i).slice(-4)}C`,
        TDS_PAISE: 18640000,
        BOOKED_ON: '2026-06-15',
      }))
    }
    if (relation === 'CHALLAN') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: i + 1,
        CIN: `0510308-31072026-${String(i + 1).padStart(5, '0')}`,
        AMOUNT_PAISE: 4275000,
        PAID_AT: '2026-07-31 21:40:00',
        MAJOR_HEAD: '0021',
        MINOR_HEAD: i % 5 === 0 ? '100' : '300',
      }))
    }
    if (relation === 'V_CHECK_TDS_FORM16_VS_26AS') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: (i + 1) * 20,
        CHECK_CODE: 'tds-match',
        SEVERITY: 'action-needed',
        HEADLINE: 'Form 16 and Form 26AS state different TDS',
        DETAIL: `Form 16 shows ₹1,96,400.00. Form 26AS shows ₹1,86,400.00. Difference ₹10,000.00.`,
      }))
    }
    if (relation === 'V_CHECK_AIS_DUPLICATES') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: (i + 1) * 14,
        CHECK_CODE: 'ais-duplicates',
        SEVERITY: 'action-needed',
        HEADLINE: 'The same AIS transaction appears more than once',
        DETAIL: `State Bank of India reports ₹14,200.00 on 31 Mar 2026 in 2 separate AIS entries.`,
      }))
    }
    if (relation === 'V_CHECK_REBATE_SPECIAL_RATE') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: (i + 1) * 6,
        CHECK_CODE: 'rebate-special-rate',
        SEVERITY: 'action-needed',
        HEADLINE: 'Rebate is claimed while special-rate income is present',
        DETAIL: `The return claims a rebate of ₹25,000.00 and also reports ₹1,20,000.00 under section 111A, 112A.`,
      }))
    }
    if (relation === 'V_CHECK_CHALLAN_NOT_CREDITED') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: (i + 1) * 25,
        CHECK_CODE: 'challan-credit',
        SEVERITY: 'action-needed',
        HEADLINE: 'A paid challan is not on the taxes-paid schedule',
        DETAIL: `Challan 0510308-31072026-00001 for ₹42,750.00 was paid on 31 Jul 2026 21:40 and has no matching entry in the return.`,
      }))
    }
    if (relation === 'V_CHECK_DEADLINE_GAP') {
      return Array.from({ length: rowLimit }, (_, i) => ({
        TAXPAYER_ID: (i + 1) * 25,
        CHECK_CODE: 'deadline-gap',
        SEVERITY: 'review',
        HEADLINE: 'Payment lands before the due date, submission after it',
        DETAIL: `Challan was paid 31 Jul 2026 21:40. The return was submitted 01 Aug 2026 00:14, 15 minutes after the due date.`,
      }))
    }
    if (relation === 'V_THRESHOLD') {
      return [
        { REFUND_REVIEW_BAND_PAISE: 2000000, EVERIFICATION_WINDOW_DAYS: 30 },
      ]
    }
    if (relation === 'V_SAMPLE_TAXPAYER') {
      return [
        {
          TAXPAYER_ID: 25,
          PAN_MASKED: 'ABCDE1025F',
          REGIME: 'new',
          TOTAL_INCOME_PAISE: 135000000,
          FINDINGS_COUNT: 2,
          SEVERITY_SUMMARY: '1 action-needed, 1 review',
        },
      ]
    }
    return Array.from({ length: rowLimit }, (_, i) => ({
      TAXPAYER_ID: i + 1,
      RELATION: relation,
      STATUS: 'VALIDATED',
      UPDATED_AT: '2026-08-01 00:00:00',
    }))
  }

  return []
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST' })
  }

  let resolved: { sql: string; binds: (string | number)[] }
  const { name, relation, limit } = (req.body ?? {}) as {
    name?: unknown
    relation?: unknown
    limit?: unknown
  }

  try {
    resolved = resolveQuery(req.body)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  const { SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD } = process.env

  // If Snowflake is not configured in this environment, serve synthetic corpus practice data
  if (!SNOWFLAKE_ACCOUNT || !SNOWFLAKE_USER || !SNOWFLAKE_PASSWORD) {
    const rows = getMockData(String(name), relation ? String(relation) : undefined, Number(limit))
    return res.status(200).json({ rows, rowCount: rows.length, source: 'synthetic_practice_corpus' })
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
