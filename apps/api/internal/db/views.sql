-- CRM M0 LSP-clean subtype views.
-- DROP-then-CREATE on every startup so column additions/renames to the
-- underlying source tables (recruits / sales / agent_leads) can flow through
-- the SELECT *-based view definitions without colliding with Postgres'
-- CREATE OR REPLACE VIEW column-position invariant (error 42P16 — see
-- 2026-05-13 Railway crash triggered by ALTER TABLE sales ADD COLUMN
-- product_name/insured_name/postcard_sent_at shifting s.* in
-- contact_sale_profile).
--
-- LSP contract: every read that only needs Contact supertype fields reads
-- `contacts` directly. Every read that needs subtype-specific fields reads
-- the matching profile view, never JOINs across source tables.
--
-- Any future column added to recruits / sales / agent_leads automatically
-- flows through `SELECT *` here since the views are dropped and recreated
-- every boot. No CODEOWNERS gate required for that case.

DROP VIEW IF EXISTS contact_recruit_profile;
DROP VIEW IF EXISTS contact_sale_profile;
DROP VIEW IF EXISTS contact_agent_lead_profile;

CREATE VIEW contact_recruit_profile AS
SELECT r.*,
       c.lifecycle_stage AS contact_lifecycle_stage,
       c.status          AS contact_status,
       c.owner_agent_id  AS contact_owner_agent_id,
       c.do_not_sms      AS contact_do_not_sms,
       c.do_not_email    AS contact_do_not_email,
       c.do_not_call     AS contact_do_not_call
FROM recruits r
LEFT JOIN contacts c ON c.source_type = 'recruit' AND c.source_id = r.id::TEXT;

CREATE VIEW contact_sale_profile AS
SELECT s.*,
       c.lifecycle_stage AS contact_lifecycle_stage,
       c.status          AS contact_status,
       c.owner_agent_id  AS contact_owner_agent_id,
       c.do_not_sms      AS contact_do_not_sms,
       c.do_not_email    AS contact_do_not_email,
       c.do_not_call     AS contact_do_not_call
FROM sales s
LEFT JOIN contacts c ON c.source_type = 'sale' AND c.source_id = s.id::TEXT;

CREATE VIEW contact_agent_lead_profile AS
SELECT al.*,
       c.lifecycle_stage AS contact_lifecycle_stage,
       c.status          AS contact_status,
       c.owner_agent_id  AS contact_owner_agent_id,
       c.do_not_sms      AS contact_do_not_sms,
       c.do_not_email    AS contact_do_not_email,
       c.do_not_call     AS contact_do_not_call
FROM agent_leads al
LEFT JOIN contacts c ON c.source_type = 'agent_lead' AND c.source_id = al.id::TEXT;
