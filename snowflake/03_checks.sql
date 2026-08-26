-- Sakshya — Income Tax reconciliation corpus: checks
--
-- One view per check, mirroring src/rules/checks.ts. Every view emits the same
-- five columns so V_FINDING can union them.
--
-- A finding states an objective difference between two named records. It never
-- states a legal or tax outcome, never predicts an approval or a refund, and
-- never asserts why the portal behaved as it did.

USE SCHEMA DB.SCH;

CREATE OR REPLACE FUNCTION RUPEES(P NUMBER)
RETURNS VARCHAR
AS $$ '₹' || TRIM(TO_CHAR(P / 100, '999999999.00')) $$;

-- Thresholds, kept here so the SQL and the TypeScript agree in one place.
CREATE OR REPLACE VIEW V_THRESHOLD AS
SELECT 2000000 AS REFUND_REVIEW_BAND_PAISE,   -- ₹20,000
       30      AS EVERIFICATION_WINDOW_DAYS;


-- 1. Form 16 TDS differs from Form 26AS TDS -----------------------------------
CREATE OR REPLACE VIEW V_CHECK_TDS_FORM16_VS_26AS AS
SELECT f.TAXPAYER_ID,
       'tds-match' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'Form 16 and Form 26AS state different TDS' AS HEADLINE,
       'Form 16 shows ' || RUPEES(f.TDS_PAISE)
         || '. Form 26AS shows ' || RUPEES(a.TDS_PAISE)
         || '. Difference ' || RUPEES(ABS(f.TDS_PAISE - a.TDS_PAISE)) || '.' AS DETAIL
FROM FORM16 f
JOIN FORM26AS a ON a.TAXPAYER_ID = f.TAXPAYER_ID
WHERE f.TDS_PAISE <> a.TDS_PAISE;

-- 2. TDS claimed in the return differs from Form 26AS -------------------------
CREATE OR REPLACE VIEW V_CHECK_CLAIMED_TDS AS
SELECT r.TAXPAYER_ID,
       'claimed-tds' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'Return claims more TDS than Form 26AS reflects' AS HEADLINE,
       'The return claims ' || RUPEES(r.CLAIMED_TDS_PAISE)
         || '. Form 26AS reflects ' || RUPEES(a.TDS_PAISE) || '.' AS DETAIL
FROM RETURN_CLAIM r
JOIN FORM26AS a ON a.TAXPAYER_ID = r.TAXPAYER_ID
WHERE r.CLAIMED_TDS_PAISE <> a.TDS_PAISE;

-- 3. A paid challan is absent from the taxes-paid schedule --------------------
CREATE OR REPLACE VIEW V_CHECK_CHALLAN_NOT_CREDITED AS
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
WHERE t.CIN IS NULL;

-- 4. The return was filed after the due date, with a challan paid before it ---
CREATE OR REPLACE VIEW V_CHECK_DEADLINE_GAP AS
SELECT t.TAXPAYER_ID,
       'deadline-gap' AS CHECK_CODE,
       'review' AS SEVERITY,
       'Payment lands before the due date, submission after it' AS HEADLINE,
       'Challan ' || c.CIN || ' was paid ' || TO_VARCHAR(c.PAID_AT, 'DD Mon YYYY HH24:MI')
         || '. The return was submitted ' || TO_VARCHAR(t.FILED_ON, 'DD Mon YYYY HH24:MI')
         || ', ' || TIMESTAMPDIFF(minute, t.DUE_DATE, t.FILED_ON)
         || ' minutes after the ' || TO_VARCHAR(t.DUE_DATE, 'DD Mon YYYY HH24:MI') || ' due date.' AS DETAIL
FROM TAXPAYER t
JOIN CHALLAN c ON c.TAXPAYER_ID = t.TAXPAYER_ID
WHERE t.FILED_ON > t.DUE_DATE
  AND c.PAID_AT <= t.DUE_DATE;

-- 5. The same AIS transaction is reported more than once ----------------------
CREATE OR REPLACE VIEW V_CHECK_AIS_DUPLICATES AS
SELECT TAXPAYER_ID,
       'ais-duplicates' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'The same AIS transaction appears more than once' AS HEADLINE,
       PAYER || ' reports ' || RUPEES(AMOUNT_PAISE)
         || ' on ' || TO_VARCHAR(REPORTED_ON, 'DD Mon YYYY')
         || ' in ' || TO_VARCHAR(COUNT(*)) || ' separate AIS entries.' AS DETAIL
FROM AIS_INTEREST
GROUP BY TAXPAYER_ID, PAYER, AMOUNT_PAISE, REPORTED_ON
HAVING COUNT(*) > 1;

-- 6. Declared interest differs from the distinct AIS total --------------------
CREATE OR REPLACE VIEW V_CHECK_INTEREST_TOTAL AS
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
WHERE r.DECLARED_INTEREST_PAISE <> d.DISTINCT_TOTAL;

-- 7. NPS employer contribution claimed above the Form 16 cap ------------------
CREATE OR REPLACE VIEW V_CHECK_NPS_CAP AS
SELECT r.TAXPAYER_ID,
       'nps-cap' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'NPS claim exceeds the percentage stated on Form 16' AS HEADLINE,
       'The return claims ' || TO_VARCHAR(r.NPS_CLAIM_PERCENT, '99.9')
         || '% of salary. Form 16 states ' || TO_VARCHAR(f.NPS_CAP_PERCENT, '99.9') || '%.' AS DETAIL
FROM RETURN_CLAIM r
JOIN FORM16 f ON f.TAXPAYER_ID = r.TAXPAYER_ID
WHERE r.NPS_CLAIM_PERCENT > f.NPS_CAP_PERCENT;

-- 8. Rebate claimed alongside special-rate income -----------------------------
--    The utility accepts this. Nothing on screen flags it at submission time,
--    which is why it is worth surfacing here.
CREATE OR REPLACE VIEW V_CHECK_REBATE_SPECIAL_RATE AS
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
WHERE r.REBATE_CLAIMED_PAISE > 0;

-- 9. E-verification missing or outside the window -----------------------------
CREATE OR REPLACE VIEW V_CHECK_EVERIFICATION AS
SELECT t.TAXPAYER_ID,
       'everification' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       CASE WHEN t.EVERIFIED_ON IS NULL
            THEN 'No e-verification is on record'
            ELSE 'E-verification falls outside the window' END AS HEADLINE,
       CASE WHEN t.EVERIFIED_ON IS NULL
            THEN 'The return was submitted ' || TO_VARCHAR(t.FILED_ON, 'DD Mon YYYY')
                 || '. No verification record exists. The window is '
                 || TO_VARCHAR(th.EVERIFICATION_WINDOW_DAYS) || ' days.'
            ELSE 'Submitted ' || TO_VARCHAR(t.FILED_ON, 'DD Mon YYYY')
                 || ', verified ' || TO_VARCHAR(t.EVERIFIED_ON, 'DD Mon YYYY')
                 || ', a gap of ' || TO_VARCHAR(DATEDIFF(day, t.FILED_ON, t.EVERIFIED_ON))
                 || ' days.' END AS DETAIL
FROM TAXPAYER t
CROSS JOIN V_THRESHOLD th
WHERE t.FILED_ON IS NOT NULL
  AND (t.EVERIFIED_ON IS NULL
       OR DATEDIFF(day, t.FILED_ON, t.EVERIFIED_ON) > th.EVERIFICATION_WINDOW_DAYS);

-- 10. Refund at or above the review band --------------------------------------
CREATE OR REPLACE VIEW V_CHECK_REFUND_BAND AS
SELECT t.TAXPAYER_ID,
       'refund-band' AS CHECK_CODE,
       'review' AS SEVERITY,
       'Refund claimed is at or above the review band' AS HEADLINE,
       'The return claims ' || RUPEES(t.REFUND_CLAIMED_PAISE)
         || ', at or above the ' || RUPEES(th.REFUND_REVIEW_BAND_PAISE)
         || ' band this brief uses. Keep the supporting proofs together.' AS DETAIL
FROM TAXPAYER t
CROSS JOIN V_THRESHOLD th
WHERE t.REFUND_CLAIMED_PAISE >= th.REFUND_REVIEW_BAND_PAISE;

-- 11. A notice names documents that are not on record -------------------------
CREATE OR REPLACE VIEW V_CHECK_NOTICE_EVIDENCE AS
SELECT n.TAXPAYER_ID,
       'notice-evidence' AS CHECK_CODE,
       'action-needed' AS SEVERITY,
       'A notice names documents that are not on record' AS HEADLINE,
       'Notice ' || n.CODE || ' issued ' || TO_VARCHAR(n.ISSUED_ON, 'DD Mon YYYY')
         || ' names ' || TO_VARCHAR(n.DOCS_REQUIRED) || ' documents. '
         || TO_VARCHAR(n.DOCS_ON_RECORD) || ' are on record. Response due '
         || TO_VARCHAR(n.RESPOND_BY, 'DD Mon YYYY') || '.' AS DETAIL
FROM NOTICE n
WHERE n.DOCS_ON_RECORD < n.DOCS_REQUIRED;


-- Every finding, for any taxpayer ---------------------------------------------
CREATE OR REPLACE VIEW V_FINDING AS
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
UNION ALL SELECT * FROM V_CHECK_NOTICE_EVIDENCE;

-- How often each check fires across the corpus --------------------------------
-- This is prevalence WITHIN THE SYNTHETIC CORPUS. It is a property of the
-- generator in 02_seed.sql, not a measurement of Indian taxpayers.
CREATE OR REPLACE VIEW V_PREVALENCE AS
SELECT f.CHECK_CODE,
       ANY_VALUE(f.SEVERITY) AS SEVERITY,
       COUNT(DISTINCT f.TAXPAYER_ID) AS TAXPAYERS_AFFECTED,
       ROUND(100.0 * COUNT(DISTINCT f.TAXPAYER_ID)
             / (SELECT COUNT(*) FROM TAXPAYER), 2) AS PERCENT_OF_CORPUS
FROM V_FINDING f
GROUP BY f.CHECK_CODE
ORDER BY TAXPAYERS_AFFECTED DESC;


-- ---------------------------------------------------------------------------
-- Verify the checks behave
-- ---------------------------------------------------------------------------

-- Fire rate per check. Compare against the rates documented in 02_seed.sql.
SELECT * FROM V_PREVALENCE;

-- How many taxpayers are clean, and how findings stack up.
SELECT COALESCE(FINDING_COUNT, 0) AS FINDINGS_PER_TAXPAYER, COUNT(*) AS TAXPAYERS
FROM TAXPAYER t
LEFT JOIN (SELECT TAXPAYER_ID, COUNT(*) AS FINDING_COUNT FROM V_FINDING GROUP BY TAXPAYER_ID) f
       ON f.TAXPAYER_ID = t.TAXPAYER_ID
GROUP BY 1 ORDER BY 1;

-- A single taxpayer's brief.
SELECT SEVERITY, CHECK_CODE, HEADLINE, DETAIL
FROM V_FINDING WHERE TAXPAYER_ID = 25
ORDER BY SEVERITY, CHECK_CODE;

-- No finding may reference a taxpayer that does not exist.
SELECT COUNT(*) AS ORPHAN_FINDINGS
FROM V_FINDING f
LEFT JOIN TAXPAYER t ON t.TAXPAYER_ID = f.TAXPAYER_ID
WHERE t.TAXPAYER_ID IS NULL;
