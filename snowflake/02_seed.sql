-- Sakshya — Income Tax reconciliation corpus: seed
--
-- Generates 5,000 synthetic taxpayers. Everything is a deterministic function of
-- TAXPAYER_ID, so re-running produces an identical corpus and each table can
-- derive its own defect cohort without a shared "answer" column for the checks
-- in 03_checks.sql to cheat from.
--
-- DEFECT RATES. Only one is grounded in the portal research:
--   not e-verified  4.0%  <- 6.43 crore verified of 6.70 crore filed = 95.97%
-- The rest are chosen to make the corpus exercise every check. They are
-- ILLUSTRATIVE, NOT MEASURED, and must not be quoted as real-world prevalence:
--   challan not credited     4.0%   MOD(id,25)=0
--   TDS Form16 vs 26AS       5.0%   MOD(id,20)=3
--   NPS claimed above cap    5.9%   MOD(id,17)=5
--   duplicated AIS entry     7.1%   MOD(id,14)=9
--   special-rate income     16.7%   MOD(id,6)=1
--   notice issued            3.0%   MOD(id,33)=11

USE SCHEMA DB.SCH;

-- ---------------------------------------------------------------------------
-- Taxpayers
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO TAXPAYER
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
    -- the challan-sync cohort files just after midnight; everyone else earlier
    CASE
        WHEN MOD(id, 25) = 0
            THEN DATEADD(minute, MOD(id, 45) + 5, '2026-08-01 00:00:00'::TIMESTAMP_NTZ)
        ELSE DATEADD(day, -MOD(id, 60), '2026-07-30 18:00:00'::TIMESTAMP_NTZ)
    END,
    NULL,                                          -- verification set below
    CASE WHEN MOD(id, 3) = 0 THEN MOD(id * 3571, 90000) * 100 ELSE 0 END
FROM (SELECT SEQ4() + 1 AS id FROM TABLE(GENERATOR(ROWCOUNT => 5000)));

-- 4.0% never verify; the rest verify shortly after filing.
UPDATE TAXPAYER
SET EVERIFIED_ON = DATEADD(minute, 15 + MOD(TAXPAYER_ID, 2880), FILED_ON)
WHERE MOD(TAXPAYER_ID, 1000) >= 40;


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
    0                                              -- advance tax filled in after CHALLAN loads
FROM FORM16 f;


-- ---------------------------------------------------------------------------
-- AIS interest entries — 1 to 3 per taxpayer
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO AIS_INTEREST
SELECT
    ROW_NUMBER() OVER (ORDER BY t.id, n.k),
    t.id,
    CASE MOD(t.id + n.k, 8)
        WHEN 0 THEN 'State Bank of India'
        WHEN 1 THEN 'HDFC Bank'
        WHEN 2 THEN 'ICICI Bank'
        WHEN 3 THEN 'Canara Bank'
        WHEN 4 THEN 'Union Bank of India'
        WHEN 5 THEN 'Bank of Baroda'
        WHEN 6 THEN 'Sundaram Finance Ltd'
        ELSE 'Punjab National Bank'
    END,
    (2000 + MOD(t.id * 131 + n.k * 977, 48000)) * 100,
    DATEADD(day, MOD(t.id + n.k, 120), '2026-04-01'::DATE)
-- Both derived tables need explicit aliases; Snowflake auto-names them identically.
FROM (SELECT SEQ4() + 1 AS id FROM TABLE(GENERATOR(ROWCOUNT => 5000))) t
CROSS JOIN (SELECT SEQ4() + 1 AS k FROM TABLE(GENERATOR(ROWCOUNT => 3))) n
WHERE n.k <= 1 + MOD(t.id, 3);

-- 7.1% get one entry reported a second time — same payer, amount and date.
-- The only additive insert in this file; OVERWRITE here would erase the rows above.
INSERT INTO AIS_INTEREST
SELECT
    (SELECT MAX(ENTRY_ID) FROM AIS_INTEREST) + ROW_NUMBER() OVER (ORDER BY a.ENTRY_ID),
    a.TAXPAYER_ID, a.PAYER, a.AMOUNT_PAISE, a.REPORTED_ON
FROM AIS_INTEREST a
WHERE MOD(a.TAXPAYER_ID, 14) = 9
  AND a.ENTRY_ID = (SELECT MIN(b.ENTRY_ID) FROM AIS_INTEREST b
                    WHERE b.TAXPAYER_ID = a.TAXPAYER_ID);


-- ---------------------------------------------------------------------------
-- Challans held by the taxpayer — every third filer paid one
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

-- Form 26AS reflects advance tax only once the challans exist.
UPDATE FORM26AS a
SET ADVANCE_TAX_PAISE = c.TOTAL
FROM (SELECT TAXPAYER_ID, SUM(AMOUNT_PAISE) AS TOTAL FROM CHALLAN
      WHERE KIND = 'advance-tax' GROUP BY TAXPAYER_ID) c
WHERE a.TAXPAYER_ID = c.TAXPAYER_ID;


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
--   NPS claim exceeds the Form 16 cap for 5.9%
--   Rebate is claimed by new-regime filers under ₹12 lakh
-- ---------------------------------------------------------------------------
INSERT OVERWRITE INTO RETURN_CLAIM
SELECT
    t.TAXPAYER_ID,
    f.TDS_PAISE,
    COALESCE(d.DISTINCT_INTEREST, 0),
    CASE WHEN MOD(t.TAXPAYER_ID, 17) = 5 THEN 14.0 ELSE 10.0 END,
    CASE
        WHEN t.REGIME = 'new' AND t.TOTAL_INCOME_PAISE <= 1200000 * 100
            THEN LEAST(60000, 12000 + MOD(t.TAXPAYER_ID, 48000)) * 100
        ELSE 0
    END
FROM TAXPAYER t
JOIN FORM16 f ON f.TAXPAYER_ID = t.TAXPAYER_ID
LEFT JOIN (
    SELECT TAXPAYER_ID, SUM(AMOUNT_PAISE) AS DISTINCT_INTEREST
    FROM (SELECT DISTINCT TAXPAYER_ID, PAYER, AMOUNT_PAISE, REPORTED_ON FROM AIS_INTEREST)
    GROUP BY TAXPAYER_ID
) d ON d.TAXPAYER_ID = t.TAXPAYER_ID;


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
