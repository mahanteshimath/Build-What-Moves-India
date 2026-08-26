-- Sakshya — Income Tax reconciliation corpus: least-privilege reader
--
-- Run after 03_checks.sql, and again if you ever add a table the app reads.
--   node --env-file=.env.local scripts/sf-run.mjs snowflake/06_grants.sql
--
-- WHY THIS EXISTS
-- ===========================================================================
-- api/query.ts holds the Snowflake credentials, and the app's sign-in is a
-- client-side demo gate, so in practice that endpoint answers to anyone who
-- finds it. It was running as ACCOUNTADMIN.
--
-- The endpoint only ever runs SELECT: a fixed set of named queries, plus
-- "SELECT * FROM <relation> LIMIT n" where the relation is checked against an
-- allowlist. So the credential it uses needs to read nine tables and a handful
-- of views, and nothing else. ACCOUNTADMIN could drop the database.
--
-- This does not fix the endpoint being open. It bounds what an open endpoint
-- can reach, which is the part worth fixing in an afternoon.

USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS SAKSHYA_READER
  COMMENT = 'Read-only role for the api/query Vercel Function. SELECT on DB.SCH only.';

-- USAGE is enough for a suspended warehouse to auto-resume on query.
-- OPERATE would additionally allow suspending it by hand, which the app never does.
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE SAKSHYA_READER;

GRANT USAGE ON DATABASE DB          TO ROLE SAKSHYA_READER;
GRANT USAGE ON SCHEMA   DB.SCH      TO ROLE SAKSHYA_READER;

GRANT SELECT ON ALL TABLES IN SCHEMA DB.SCH TO ROLE SAKSHYA_READER;
GRANT SELECT ON ALL VIEWS  IN SCHEMA DB.SCH TO ROLE SAKSHYA_READER;

-- CREATE OR REPLACE TABLE drops the object and its grants with it. 03_checks.sql
-- rebuilds the four summary tables on every run, so without these the app would
-- lose access each time the corpus is refreshed.
GRANT SELECT ON FUTURE TABLES IN SCHEMA DB.SCH TO ROLE SAKSHYA_READER;
GRANT SELECT ON FUTURE VIEWS  IN SCHEMA DB.SCH TO ROLE SAKSHYA_READER;

GRANT ROLE SAKSHYA_READER TO USER MONTY;


-- ---------------------------------------------------------------------------
-- Prove it before pointing the app at it
-- ---------------------------------------------------------------------------
-- Everything below runs AS the new role. If a grant is missing, the statement
-- errors here rather than in production.
USE ROLE SAKSHYA_READER;
USE WAREHOUSE COMPUTE_WH;
USE SCHEMA DB.SCH;

SELECT 'corpusSize'   AS NAMED_QUERY, TOTAL AS RESULT FROM CORPUS_SUMMARY;
SELECT 'prevalence',   COUNT(*) FROM PREVALENCE_SUMMARY;
SELECT 'cooccurrence', COUNT(*) FROM COOCCURRENCE_SUMMARY;
SELECT 'tables',       COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                       WHERE TABLE_SCHEMA = 'SCH' AND TABLE_TYPE = 'BASE TABLE';
SELECT 'views',        COUNT(*) FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = 'SCH';
SELECT 'relation browse', COUNT(*) FROM (SELECT * FROM TAXPAYER LIMIT 100);
SELECT 'finding browse',  COUNT(*) FROM (SELECT * FROM FINDING_FLAT LIMIT 100);

-- And prove it cannot do the thing ACCOUNTADMIN could. Uncomment to confirm it
-- fails with "Insufficient privileges" — leave commented so the file is re-runnable.
-- DROP TABLE TAXPAYER;
