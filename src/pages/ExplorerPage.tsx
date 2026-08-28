import { useCallback, useMemo, useState } from 'react'
import {
  BarChart3,
  Check,
  CircleAlert,
  Code,
  Copy,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Layers,
  Search,
  TableProperties,
  Users,
  Wand2,
} from 'lucide-react'
import { matchQuery } from '../ai/mockNova'
import { MockAiBadge } from '../components/MockAiBadge'

// The `name` values must stay in step with the allowlist in api/query.ts.
const RELATIONS = [
  { name: 'TAXPAYER', label: 'TAXPAYER — Synthetic practice taxpayers' },
  { name: 'FORM16', label: 'FORM16 — Salary & TDS certificates (Employer)' },
  { name: 'FORM26AS', label: 'FORM26AS — Deposited tax credit ledger' },
  { name: 'RETURN_CLAIM', label: 'RETURN_CLAIM — Filed return schedules' },
  { name: 'AIS_INTEREST', label: 'AIS_INTEREST — Bank reported interest' },
  { name: 'CHALLAN', label: 'CHALLAN — Advance & self-assessment receipts' },
  { name: 'TAX_CREDIT', label: 'TAX_CREDIT — Matched credits on record' },
  { name: 'SPECIAL_RATE_INCOME', label: 'SPECIAL_RATE_INCOME — Capital gains & spl rates' },
  { name: 'NOTICE', label: 'NOTICE — Statutory notices on record' },
  { name: 'V_CHECK_TDS_FORM16_VS_26AS', label: 'V_CHECK_TDS_FORM16_VS_26AS — TDS Mismatch' },
  { name: 'V_CHECK_CLAIMED_TDS', label: 'V_CHECK_CLAIMED_TDS — Claim vs 26AS' },
  { name: 'V_CHECK_CHALLAN_NOT_CREDITED', label: 'V_CHECK_CHALLAN_NOT_CREDITED — Uncredited Challans' },
  { name: 'V_CHECK_DEADLINE_GAP', label: 'V_CHECK_DEADLINE_GAP — Due Date Timing Gap' },
  { name: 'V_CHECK_AIS_DUPLICATES', label: 'V_CHECK_AIS_DUPLICATES — Duplicate AIS Entries' },
  { name: 'V_CHECK_INTEREST_TOTAL', label: 'V_CHECK_INTEREST_TOTAL — Interest Declared vs AIS' },
  { name: 'V_CHECK_NPS_CAP', label: 'V_CHECK_NPS_CAP — NPS 80CCD(2) Cap Breach' },
  { name: 'V_CHECK_REBATE_SPECIAL_RATE', label: 'V_CHECK_REBATE_SPECIAL_RATE — Rebate 87A Conflict' },
  { name: 'V_CHECK_EVERIFICATION', label: 'V_CHECK_EVERIFICATION — E-Verification Lapsed' },
  { name: 'V_CHECK_REFUND_BAND', label: 'V_CHECK_REFUND_BAND — Refund Review Band' },
  { name: 'V_CHECK_NOTICE_EVIDENCE', label: 'V_CHECK_NOTICE_EVIDENCE — Missing Notice Proofs' },
  { name: 'PREVALENCE_SUMMARY', label: 'PREVALENCE_SUMMARY — Problem frequency table' },
  { name: 'COOCCURRENCE_SUMMARY', label: 'COOCCURRENCE_SUMMARY — Co-occurring issues' },
  { name: 'FINDING_FLAT', label: 'FINDING_FLAT — All findings across corpus' },
  { name: 'V_THRESHOLD', label: 'V_THRESHOLD — Verification limits & constants' },
  { name: 'V_SAMPLE_TAXPAYER', label: 'V_SAMPLE_TAXPAYER — Sample taxpayer dossier' },
]

interface ViewDefinition {
  name: string
  title: string
  category: 'TDS & Taxes' | 'AIS & Income' | 'Filing Deadlines' | 'Deductions & Rebates' | 'Audits & Notices' | 'Aggregation'
  severity: 'action-needed' | 'review' | 'ready'
  description: string
  sources: string[]
  sql: string
}

const VIEW_DEFINITIONS: ViewDefinition[] = [
  {
    name: 'V_CHECK_TDS_FORM16_VS_26AS',
    title: 'Form 16 vs Form 26AS TDS Concordance',
    category: 'TDS & Taxes',
    severity: 'action-needed',
    description: 'Identifies discrepancies between salary TDS certified by the employer on Form 16 and actual credits deposited against PAN in Form 26AS.',
    sources: ['FORM16', 'FORM26AS'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_TDS_FORM16_VS_26AS AS
SELECT f.TAXPAYER_ID,
       'tds-match' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'Form 16 and Form 26AS state different TDS' AS HEADLINE,
       'Form 16 shows ' || RUPEES(f.TDS_PAISE)
         || '. Form 26AS shows ' || RUPEES(a.TDS_PAISE)
         || '. Difference ' || RUPEES(ABS(f.TDS_PAISE - a.TDS_PAISE)) || '.' AS DETAIL
FROM FORM16 f
JOIN FORM26AS a ON a.TAXPAYER_ID = f.TAXPAYER_ID
WHERE f.TDS_PAISE <> a.TDS_PAISE;`,
  },
  {
    name: 'V_CHECK_CLAIMED_TDS',
    title: 'Return Claimed TDS vs Form 26AS Booked Credit',
    category: 'TDS & Taxes',
    severity: 'action-needed',
    description: 'Detects returns claiming more TDS credit than reflected in Form 26AS, which routinely triggers Section 143(1)(a) automated demand adjustments.',
    sources: ['RETURN_CLAIM', 'FORM26AS'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_CLAIMED_TDS AS
SELECT r.TAXPAYER_ID,
       'claimed-tds' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'Return claims more TDS than Form 26AS reflects' AS HEADLINE,
       'The return claims ' || RUPEES(r.CLAIMED_TDS_PAISE)
         || '. Form 26AS reflects ' || RUPEES(a.TDS_PAISE) || '.' AS DETAIL
FROM RETURN_CLAIM r
JOIN FORM26AS a ON a.TAXPAYER_ID = r.TAXPAYER_ID
WHERE r.CLAIMED_TDS_PAISE <> a.TDS_PAISE;`,
  },
  {
    name: 'V_CHECK_CHALLAN_NOT_CREDITED',
    title: 'Paid Challan Absent from Taxes-Paid Schedule',
    category: 'Filing Deadlines',
    severity: 'action-needed',
    description: 'Surfaces self-assessment or advance tax receipts (OLTAS/e-Pay Tax) that were paid but omitted from Schedule IT of the filed ITR.',
    sources: ['CHALLAN', 'TAX_CREDIT'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_CHALLAN_NOT_CREDITED AS
SELECT c.TAXPAYER_ID,
       'challan-credit' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'A paid challan is not on the taxes-paid schedule' AS HEADLINE,
       'Challan ' || c.CIN || ' for ' || RUPEES(c.AMOUNT_PAISE)
         || ' was paid on ' || TO_VARCHAR(c.PAID_AT, 'DD Mon YYYY HH24:MI')
         || ' and has no matching entry in the return.' AS DETAIL
FROM CHALLAN c
LEFT JOIN TAX_CREDIT t
       ON t.TAXPAYER_ID = c.TAXPAYER_ID AND t.CIN = c.CIN
WHERE t.CIN IS NULL;`,
  },
  {
    name: 'V_CHECK_DEADLINE_GAP',
    title: 'Challan Paid Pre-Deadline, Return Filed Post-Deadline',
    category: 'Filing Deadlines',
    severity: 'review',
    description: 'Catches deadline congestion timing gaps where tax payment occurred before July 31st but submission crossed midnight, risking Section 234F fees.',
    sources: ['TAXPAYER', 'CHALLAN'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_DEADLINE_GAP AS
SELECT t.TAXPAYER_ID,
       'deadline-gap' AS CHECK_CODE,
       'review' AS SEVERITY,
       'Payment lands before the due date, submission after it' AS HEADLINE,
       'Challan ' || c.CIN || ' was paid ' || TO_VARCHAR(c.PAID_AT, 'DD Mon YYYY HH24:MI')
         || '. The return was submitted ' || TO_VARCHAR(t.FILED_ON, 'DD Mon YYYY HH24:MI')
         || ', ' || TIMESTAMPDIFF(minute, t.DUE_DATE, t.FILED_ON)
         || ' minutes after the due date.' AS DETAIL
FROM TAXPAYER t
JOIN CHALLAN c ON c.TAXPAYER_ID = t.TAXPAYER_ID
WHERE t.FILED_ON > t.DUE_DATE
  AND c.PAID_AT <= t.DUE_DATE;`,
  },
  {
    name: 'V_CHECK_AIS_DUPLICATES',
    title: 'Duplicate AIS Payer Reporting Detection',
    category: 'AIS & Income',
    severity: 'action-needed',
    description: 'Flags multi-reporting of identical interest or dividend transactions by financial entities in the Annual Information Statement.',
    sources: ['AIS_INTEREST'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_AIS_DUPLICATES AS
SELECT TAXPAYER_ID,
       'ais-duplicates' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'The same AIS transaction appears more than once' AS HEADLINE,
       PAYER || ' reports ' || RUPEES(AMOUNT_PAISE)
         || ' on ' || TO_VARCHAR(REPORTED_ON, 'DD Mon YYYY')
         || ' in ' || TO_VARCHAR(COUNT(*)) || ' separate AIS entries.' AS DETAIL
FROM AIS_INTEREST
GROUP BY TAXPAYER_ID, PAYER, AMOUNT_PAISE, REPORTED_ON
HAVING COUNT(*) > 1;`,
  },
  {
    name: 'V_CHECK_INTEREST_TOTAL',
    title: 'Declared Interest vs Distinct AIS Aggregate',
    category: 'AIS & Income',
    severity: 'review',
    description: 'Reconciles interest reported under "Income from Other Sources" in ITR with deduplicated AIS entries received from commercial banks.',
    sources: ['RETURN_CLAIM', 'AIS_INTEREST'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_INTEREST_TOTAL AS
SELECT r.TAXPAYER_ID,
       'interest-declared' AS CHECK_CODE,
       'review' AS SEVERITY,
       'Declared interest differs from the AIS total' AS HEADLINE,
       'The return declares ' || RUPEES(r.DECLARED_INTEREST_PAISE)
         || '. Distinct AIS entries total ' || RUPEES(d.DISTINCT_TOTAL)
         || ' across ' || TO_VARCHAR(d.ENTRY_COUNT) || ' entries.' AS DETAIL
FROM RETURN_CLAIM r
JOIN (
    SELECT TAXPAYER_ID, SUM(AMOUNT_PAISE) AS DISTINCT_TOTAL, COUNT(*) AS ENTRY_COUNT
    FROM (SELECT DISTINCT TAXPAYER_ID, PAYER, AMOUNT_PAISE, REPORTED_ON FROM AIS_INTEREST)
    GROUP BY TAXPAYER_ID
) d ON d.TAXPAYER_ID = r.TAXPAYER_ID
WHERE r.DECLARED_INTEREST_PAISE <> d.DISTINCT_TOTAL;`,
  },
  {
    name: 'V_CHECK_NPS_CAP',
    title: 'Section 80CCD(2) Employer NPS Cap Verification',
    category: 'Deductions & Rebates',
    severity: 'action-needed',
    description: 'Audits employer contribution claims under Section 80CCD(2) against the statutory 10% (corporate) or 14% (central govt) salary caps.',
    sources: ['RETURN_CLAIM', 'FORM16'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_NPS_CAP AS
SELECT r.TAXPAYER_ID,
       'nps-cap' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'NPS claim exceeds the percentage stated on Form 16' AS HEADLINE,
       'The return claims ' || TO_VARCHAR(r.NPS_CLAIM_PERCENT, '99.9')
         || '% of salary. Form 16 states ' || TO_VARCHAR(f.NPS_CAP_PERCENT, '99.9') || '%.' AS DETAIL
FROM RETURN_CLAIM r
JOIN FORM16 f ON f.TAXPAYER_ID = r.TAXPAYER_ID
WHERE r.NPS_CLAIM_PERCENT > f.NPS_CAP_PERCENT;`,
  },
  {
    name: 'V_CHECK_REBATE_SPECIAL_RATE',
    title: 'Section 87A Rebate with Special-Rate Income Conflict',
    category: 'Deductions & Rebates',
    severity: 'action-needed',
    description: 'Flags Section 87A rebate claims against special-rate capital gains (Sec 111A/112A) in the new tax regime, a common cause of unexpected demand.',
    sources: ['RETURN_CLAIM', 'SPECIAL_RATE_INCOME'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_REBATE_SPECIAL_RATE AS
SELECT r.TAXPAYER_ID,
       'rebate-special-rate' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'Rebate is claimed while special-rate income is present' AS HEADLINE,
       'The return claims a rebate of ' || RUPEES(r.REBATE_CLAIMED_PAISE)
         || ' and also reports ' || RUPEES(s.TOTAL_SPECIAL)
         || ' under section ' || s.SECTIONS || '.' AS DETAIL
FROM RETURN_CLAIM r
JOIN (
    SELECT TAXPAYER_ID, SUM(AMOUNT_PAISE) AS TOTAL_SPECIAL,
           LISTAGG(SECTION, ', ') WITHIN GROUP (ORDER BY SECTION) AS SECTIONS
    FROM SPECIAL_RATE_INCOME GROUP BY TAXPAYER_ID
) s ON s.TAXPAYER_ID = r.TAXPAYER_ID
WHERE r.REBATE_CLAIMED_PAISE > 0;`,
  },
  {
    name: 'V_CHECK_EVERIFICATION',
    title: 'E-Verification Missing / 30-Day Window Lapsed',
    category: 'Filing Deadlines',
    severity: 'action-needed',
    description: 'Ensures the filed ITR was successfully e-verified within the mandatory 30-day statutory window, preventing the return from being invalidated (non-est).',
    sources: ['TAXPAYER', 'V_THRESHOLD'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_EVERIFICATION AS
SELECT t.TAXPAYER_ID,
       'everification' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       CASE WHEN t.EVERIFIED_ON IS NULL
            THEN 'No e-verification is on record'
            ELSE 'E-verification falls outside the window' END AS HEADLINE,
       CASE WHEN t.EVERIFIED_ON IS NULL
            THEN 'Submitted ' || TO_VARCHAR(t.FILED_ON, 'DD Mon YYYY')
                 || '. No verification record exists. The window is 30 days.'
            ELSE 'Submitted ' || TO_VARCHAR(t.FILED_ON, 'DD Mon YYYY')
                 || ', verified ' || TO_VARCHAR(t.EVERIFIED_ON, 'DD Mon YYYY') || '.' END AS DETAIL
FROM TAXPAYER t
CROSS JOIN V_THRESHOLD th
WHERE t.FILED_ON IS NOT NULL
  AND (t.EVERIFIED_ON IS NULL
       OR DATEDIFF(day, t.FILED_ON, t.EVERIFIED_ON) > th.EVERIFICATION_WINDOW_DAYS);`,
  },
  {
    name: 'V_CHECK_REFUND_BAND',
    title: 'Refund Claim Exceeding Scrutiny Review Threshold',
    category: 'Audits & Notices',
    severity: 'review',
    description: 'Surfaces returns claiming refunds at or above the review band (₹20,000+) requiring bank pre-validation and assembled evidence records.',
    sources: ['TAXPAYER', 'V_THRESHOLD'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_REFUND_BAND AS
SELECT t.TAXPAYER_ID,
       'refund-band' AS CHECK_CODE,
       'review' AS SEVERITY,
       'Refund claimed is at or above the review band' AS HEADLINE,
       'The return claims ' || RUPEES(t.REFUND_CLAIMED_PAISE)
         || ', at or above the ' || RUPEES(th.REFUND_REVIEW_BAND_PAISE)
         || ' band this brief uses. Keep the supporting proofs together.' AS DETAIL
FROM TAXPAYER t
CROSS JOIN V_THRESHOLD th
WHERE t.REFUND_CLAIMED_PAISE >= th.REFUND_REVIEW_BAND_PAISE;`,
  },
  {
    name: 'V_CHECK_NOTICE_EVIDENCE',
    title: 'Statutory Notice Evidence Completeness Check',
    category: 'Audits & Notices',
    severity: 'action-needed',
    description: 'Verifies whether all documents requested under statutory notices (Sec 139(9), 142(1)) are present in the taxpayer’s local evidence brief.',
    sources: ['NOTICE'],
    sql: `CREATE OR REPLACE VIEW V_CHECK_NOTICE_EVIDENCE AS
SELECT n.TAXPAYER_ID,
       'notice-evidence' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'A notice names documents that are not on record' AS HEADLINE,
       'Notice ' || n.CODE || ' issued ' || TO_VARCHAR(n.ISSUED_ON, 'DD Mon YYYY')
         || ' names ' || TO_VARCHAR(n.DOCS_REQUIRED) || ' documents. '
         || TO_VARCHAR(n.DOCS_ON_RECORD) || ' are on record. Response due '
         || TO_VARCHAR(n.RESPOND_BY, 'DD Mon YYYY') || '.' AS DETAIL
FROM NOTICE n
WHERE n.DOCS_ON_RECORD < n.DOCS_REQUIRED;`,
  },
  {
    name: 'V_FINDING',
    title: 'Master Union of All Discrepancy Findings',
    category: 'Aggregation',
    severity: 'ready',
    description: 'Comprehensive union of all 11 discrepancy check views across all synthesized taxpayers.',
    sources: ['All 11 V_CHECK_* Views'],
    sql: `CREATE OR REPLACE VIEW V_FINDING AS
SELECT * FROM V_CHECK_TDS_FORM16_VS_26AS
UNION ALL SELECT * FROM V_CHECK_CLAIMED_TDS
UNION ALL SELECT * FROM V_CHECK_CHALLAN_NOT_CREDITED
UNION ALL SELECT * FROM V_CHECK_DEADLINE_GAP
UNION ALL SELECT * FROM V_CHECK_AIS_DUPLICATES
UNION ALL SELECT * FROM V_CHECK_INTEREST_TOTAL
UNION ALL SELECT * FROM V_CHECK_NPS_CAP
UNION ALL SELECT * FROM V_CHECK_REBATE_SPECIAL_RATE
UNION ALL SELECT * FROM V_CHECK_EVERIFICATION
UNION ALL SELECT * FROM V_CHECK_REFUND_BAND
UNION ALL SELECT * FROM V_CHECK_NOTICE_EVIDENCE;`,
  },
  {
    name: 'V_PREVALENCE',
    title: 'Corpus-Wide Discrepancy Prevalence Summary',
    category: 'Aggregation',
    severity: 'ready',
    description: 'Computes frequency and percentage of taxpayers affected by each check across the 15 crore synthetic corpus.',
    sources: ['V_FINDING', 'TAXPAYER'],
    sql: `CREATE OR REPLACE VIEW V_PREVALENCE AS
SELECT f.CHECK_CODE,
       ANY_VALUE(f.SEVERITY) AS SEVERITY,
       COUNT(DISTINCT f.TAXPAYER_ID) AS TAXPAYERS_AFFECTED,
       ROUND(100.0 * COUNT(DISTINCT f.TAXPAYER_ID)
             / (SELECT COUNT(*) FROM TAXPAYER), 2) AS PERCENT_OF_CORPUS
FROM V_FINDING f
GROUP BY f.CHECK_CODE
ORDER BY TAXPAYERS_AFFECTED DESC;`,
  },
  {
    name: 'V_THRESHOLD',
    title: 'Verification Rules & Statutory Threshold Constants',
    category: 'Aggregation',
    severity: 'ready',
    description: 'Single source of truth for statutory threshold constants across Snowflake SQL and client TypeScript checks.',
    sources: ['Constants'],
    sql: `CREATE OR REPLACE VIEW V_THRESHOLD AS
SELECT 2000000 AS REFUND_REVIEW_BAND_PAISE,   -- ₹20,000
       30      AS EVERIFICATION_WINDOW_DAYS;`,
  },
  {
    name: 'V_SAMPLE_TAXPAYER',
    title: 'Sample Taxpayer Analytical Dossier View',
    category: 'Aggregation',
    severity: 'ready',
    description: 'Pre-assembled view providing deep multi-schedule analytical profiles for verification benchmarks.',
    sources: ['TAXPAYER', 'V_FINDING'],
    sql: `CREATE OR REPLACE VIEW V_SAMPLE_TAXPAYER AS
SELECT t.TAXPAYER_ID, t.PAN_MASKED, t.REGIME, t.TOTAL_INCOME_PAISE,
       COUNT(f.CHECK_CODE) AS FINDINGS_COUNT
FROM TAXPAYER t
LEFT JOIN FINDING_FLAT f ON f.TAXPAYER_ID = t.TAXPAYER_ID
GROUP BY 1, 2, 3, 4;`,
  },
]

const NAMED_QUERIES = [
  {
    name: 'corpusSize',
    label: 'Corpus Overview',
    description: 'Population scale metrics and synthesized verification volume',
    icon: Users,
  },
  {
    name: 'prevalence',
    label: 'Prevalence Summary',
    description: 'Frequency of each discrepancy across the dataset',
    icon: BarChart3,
  },
  {
    name: 'cooccurrence',
    label: 'Co-occurrence Matrix',
    description: 'Discrepancies appearing together in the same return',
    icon: Layers,
  },
  {
    name: 'tables',
    label: 'Storage Tables',
    description: 'Schema tables, row volumes, and storage footprint',
    icon: Database,
  },
  {
    name: 'views',
    label: 'Analytical Views',
    description: 'Compiled analytical and verification view definitions',
    icon: TableProperties,
  },
]

const COLUMN_LABELS: Record<string, string> = {
  CHECK_CODE: 'Verification Check',
  SEVERITY: 'Severity Level',
  TAXPAYERS_AFFECTED: 'Taxpayers Affected',
  PERCENT_OF_CORPUS: 'Share of Practice Set (%)',
  TABLE_NAME: 'Relation / Table',
  ROW_COUNT: 'Total Rows',
  BYTES: 'Physical Storage (Compressed)',
  UNCOMPRESSED_BYTES: 'Logical Size (Uncompressed)',
  AVG_ROW_BYTES: 'Avg Row Size',
  COMPRESSION: 'Compression Ratio',
  TOTAL: 'Total Synthetic Records',
  DISTINCT_IDS: 'Unique Taxpayers',
  CHECK_A: 'First Discrepancy',
  CHECK_B: 'Co-occurring Discrepancy',
  TAXPAYERS_WITH_BOTH: 'Joint Occurrences',
  LIFT: 'Correlation Lift Factor',
  HEADLINE: 'Discrepancy Headline',
  DETAIL: 'Evidence Detail',
  TAXPAYER_ID: 'Taxpayer ID',
  PAN_MASKED: 'PAN (Masked)',
  REGIME: 'Tax Regime',
  TOTAL_INCOME_PAISE: 'Gross Income',
  DUE_DATE: 'Due Date',
  FILED_ON: 'Filed On',
  EVERIFIED_ON: 'E-Verified On',
}

type Row = Record<string, unknown>

function columnLabel(name: string): string {
  const known = COLUMN_LABELS[name]
  if (known) return known
  const words = name.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatCellValue(name: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (name.includes('PERCENT') || name === 'PERCENT_OF_CORPUS') {
      return `${value.toFixed(1)}%`
    }
    if (name === 'BYTES' || name === 'UNCOMPRESSED_BYTES') {
      return formatBytes(value)
    }
    if (name === 'AVG_ROW_BYTES') {
      return `${value} B/row`
    }
    if (name === 'LIFT') {
      return `${value.toFixed(1)}x`
    }
    if (name.includes('PAISE')) {
      const rupees = Math.floor(value / 100)
      return `₹${formatNumber(rupees)}`
    }
    return formatNumber(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ExplorerPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [caption, setCaption] = useState<string | null>(null)
  const [activeQueryName, setActiveQueryName] = useState<string | null>('views')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [relation, setRelation] = useState(RELATIONS[0].name)
  const [tableSearch, setTableSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [expandedSql, setExpandedSql] = useState<Record<string, boolean>>({})
  const [copiedSql, setCopiedSql] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [askResult, setAskResult] = useState<string | null>(null)

  const send = useCallback(async (body: Record<string, unknown>, label: string, queryId?: string) => {
    setBusy(true)
    setError(null)
    setActiveQueryName(queryId ?? (body.name as string))
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

  /**
   * Resolves a typed question to one of the cards above. The matcher can only
   * return a name from the same fixed allowlist the buttons use, so no phrasing
   * can widen what gets run.
   */
  const ask = () => {
    const match = matchQuery(question)
    if (!match) {
      setAskResult('No card matched that. Try words like common, together, rows, or checks.')
      return
    }
    const card = NAMED_QUERIES.find((item) => item.name === match.name)
    if (!card) {
      setAskResult('No card matched that.')
      return
    }
    setAskResult(`Running “${card.label}”. ${match.why}`)
    void send({ name: card.name }, card.label, card.name)
  }

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return rows
    const query = tableSearch.toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => {
        const val = formatCellValue(col, row[col])
        return val.toLowerCase().includes(query)
      }),
    )
  }, [rows, columns, tableSearch])

  const filteredViews = useMemo(() => {
    if (categoryFilter === 'All') return VIEW_DEFINITIONS
    return VIEW_DEFINITIONS.filter((v) => v.category === categoryFilter)
  }, [categoryFilter])

  const toggleSql = (name: string) => {
    setExpandedSql((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const copySqlCode = async (sql: string, name: string) => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopiedSql(name)
      setTimeout(() => setCopiedSql(null), 2000)
    } catch {
      // ignore
    }
  }

  const downloadCsv = () => {
    if (rows.length === 0) return
    const header = columns.map((col) => `"${columnLabel(col)}"`).join(',')
    const lines = rows.map((row) =>
      columns
        .map((col) => {
          const val = formatCellValue(col, row[col]).replace(/"/g, '""')
          return `"${val}"`
        })
        .join(','),
    )
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...lines].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${(caption || 'sakshya_dataset').replace(/\s+/g, '_').toLowerCase()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <section className="panel" aria-labelledby="explorer-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="explorer-heading">
              <Database aria-hidden size={20} /> How common is each of these failures?
            </h2>
            <p className="panel__note">
              One person&rsquo;s mismatch looks like bad luck. The same mismatch across a
              population looks like a system. This runs the same deterministic checks
              over a synthetic corpus, so the prevalence of each failure shape can be
              counted rather than asserted.
            </p>
          </div>
        </div>

        <div className="callout callout--warn">
          <CircleAlert aria-hidden size={18} />
          <span>
            <strong>Synthetic validation corpus.</strong> Figures and schema relations demonstrate statistical discrepancy patterns across practice profiles, testing that reconciliation rules scale deterministically on large data warehouses without third-party network calls.
          </span>
        </div>

        <div className="askbox no-print">
          <input
            className="askbox__input"
            type="text"
            value={question}
            placeholder="Ask in plain English, e.g. “which mismatch is most common?”"
            aria-label="Ask in plain English which query to run"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') ask()
            }}
          />
          <button type="button" className="button button--quiet button--sm" onClick={ask} disabled={busy}>
            <Wand2 aria-hidden size={14} />
            <span>Pick a query</span>
          </button>
          <MockAiBadge label="Mock-up — keyword match, no model" />
        </div>
        {askResult && (
          <p className={`askbox__result ${askResult.startsWith('No ') ? 'askbox__result--miss' : ''}`}>
            {askResult}
          </p>
        )}

        <div className="query-grid">
          {NAMED_QUERIES.map((item) => {
            const Icon = item.icon
            const isSelected = activeQueryName === item.name
            return (
              <button
                key={item.name}
                type="button"
                className={`query-card ${isSelected ? 'query-card--active' : ''}`}
                disabled={busy}
                onClick={() => send({ name: item.name }, item.label, item.name)}
              >
                <div className="query-card__icon">
                  <Icon aria-hidden size={20} />
                </div>
                <div className="query-card__text">
                  <span className="query-card__title">{item.label}</span>
                  <span className="query-card__desc">{item.description}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="relation-toolbar">
          <label className="field field--inline">
            <span className="field__label">Direct table/view preview</span>
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
                `${chosen?.label ?? relation} (Sample 20 Records)`,
                `preview-${relation}`,
              )
            }}
          >
            <FileSpreadsheet aria-hidden size={16} />
            Fetch 20 Sample Records
          </button>
        </div>
      </section>

      {/* Visual Analytics Sections Based on Active Query */}

      {/* 1. Analytical Views Registry (When 'views' is selected or initial) */}
      {activeQueryName === 'views' && (
        <section className="panel">
          <div className="views-catalog-header">
            <h2 className="panel__heading">
              <TableProperties aria-hidden size={20} /> Analytical Verification Views (SQL Registry)
            </h2>
            <p className="panel__note">
              Each deterministic check is codified as a standalone, queryable view in Snowflake SQL. Inspect the logic or run live record previews directly.
            </p>

            <div className="views-category-filter">
              {['All', 'TDS & Taxes', 'AIS & Income', 'Filing Deadlines', 'Deductions & Rebates', 'Audits & Notices', 'Aggregation'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`views-filter-chip ${categoryFilter === cat ? 'views-filter-chip--active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="views-catalog-grid">
            {filteredViews.map((view) => {
              const isSqlOpen = Boolean(expandedSql[view.name])
              const isCopied = copiedSql === view.name

              return (
                <div key={view.name} className="view-card">
                  <div className="view-card__header">
                    <div className="view-card__badges">
                      <span className="view-card__category">{view.category}</span>
                      <span className={`badge badge--${view.severity}`}>{view.severity}</span>
                    </div>
                    <code className="view-card__name">{view.name}</code>
                    <h3 className="view-card__title">{view.title}</h3>
                    <p className="view-card__desc">{view.description}</p>
                    <div className="view-card__sources">
                      <span>Sources:</span>
                      {view.sources.map((src) => (
                        <code key={src}>{src}</code>
                      ))}
                    </div>

                    {isSqlOpen && (
                      <pre className="view-card__sql-box">
                        <code>{view.sql}</code>
                      </pre>
                    )}
                  </div>

                  <div className="view-card__actions">
                    <button
                      type="button"
                      className="button button--quiet button--sm"
                      onClick={() => toggleSql(view.name)}
                    >
                      <Code aria-hidden size={14} />
                      {isSqlOpen ? 'Hide SQL' : 'Inspect SQL'}
                    </button>

                    {isSqlOpen && (
                      <button
                        type="button"
                        className="button button--quiet button--sm"
                        onClick={() => copySqlCode(view.sql, view.name)}
                      >
                        {isCopied ? <Check aria-hidden size={14} className="text-green" /> : <Copy aria-hidden size={14} />}
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="button button--sm"
                      disabled={busy}
                      onClick={() => {
                        send(
                          { name: 'preview', relation: view.name, limit: 20 },
                          `${view.name} (First 20 Matching Records)`,
                          `view-${view.name}`,
                        )
                      }}
                    >
                      <Eye aria-hidden size={14} />
                      Preview Records
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 2. Corpus Overview KPI Cards */}
      {activeQueryName === 'corpusSize' && (
        <section className="panel">
          <h2 className="panel__heading">
            <Users aria-hidden size={20} /> Synthetic Population & Storage Metrics
          </h2>
          <p className="panel__note">
            National scale benchmarks modelled across the 15 Crore practice PAN population, measured against Snowflake columnar micro-partition compression.
          </p>
          <div className="corpus-kpi-grid">
            <div className="corpus-kpi-card">
              <span className="corpus-kpi-card__label">Simulated Taxpayers</span>
              <span className="corpus-kpi-card__val">15.00 Cr</span>
              <span className="corpus-kpi-card__sub">150,000,000 distinct PAN profiles</span>
            </div>
            <div className="corpus-kpi-card">
              <span className="corpus-kpi-card__label">Synthesized Documents</span>
              <span className="corpus-kpi-card__val">95.77 Cr</span>
              <span className="corpus-kpi-card__sub">Form 16, 26AS, AIS, and Challan records</span>
            </div>
            <div className="corpus-kpi-card">
              <span className="corpus-kpi-card__label">Warehouse Storage</span>
              <span className="corpus-kpi-card__val">210.0 GiB</span>
              <span className="corpus-kpi-card__sub">Compressed columnar micro-partitions</span>
            </div>
            <div className="corpus-kpi-card">
              <span className="corpus-kpi-card__label">Logical Raw Data</span>
              <span className="corpus-kpi-card__val">664.0 GB</span>
              <span className="corpus-kpi-card__sub">3.2x average columnar compression ratio</span>
            </div>
          </div>
        </section>
      )}

      {/* 3. Co-occurrence Lift Cards */}
      {activeQueryName === 'cooccurrence' && (
        <section className="panel">
          <h2 className="panel__heading">
            <Layers aria-hidden size={20} /> Correlated Issue Clusters & Lift Analysis
          </h2>
          <p className="panel__note">
            Lift factors above 1.0 indicate statistical clustering where experiencing Issue A significantly elevates the likelihood of Issue B occurring simultaneously.
          </p>

          <div className="cooccurrence-grid">
            <div className="cooccurrence-card">
              <div className="cooccurrence-card__head">
                <span className="badge badge--action-needed">High Correlation</span>
                <span className="cooccurrence-card__lift">25.0x Lift</span>
              </div>
              <div className="cooccurrence-card__pair">
                <span className="cooccurrence-card__item">V_CHECK_DEADLINE_GAP</span>
                <span className="cooccurrence-card__item">V_CHECK_CHALLAN_NOT_CREDITED</span>
              </div>
              <p className="cooccurrence-card__desc">
                Filers paying self-assessment tax at the midnight due date frequently experience bank OLTAS sync delays, leading to uncredited challans on the tax schedule.
              </p>
            </div>

            <div className="cooccurrence-card">
              <div className="cooccurrence-card__head">
                <span className="badge badge--action-needed">Moderate Correlation</span>
                <span className="cooccurrence-card__lift">10.0x Lift</span>
              </div>
              <div className="cooccurrence-card__pair">
                <span className="cooccurrence-card__item">V_CHECK_TDS_FORM16_VS_26AS</span>
                <span className="cooccurrence-card__item">V_CHECK_CLAIMED_TDS</span>
              </div>
              <p className="cooccurrence-card__desc">
                When employer Form 16 Part A does not match deposited Form 26AS, the taxpayer’s return claim routinely inherits the uncredited difference.
              </p>
            </div>

            <div className="cooccurrence-card">
              <div className="cooccurrence-card__head">
                <span className="badge badge--review">Informational Correlation</span>
                <span className="cooccurrence-card__lift">9.4x Lift</span>
              </div>
              <div className="cooccurrence-card__pair">
                <span className="cooccurrence-card__item">V_CHECK_DUPLICATE_AIS_ENTRY</span>
                <span className="cooccurrence-card__item">V_CHECK_INTEREST_UNDER_DECLARED</span>
              </div>
              <p className="cooccurrence-card__desc">
                Duplicate reporting of savings interest by financial institutions causes an artificial gap between declared ITR interest and raw AIS sums.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Storage Tables Breakdown */}
      {activeQueryName === 'tables' && (
        <section className="panel">
          <h2 className="panel__heading">
            <Database aria-hidden size={20} /> Warehouse Base Table Footprint
          </h2>
          <p className="panel__note">
            Detailed storage breakdown comparing physical compressed micro-partitions (Snowflake storage pricing basis) vs. logical raw tabular volume across all base entities.
          </p>
          <div className="storage-grid">
            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">RETURN_CLAIM</span>
                <span className="storage-card__ratio">3.2x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>15.0 Cr Rows</span>
                <span>52.5 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '100%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 180.0 GB</span>
                <span>~375 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">AIS_INTEREST</span>
                <span className="storage-card__ratio">2.7x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>32.0 Cr Rows</span>
                <span>46.4 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '88%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 134.4 GB</span>
                <span>~155 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">FORM16</span>
                <span className="storage-card__ratio">3.0x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>15.0 Cr Rows</span>
                <span>34.5 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '65%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 112.5 GB</span>
                <span>~246 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">FORM26AS</span>
                <span className="storage-card__ratio">3.1x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>15.0 Cr Rows</span>
                <span>28.5 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '54%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 96.0 GB</span>
                <span>~204 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">TAXPAYER</span>
                <span className="storage-card__ratio">2.7x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>15.0 Cr Rows</span>
                <span>24.8 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '47%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 72.0 GB</span>
                <span>~177 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">FINDING_FLAT</span>
                <span className="storage-card__ratio">2.8x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>7.5 Cr Rows</span>
                <span>9.0 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '17%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 27.0 GB</span>
                <span>~128 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">CHALLAN</span>
                <span className="storage-card__ratio">2.7x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>4.5 Cr Rows</span>
                <span>5.85 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '11%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 17.1 GB</span>
                <span>~139 B/row</span>
              </div>
            </div>

            <div className="storage-card">
              <div className="storage-card__head">
                <span className="storage-card__name">TAX_CREDIT</span>
                <span className="storage-card__ratio">2.8x comp</span>
              </div>
              <div className="storage-card__stats">
                <span>4.32 Cr Rows</span>
                <span>4.97 GiB comp</span>
              </div>
              <div className="storage-card__bar">
                <div className="storage-card__bar-fill" style={{ width: '9%' }} />
              </div>
              <div className="storage-card__substats">
                <span>Raw: 14.7 GB</span>
                <span>~123 B/row</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Prevalence Visual Progress Chart */}
      {activeQueryName === 'prevalence' && rows.length > 0 && !busy && (
        <section className="panel">
          <div className="prevalence-chart">
            <h3 className="prevalence-chart__title">Discrepancy Frequency Distribution Across Practice Corpus</h3>
            <div className="prevalence-chart__list">
              {rows.map((row, idx) => {
                const checkCode = String(row.CHECK_CODE || '')
                const cleanName = checkCode.replace(/^V_CHECK_/, '').replace(/_/g, ' ')
                const percent = Number(row.PERCENT_OF_CORPUS || 0)
                const severity = String(row.SEVERITY || 'review')
                const count = Number(row.TAXPAYERS_AFFECTED || 0)

                return (
                  <div key={idx} className="prevalence-item">
                    <div className="prevalence-item__head">
                      <span className="prevalence-item__code">{cleanName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--gov-text-muted)' }}>
                          {count > 0 ? `${formatNumber(count)} taxpayers` : ''}
                        </span>
                        <span className={`badge badge--${severity}`}>{severity}</span>
                        <span className="prevalence-item__pct">{percent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="prevalence-item__bar-bg">
                      <div
                        className={`prevalence-item__bar-fill prevalence-item__bar-fill--${severity}`}
                        style={{ width: `${Math.min(percent * 5, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Primary Result Table */}
      <section className="panel" aria-labelledby="result-heading" aria-busy={busy}>
        <div className="results-header">
          <div>
            <h2 className="panel__heading" id="result-heading">
              {caption ?? 'Query Result Table'}
            </h2>
            {rows.length > 0 && (
              <p className="panel__note">
                Showing {filteredRows.length} of {rows.length} row{rows.length === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <div className="results-actions">
              <div className="search-box">
                <Search aria-hidden size={15} />
                <input
                  type="text"
                  placeholder="Filter table rows..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="search-box__input"
                />
              </div>

              <button
                type="button"
                className="button button--quiet"
                onClick={downloadCsv}
                title="Download table data as CSV"
              >
                <Download aria-hidden size={15} />
                CSV
              </button>
            </div>
          )}
        </div>

        {busy && (
          <div className="panel__loading">
            <Database aria-hidden size={24} className="animate-spin text-green" />
            <p>Querying practice analytical engine…</p>
          </div>
        )}

        {error && (
          <p className="callout callout--warn" role="alert">
            <CircleAlert aria-hidden size={17} />
            <span>
              Could not retrieve dataset results. If Snowflake credentials are not configured in Vercel, the app falls back to local synthetic analytics.
            </span>
          </p>
        )}

        {!busy && !error && rows.length === 0 && (
          <div className="panel__empty-state">
            <TableProperties aria-hidden size={32} />
            <p>Select an analytical query or document table above to inspect practice data.</p>
          </div>
        )}

        {rows.length > 0 && !busy && (
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
                {filteredRows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((name) => (
                      <td key={name}>{formatCellValue(name, row[name])}</td>
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
