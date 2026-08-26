// Reproduces the api/query Snowflake connection locally so the real driver
// error is visible. `vercel env pull` returns "[SENSITIVE]" for sensitive
// variables, so fill .env.local by hand. It is gitignored.
//   node --env-file=.env.local scripts/sf-probe.mjs
import snowflake from 'snowflake-sdk'

// SF_LOG=TRACE surfaces the HTTP exchange behind "Request to Snowflake failed".
snowflake.configure({ logLevel: process.env.SF_LOG ?? 'ERROR' })

const e = process.env
const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD']
const missing = required.filter((n) => !e[n])
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`)
  process.exit(2)
}

for (const n of [...required, 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_ROLE', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA']) {
  const v = e[n]
  if (v === undefined) console.log(`${n}: <unset, Snowflake default applies>`)
  // A pasted .env line keeps its quotes in the Vercel dashboard field.
  else if (/^["'].*["']$/.test(v)) console.log(`${n}: len=${v.length} WRAPPED IN QUOTES — strip them`)
  else console.log(`${n}: len=${v.length}`)
}
console.log('---')

const connection = snowflake.createConnection({
  account: e.SNOWFLAKE_ACCOUNT,
  username: e.SNOWFLAKE_USER,
  password: e.SNOWFLAKE_PASSWORD,
  warehouse: e.SNOWFLAKE_WAREHOUSE,
  database: e.SNOWFLAKE_DATABASE ?? 'DB',
  schema: e.SNOWFLAKE_SCHEMA ?? 'SCH',
  role: e.SNOWFLAKE_ROLE,
})

connection.connect((err) => {
  if (err) {
    console.log(`CONNECT FAILED ${err.code}: ${err.message}`)
    process.exit(1)
  }
  connection.execute({
    sqlText: 'SELECT COUNT(*) AS TOTAL, COUNT(DISTINCT TAXPAYER_ID) AS DISTINCT_IDS FROM TAXPAYER',
    complete: (qErr, _stmt, rows) => {
      console.log(qErr ? `QUERY FAILED ${qErr.code}: ${qErr.message}` : `CONNECTED. corpus: ${JSON.stringify(rows[0])}`)
      connection.destroy(() => process.exit(qErr ? 1 : 0))
    },
  })
})
