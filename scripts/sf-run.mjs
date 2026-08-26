// Runs a .sql file against Snowflake, so a script the app depends on can be
// applied without a trip through the Snowsight worksheet.
//   node --env-file=.env.local scripts/sf-run.mjs snowflake/03_checks.sql
//
// MULTI_STATEMENT_COUNT=0 lets the driver take the whole file. Splitting on
// semicolons would cut through the $$-quoted function bodies in 03_checks.sql.
import { readFileSync } from 'node:fs'
import snowflake from 'snowflake-sdk'

const file = process.argv[2]
if (!file) {
  console.error('usage: node --env-file=.env.local scripts/sf-run.mjs <file.sql>')
  process.exit(2)
}

snowflake.configure({ logLevel: process.env.SF_LOG ?? 'ERROR' })

const e = process.env
const missing = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'].filter((n) => !e[n])
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`)
  process.exit(2)
}

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
  console.log(`running ${file} ...`)
  connection.execute({
    sqlText: readFileSync(file, 'utf8'),
    parameters: { MULTI_STATEMENT_COUNT: 0 },
    complete: (qErr) => {
      console.log(qErr ? `FAILED ${qErr.code}: ${qErr.message}` : `OK ${file}`)
      connection.destroy(() => process.exit(qErr ? 1 : 0))
    },
  })
})
