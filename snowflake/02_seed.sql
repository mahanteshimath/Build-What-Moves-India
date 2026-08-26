-- Sakshya — Income Tax reconciliation corpus: seed
--
-- Generates a synthetic taxpayer corpus. Everything is a deterministic function
-- of TAXPAYER_ID, so re-running produces an identical corpus and each table can
-- derive its own defect cohort without a shared "answer" column for the checks
-- in 03_checks.sql to cheat from.
--
-- ===========================================================================
-- CORPUS SIZE — the only number to change
-- ===========================================================================
-- The ROWCOUNT in the TAXPAYER insert below is the taxpayer count. Every other
-- table derives from TAXPAYER, so that one literal sets the scale of the whole
-- corpus. It has to be a literal: GENERATOR takes a constant, not a variable.
--
--        5000  seconds. Drop to this while editing checks.
--   150000000  15 crore, near the scale of India's PAN base, and the point at
--              which Snowflake is doing work a spreadsheet could not.
--              <- currently set to this
--
-- At 15 crore this writes roughly 1 billion rows across the nine tables, of
-- which AIS_INTEREST is about 32 crore. Budget tens of minutes on an XS
-- warehouse and single-digit GB of storage. A larger warehouse shortens the
-- wall clock without changing the credits much, since the work per row is fixed.
--
-- Re-running is safe. Every statement is INSERT OVERWRITE, so a second run
-- replaces the corpus rather than doubling it.
--
-- ===========================================================================
-- DEFECT RATES
-- ===========================================================================
-- Only one is grounded in the portal research:
--   not e-verified  4.0%  <- 6.43 crore verified of 6.70 crore filed = 95.97%
-- The rest are chosen to make the corpus exercise every check. They are
-- ILLUSTRATIVE, NOT MEASURED, and must not be quoted as real-world prevalence:
--   challan not credited     4.0%   MOD(id,25)=0
--   TDS Form16 vs 26AS       5.0%   MOD(id,20)=3
--   interest under-declared  5.3%   MOD(id,19)=7
--   NPS claimed above cap    5.9%   MOD(id,17)=5
--   duplicated AIS entry     7.1%   MOD(id,14)=9
--   special-rate income     16.7%   MOD(id,6)=1
--   notice issued            3.0%   MOD(id,33)=11
--
-- Every cohort is a modulus of the id, so these rates hold at any corpus size.
-- Scaling up buys volume and query realism, not different proportions.

USE SCHEMA DB.SCH;

-- ---------------------------------------------------------------------------
-- Taxpayers
--
-- FILED_ON is derived in a CTE so EVERIFIED_ON can be built from it in the same
-- pass. The earlier version inserted the table and then UPDATEd it; at 15 crore
-- that second statement rewrites every micro-partition to add one column.
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO TAXPAYER
WITH base AS (
    SELECT SEQ4() + 1 AS id
    FROM TABLE(GENERATOR(ROWCOUNT => 150000000))   -- corpus size, see header
),
filed AS (
    SELECT
        id,
        -- the challan-sync cohort files just after midnight; everyone else earlier
        CASE
            WHEN MOD(id, 25) = 0
                THEN DATEADD(minute, MOD(id, 45) + 5, '2026-08-01 00:00:00'::TIMESTAMP_NTZ)
            ELSE DATEADD(day, -MOD(id, 60), '2026-07-30 18:00:00'::TIMESTAMP_NTZ)
        END AS filed_on
    FROM base
)
SELECT
    id,
    '****' || LPAD(TO_VARCHAR(MOD(id * 7919, 10000)), 4, '0') || 'F',
    'AY 2026-27',
    CASE WHEN MOD(id, 10) < 8 THEN 'new' ELSE 'old' END,
    CASE
        WHEN MOD(id, 6) = 1 THEN 'ITR-2'          -- has capital gains
        WHEN MOD(id, 11) = 4 THEN 'ITR-3'
        ELSE 'ITR-1'
    END,
    (300000 + MOD(id * 104729, 2200000)) * 100,   -- ₹3L to ₹25L, in paise
    '2026-07-31 23:59:00'::TIMESTAMP_NTZ,
    filed_on,
    -- 4.0% never verify; the rest verify shortly after filing.
    CASE
        WHEN MOD(id, 1000) >= 40
            THEN DATEADD(minute, 15 + MOD(id, 2880), filed_on)
    END,
    CASE WHEN MOD(id, 3) = 0 THEN MOD(id * 3571, 90000) * 100 ELSE 0 END
FROM filed;


-- ---------------------------------------------------------------------------
-- Challans held by the taxpayer — every third filer paid one
--
-- Loaded before FORM26AS so the advance-tax figure can be joined straight in,
-- rather than UPDATEd across the whole table afterwards.
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO CHALLAN
SELECT
    TAXPAYER_ID,
    TAXPAYER_ID,
    CASE WHEN MOD(TAXPAYER_ID, 7) = 2 THEN 'advance-tax' ELSE 'self-assessment' END,
    LPAD(TO_VARCHAR(MOD(TAXPAYER_ID * 9013, 10000000)), 7, '0')
        || '-' || TO_VARCHAR(
             CASE WHEN MOD(TAXPAYER_ID, 25) = 0
                  THEN '2026-07-31'::DATE
                  ELSE DATEADD(day, -MOD(TAXPAYER_ID, 90), '2026-07-20'::DATE) END,
             'DDMMYYYY')
        || '-' || LPAD(TO_VARCHAR(MOD(TAXPAYER_ID, 99999)), 5, '0'),
    (5000 + MOD(TAXPAYER_ID * 617, 120000)) * 100,
    CASE
        WHEN MOD(TAXPAYER_ID, 25) = 0
            THEN DATEADD(minute, -MOD(TAXPAYER_ID, 200) - 20, '2026-07-31 23:59:00'::TIMESTAMP_NTZ)
        ELSE DATEADD(day, -MOD(TAXPAYER_ID, 90), '2026-07-20 12:00:00'::TIMESTAMP_NTZ)
    END
FROM TAXPAYER
WHERE MOD(TAXPAYER_ID, 3) = 0 OR MOD(TAXPAYER_ID, 25) = 0;

-- The taxes-paid schedule credits every challan EXCEPT the sync-failure cohort.
INSERT OVERWRITE INTO TAX_CREDIT
SELECT TAXPAYER_ID, CIN, AMOUNT_PAISE
FROM CHALLAN
WHERE MOD(TAXPAYER_ID, 25) <> 0;


-- ---------------------------------------------------------------------------
-- Form 16 — employer statement
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO FORM16
SELECT
    TAXPAYER_ID,
    'TAN' || LPAD(TO_VARCHAR(MOD(TAXPAYER_ID * 5387, 100000)), 5, '0') || 'K',
    ROUND(TOTAL_INCOME_PAISE * (6 + MOD(TAXPAYER_ID, 9)) / 100),
    10.0                                           -- Form 16 field still states the old cap
FROM TAXPAYER;


-- ---------------------------------------------------------------------------
-- Form 26AS — departmental credit statement
-- 5% disagree with Form 16 by a small amount.
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO FORM26AS
SELECT
    f.TAXPAYER_ID,
    CASE
        WHEN MOD(f.TAXPAYER_ID, 20) = 3
            THEN f.TDS_PAISE - (450 + MOD(f.TAXPAYER_ID, 5000)) * 100
        ELSE f.TDS_PAISE
    END,
    COALESCE(c.AMOUNT_PAISE, 0)
FROM FORM16 f
LEFT JOIN CHALLAN c
       ON c.TAXPAYER_ID = f.TAXPAYER_ID AND c.KIND = 'advance-tax';


-- ---------------------------------------------------------------------------
-- AIS interest entries — 1 to 3 per taxpayer, plus the duplicate cohort
--
-- ENTRY_ID is arithmetic (id * 4 + slot) rather than a ROW_NUMBER. A window
-- function with no PARTITION BY funnels every row through one node to assign a
-- global order: fine for 5,000 rows, ruinous for 32 crore. Slots 1..3 hold the
-- genuine entries and slot 0 is reserved for the duplicate, so both arrive in a
-- single statement. The old duplicate pass re-read the table and ran a
-- correlated MIN() per row, which is quadratic and would not have finished.
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO AIS_INTEREST
WITH slots AS (
    SELECT SEQ4() + 1 AS k FROM TABLE(GENERATOR(ROWCOUNT => 3))
),
entries AS (
    SELECT t.TAXPAYER_ID AS id, n.k AS k, n.k AS slot
    FROM TAXPAYER t
    CROSS JOIN slots n
    WHERE n.k <= 1 + MOD(t.TAXPAYER_ID, 3)

    UNION ALL

    -- 7.1% get their first entry reported a second time, same payer, amount
    -- and date, which is exactly what the duplicate check looks for.
    SELECT TAXPAYER_ID, 1, 0
    FROM TAXPAYER
    WHERE MOD(TAXPAYER_ID, 14) = 9
)
SELECT
    id * 4 + slot,
    id,
    CASE MOD(id + k, 8)
        WHEN 0 THEN 'State Bank of India'
        WHEN 1 THEN 'HDFC Bank'
        WHEN 2 THEN 'ICICI Bank'
        WHEN 3 THEN 'Canara Bank'
        WHEN 4 THEN 'Union Bank of India'
        WHEN 5 THEN 'Bank of Baroda'
        WHEN 6 THEN 'Sundaram Finance Ltd'
        ELSE 'Punjab National Bank'
    END,
    (2000 + MOD(id * 131 + k * 977, 48000)) * 100,
    DATEADD(day, MOD(id + k, 120), '2026-04-01'::DATE)
FROM entries;


-- ---------------------------------------------------------------------------
-- Special-rate income — 16.7% of filers
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO SPECIAL_RATE_INCOME
SELECT
    TAXPAYER_ID,
    CASE MOD(TAXPAYER_ID, 4)
        WHEN 0 THEN '112A'
        WHEN 1 THEN '111A'
        WHEN 2 THEN '112'
        ELSE '115BBH'
    END,
    (25000 + MOD(TAXPAYER_ID * 271, 400000)) * 100
FROM TAXPAYER
WHERE MOD(TAXPAYER_ID, 6) = 1;


-- ---------------------------------------------------------------------------
-- What the return claims
--   TDS claimed follows Form 16 (the taxpayer claims what the employer stated)
--   Interest declared follows the DISTINCT AIS entries, so duplicates surface
--   5.3% omit one bank's interest altogether
--   NPS claim exceeds the Form 16 cap for 5.9%
--   Rebate is claimed by new-regime filers under ₹12 lakh
--
-- The omission cohort exists because without it DECLARED_INTEREST_PAISE always
-- equalled the distinct AIS total, so V_CHECK_INTEREST_TOTAL could never fire
-- and V_PREVALENCE returned ten rows for eleven checks.
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO RETURN_CLAIM
WITH ais_distinct AS (
    SELECT TAXPAYER_ID, ENTRY_ID, AMOUNT_PAISE
    FROM AIS_INTEREST
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY TAXPAYER_ID, PAYER, AMOUNT_PAISE, REPORTED_ON
        ORDER BY ENTRY_ID) = 1
),
ais_agg AS (
    SELECT TAXPAYER_ID,
           SUM(AMOUNT_PAISE)              AS DISTINCT_TOTAL,
           MIN_BY(AMOUNT_PAISE, ENTRY_ID) AS FIRST_AMOUNT
    FROM ais_distinct
    GROUP BY TAXPAYER_ID
)
SELECT
    t.TAXPAYER_ID,
    f.TDS_PAISE,
    CASE
        WHEN MOD(t.TAXPAYER_ID, 19) = 7
            THEN COALESCE(a.DISTINCT_TOTAL, 0) - COALESCE(a.FIRST_AMOUNT, 0)
        ELSE COALESCE(a.DISTINCT_TOTAL, 0)
    END,
    CASE WHEN MOD(t.TAXPAYER_ID, 17) = 5 THEN 14.0 ELSE 10.0 END,
    CASE
        WHEN t.REGIME = 'new' AND t.TOTAL_INCOME_PAISE <= 1200000 * 100
            THEN LEAST(60000, 12000 + MOD(t.TAXPAYER_ID, 48000)) * 100
        ELSE 0
    END
FROM TAXPAYER t
JOIN FORM16 f ON f.TAXPAYER_ID = t.TAXPAYER_ID
LEFT JOIN ais_agg a ON a.TAXPAYER_ID = t.TAXPAYER_ID;


-- ---------------------------------------------------------------------------
-- Notices — 3%. A notice names 2 to 4 documents; only Form 16 and Form 26AS
-- are ever on record, so anything above 2 leaves a gap. 04_export.sql relies
-- on this rule to stay consistent with the TypeScript check.
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO NOTICE
SELECT
    TAXPAYER_ID,
    TAXPAYER_ID,
    CASE WHEN MOD(TAXPAYER_ID, 2) = 0 THEN '139(9)' ELSE '143(1)' END,
    DATEADD(day, MOD(TAXPAYER_ID, 30), '2026-08-10'::DATE),
    DATEADD(day, MOD(TAXPAYER_ID, 30) + 15, '2026-08-10'::DATE),
    2 + MOD(TAXPAYER_ID, 3),
    LEAST(2 + MOD(TAXPAYER_ID, 3), 2)
FROM TAXPAYER
WHERE MOD(TAXPAYER_ID, 33) = 11;


-- ---------------------------------------------------------------------------
-- Verify the corpus loaded as intended
-- ---------------------------------------------------------------------------
SELECT 'TAXPAYER' AS TABLE_NAME, COUNT(*) AS ROW_COUNT FROM TAXPAYER
UNION ALL SELECT 'FORM16',              COUNT(*) FROM FORM16
UNION ALL SELECT 'FORM26AS',            COUNT(*) FROM FORM26AS
UNION ALL SELECT 'RETURN_CLAIM',        COUNT(*) FROM RETURN_CLAIM
UNION ALL SELECT 'AIS_INTEREST',        COUNT(*) FROM AIS_INTEREST
UNION ALL SELECT 'CHALLAN',             COUNT(*) FROM CHALLAN
UNION ALL SELECT 'TAX_CREDIT',          COUNT(*) FROM TAX_CREDIT
UNION ALL SELECT 'SPECIAL_RATE_INCOME', COUNT(*) FROM SPECIAL_RATE_INCOME
UNION ALL SELECT 'NOTICE',              COUNT(*) FROM NOTICE
ORDER BY TABLE_NAME;
