-- CRM M0 LSP-clean subtype views.
-- Re-created idempotently on every startup via CREATE OR REPLACE.
-- LSP contract: every read that only needs Contact supertype fields reads
-- `contacts` directly. Every read that needs subtype-specific fields reads
-- the matching profile view, never JOINs across source tables.
--
-- Any future column added to recruits / sales / agent_leads MUST be
-- reflected here in the same commit. Enforce via CODEOWNERS on this file.

CREATE OR REPLACE VIEW contact_recruit_profile AS
SELECT r.*,
       c.lifecycle_stage AS contact_lifecycle_stage,
       c.status          AS contact_status,
       c.owner_agent_id  AS contact_owner_agent_id,
       c.do_not_sms      AS contact_do_not_sms,
       c.do_not_email    AS contact_do_not_email,
       c.do_not_call     AS contact_do_not_call
FROM recruits r
LEFT JOIN contacts c ON c.source_type = 'recruit' AND c.source_id = r.id::TEXT;

CREATE OR REPLACE VIEW contact_sale_profile AS
SELECT s.*,
       c.lifecycle_stage AS contact_lifecycle_stage,
       c.status          AS contact_status,
       c.owner_agent_id  AS contact_owner_agent_id,
       c.do_not_sms      AS contact_do_not_sms,
       c.do_not_email    AS contact_do_not_email,
       c.do_not_call     AS contact_do_not_call
FROM sales s
LEFT JOIN contacts c ON c.source_type = 'sale' AND c.source_id = s.id::TEXT;

CREATE OR REPLACE VIEW contact_agent_lead_profile AS
SELECT al.*,
       c.lifecycle_stage AS contact_lifecycle_stage,
       c.status          AS contact_status,
       c.owner_agent_id  AS contact_owner_agent_id,
       c.do_not_sms      AS contact_do_not_sms,
       c.do_not_email    AS contact_do_not_email,
       c.do_not_call     AS contact_do_not_call
FROM agent_leads al
LEFT JOIN contacts c ON c.source_type = 'agent_lead' AND c.source_id = al.id::TEXT;
