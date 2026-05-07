package db

import (
	"context"
	_ "embed"
	"fmt"
)

//go:embed views.sql
var crmViewsSQL string

// migrateCRMM0 runs the CRM M0 foundations (Phase 40).
// Additive only: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
// CREATE OR REPLACE VIEW. No DROP, no renames.
func (d *DB) migrateCRMM0(ctx context.Context) error {
	stmts := []string{
		// ── Contacts supertype ──────────────────────────────
		`CREATE TABLE IF NOT EXISTS contacts (
			id                TEXT PRIMARY KEY,
			source_type       TEXT NOT NULL,
			source_id         TEXT,
			owner_agent_id    TEXT,
			first_name        TEXT,
			last_name         TEXT,
			full_name         TEXT,
			email             TEXT,
			phone             TEXT,
			phone_normalized  TEXT,
			dob               TEXT,
			lifecycle_stage   TEXT DEFAULT 'lead',
			status            TEXT DEFAULT 'active',
			do_not_sms        BOOLEAN DEFAULT false,
			do_not_email      BOOLEAN DEFAULT false,
			do_not_call       BOOLEAN DEFAULT false,
			custom_fields     JSONB DEFAULT '{}'::jsonb,
			created_at        TIMESTAMPTZ DEFAULT now(),
			updated_at        TIMESTAMPTZ DEFAULT now(),
			last_activity_at  TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_owner      ON contacts(owner_agent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_phone_norm ON contacts(phone_normalized)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_email      ON contacts(lower(email))`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle  ON contacts(lifecycle_stage)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_source     ON contacts(source_type, source_id)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_updated    ON contacts(updated_at DESC)`,

		// ── Tags ────────────────────────────────────────────
		`CREATE TABLE IF NOT EXISTS contact_tags (
			contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
			tag        TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT now(),
			PRIMARY KEY (contact_id, tag)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag)`,

		// ── Source-table FKs (nullable; tightened in a later migration after backfill) ──
		`ALTER TABLE IF EXISTS recruits    ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id)`,
		`ALTER TABLE IF EXISTS sales       ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id)`,
		`ALTER TABLE IF EXISTS agent_leads ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id)`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_contact    ON recruits(contact_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sales_contact       ON sales(contact_id)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_leads_contact ON agent_leads(contact_id)`,

		// ── Addresses (physical; separate from contacts to support mailing/home/work/prior) ──
		`CREATE TABLE IF NOT EXISTS addresses (
			id              TEXT PRIMARY KEY,
			contact_id      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
			kind            TEXT NOT NULL DEFAULT 'mailing',
			line1           TEXT,
			line2           TEXT,
			city            TEXT,
			state           TEXT,
			postal_code     TEXT,
			country         TEXT DEFAULT 'US',
			is_primary      BOOLEAN DEFAULT false,
			verified_at     TIMESTAMPTZ,
			source          TEXT,
			created_at      TIMESTAMPTZ DEFAULT now(),
			updated_at      TIMESTAMPTZ DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_addresses_contact ON addresses(contact_id)`,
		`CREATE INDEX IF NOT EXISTS idx_addresses_state   ON addresses(state)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_primary ON addresses(contact_id) WHERE is_primary = true`,

		// ── Events append-only log (source of truth for timeline + automations) ──
		`CREATE TABLE IF NOT EXISTS events (
			id               BIGSERIAL PRIMARY KEY,
			type             TEXT NOT NULL,
			occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
			actor_agent_id   TEXT,
			contact_id       TEXT,
			subject_type     TEXT,
			subject_id       TEXT,
			payload          JSONB NOT NULL DEFAULT '{}'::jsonb
		)`,
		`CREATE INDEX IF NOT EXISTS idx_events_contact_time ON events(contact_id, occurred_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_events_type_time    ON events(type, occurred_at DESC)`,
	}

	for _, q := range stmts {
		if _, err := d.pool.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("crm m0 migrate: %w", err)
		}
	}

	// Views are re-created idempotently on every startup.
	if _, err := d.pool.ExecContext(ctx, crmViewsSQL); err != nil {
		return fmt.Errorf("crm m0 views: %w", err)
	}

	return nil
}

// migrateCRMM1 runs the CRM M1 layer (Phase 41): shared visibility column,
// trigram indexes for contains-op filter rules, and the smart_lists table.
// Additive only.
func (d *DB) migrateCRMM1(ctx context.Context) error {
	stmts := []string{
		// ── Shared visibility on contacts (M0 did not ship this column) ──
		`ALTER TABLE IF EXISTS contacts ADD COLUMN IF NOT EXISTS shared_with_agent_discord_ids TEXT[] DEFAULT '{}'::TEXT[]`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_shared ON contacts USING GIN (shared_with_agent_discord_ids)`,

		// ── Trigram indexes for FilterRegistry `contains` op on fullName/email ──
		`CREATE EXTENSION IF NOT EXISTS pg_trgm`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_fullname_trgm ON contacts USING GIN (full_name gin_trgm_ops)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm    ON contacts USING GIN (email     gin_trgm_ops)`,

		// ── Smart lists ────────────────────────────────────
		`CREATE TABLE IF NOT EXISTS smart_lists (
			id                       TEXT PRIMARY KEY,
			name                     TEXT NOT NULL,
			description              TEXT,
			owner_agent_discord_id   TEXT,
			shared_with_agent_ids    TEXT[] DEFAULT '{}'::TEXT[],
			filter_json              JSONB NOT NULL,
			is_pinned                BOOLEAN DEFAULT false,
			created_at               TIMESTAMPTZ DEFAULT now(),
			updated_at               TIMESTAMPTZ DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_smart_lists_owner ON smart_lists(owner_agent_discord_id)`,
	}

	for _, q := range stmts {
		if _, err := d.pool.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("crm m1 migrate: %w", err)
		}
	}

	return nil
}
