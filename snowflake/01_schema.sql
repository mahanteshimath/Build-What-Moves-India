-- Sakshya — Income Tax reconciliation corpus: schema
--
-- ALL DATA IS SYNTHETIC AND GENERATED. No real taxpayer ever goes in here.
-- PAN/TAN values are masked, structurally-shaped placeholders only.
--
-- Money is stored as integer paise (NUMBER(18,0)) so no float rounding exists.
-- Snowflake enforces NOT NULL. PRIMARY KEY / FOREIGN KEY are metadata only,
-- kept because they document intent and the optimizer can use them.
--
-- Run order: 01_schema.sql -> 02_seed.sql -> 03_checks.sql -> 04_export.sql
--
-- No warehouse is selected here; the Snowsight worksheet's warehouse picker
-- governs. Creates a DB.SCH schema, so nothing needs editing before you run.

CREATE DATABASE IF NOT EXISTS DB;
CREATE SCHEMA IF NOT EXISTS DB.SCH;
USE SCHEMA DB.SCH;


-- The filer, and what the return as submitted says about them.
CREATE OR REPLACE TABLE TAXPAYER (
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    PAN_MASKED              VARCHAR(12)   NOT NULL,
    ASSESSMENT_YEAR         VARCHAR(10)   NOT NULL,
    REGIME                  VARCHAR(10)   NOT NULL,   -- 'new' | 'old'
    ITR_FORM                VARCHAR(6)    NOT NULL,   -- ITR-1 .. ITR-4
    TOTAL_INCOME_PAISE      NUMBER(18,0)  NOT NULL,
    DUE_DATE                TIMESTAMP_NTZ NOT NULL,
    FILED_ON                TIMESTAMP_NTZ,            -- NULL = not filed
    EVERIFIED_ON            TIMESTAMP_NTZ,            -- NULL = not verified
    REFUND_CLAIMED_PAISE    NUMBER(18,0)  NOT NULL DEFAULT 0,
    CONSTRAINT PK_TAXPAYER PRIMARY KEY (TAXPAYER_ID)
);

-- Employer-issued statement.
CREATE OR REPLACE TABLE FORM16 (
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    TAN                     VARCHAR(12)   NOT NULL,
    TDS_PAISE               NUMBER(18,0)  NOT NULL,
    NPS_CAP_PERCENT         NUMBER(4,1)   NOT NULL,   -- percent stated in the Form 16 field
    CONSTRAINT PK_FORM16 PRIMARY KEY (TAXPAYER_ID),
    CONSTRAINT FK_FORM16_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- Departmental tax credit statement.
CREATE OR REPLACE TABLE FORM26AS (
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    TDS_PAISE               NUMBER(18,0)  NOT NULL,
    ADVANCE_TAX_PAISE       NUMBER(18,0)  NOT NULL DEFAULT 0,
    CONSTRAINT PK_FORM26AS PRIMARY KEY (TAXPAYER_ID),
    CONSTRAINT FK_26AS_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- What the return itself claims.
CREATE OR REPLACE TABLE RETURN_CLAIM (
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    CLAIMED_TDS_PAISE       NUMBER(18,0)  NOT NULL,
    DECLARED_INTEREST_PAISE NUMBER(18,0)  NOT NULL DEFAULT 0,
    NPS_CLAIM_PERCENT       NUMBER(4,1)   NOT NULL DEFAULT 0,
    REBATE_CLAIMED_PAISE    NUMBER(18,0)  NOT NULL DEFAULT 0,
    CONSTRAINT PK_RETURN_CLAIM PRIMARY KEY (TAXPAYER_ID),
    CONSTRAINT FK_CLAIM_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- Interest transactions reported into the Annual Information Statement.
-- Duplicates are legitimate rows here — detecting them is the point.
CREATE OR REPLACE TABLE AIS_INTEREST (
    ENTRY_ID                NUMBER(12,0)  NOT NULL,
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    PAYER                   VARCHAR(120)  NOT NULL,
    AMOUNT_PAISE            NUMBER(18,0)  NOT NULL,
    REPORTED_ON             DATE          NOT NULL,
    CONSTRAINT PK_AIS_INTEREST PRIMARY KEY (ENTRY_ID),
    CONSTRAINT FK_AIS_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- Challan receipts the taxpayer holds.
CREATE OR REPLACE TABLE CHALLAN (
    CHALLAN_ID              NUMBER(12,0)  NOT NULL,
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    KIND                    VARCHAR(20)   NOT NULL,   -- 'advance-tax' | 'self-assessment'
    CIN                     VARCHAR(40)   NOT NULL,
    AMOUNT_PAISE            NUMBER(18,0)  NOT NULL,
    PAID_AT                 TIMESTAMP_NTZ NOT NULL,
    CONSTRAINT PK_CHALLAN PRIMARY KEY (CHALLAN_ID),
    CONSTRAINT FK_CHALLAN_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- What the return's taxes-paid schedule actually shows.
-- A challan with no matching row here is the sync failure.
CREATE OR REPLACE TABLE TAX_CREDIT (
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    CIN                     VARCHAR(40)   NOT NULL,
    AMOUNT_PAISE            NUMBER(18,0)  NOT NULL,
    CONSTRAINT PK_TAX_CREDIT PRIMARY KEY (TAXPAYER_ID, CIN),
    CONSTRAINT FK_CREDIT_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- Income taxed at special rates, which the rebate interacts with.
CREATE OR REPLACE TABLE SPECIAL_RATE_INCOME (
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    SECTION                 VARCHAR(10)   NOT NULL,   -- 111A | 112A | 112 | 115BBH
    AMOUNT_PAISE            NUMBER(18,0)  NOT NULL,
    CONSTRAINT PK_SPECIAL_RATE PRIMARY KEY (TAXPAYER_ID, SECTION),
    CONSTRAINT FK_SPECIAL_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);

-- Notices issued, and how many of the documents they name are on record.
CREATE OR REPLACE TABLE NOTICE (
    NOTICE_ID               NUMBER(12,0)  NOT NULL,
    TAXPAYER_ID             NUMBER(10,0)  NOT NULL,
    CODE                    VARCHAR(20)   NOT NULL,   -- e.g. 139(9)
    ISSUED_ON               DATE          NOT NULL,
    RESPOND_BY              DATE          NOT NULL,
    DOCS_REQUIRED           NUMBER(4,0)   NOT NULL,
    DOCS_ON_RECORD          NUMBER(4,0)   NOT NULL,
    CONSTRAINT PK_NOTICE PRIMARY KEY (NOTICE_ID),
    CONSTRAINT FK_NOTICE_TAXPAYER FOREIGN KEY (TAXPAYER_ID) REFERENCES TAXPAYER (TAXPAYER_ID)
);


-- Reference: the six issue categories from the portal research.
CREATE OR REPLACE TABLE ISSUE_CATEGORY (
    CATEGORY_CODE   VARCHAR(40)   NOT NULL,
    TITLE           VARCHAR(200)  NOT NULL,
    STATUTE_REFS    VARCHAR(200),
    CONSTRAINT PK_ISSUE_CATEGORY PRIMARY KEY (CATEGORY_CODE)
);

INSERT INTO ISSUE_CATEGORY (CATEGORY_CODE, TITLE, STATUTE_REFS) VALUES
    ('CHALLAN_SYNC',        'Challan synchronisation latency',            '139(4), 234F'),
    ('REBATE_SPECIAL_RATE', 'Rebate against special-rate income',         '87A, 111A, 112A, 112, 115BBH'),
    ('AUTH_EVERIFICATION',  'Authentication and e-verification window',   NULL),
    ('RECORD_MISMATCH',     'AIS, Form 26AS and Form 16 mismatches',      '139(9), 80CCD(2)'),
    ('REFUND_HOLD',         'Automated refund review',                    NULL),
    ('LEGACY_DEMAND',       'Legacy demand revival',                      '245');
