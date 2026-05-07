package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// FindExistingContactID runs the UpsertContactFromSource match priority
// (phone_normalized → lower(email) → source_type+source_id) against the
// contacts table and returns the matched ID, or "" if no match.
//
// Used by the admin backfill endpoint to count wouldCreate vs wouldUpdate
// in dry-run mode without writing anything.
func (d *DB) FindExistingContactID(ctx context.Context, src SourceRow) (string, error) {
	phoneNorm := normalizePhone(src.Phone)
	emailLower := strings.ToLower(strings.TrimSpace(src.Email))

	if phoneNorm != "" {
		var id string
		err := d.pool.QueryRowContext(ctx,
			`SELECT id FROM contacts WHERE phone_normalized = $1 AND phone_normalized != '' LIMIT 1`,
			phoneNorm,
		).Scan(&id)
		if err == nil {
			return id, nil
		}
		if err != sql.ErrNoRows {
			return "", fmt.Errorf("contacts: find phone: %w", err)
		}
	}
	if emailLower != "" {
		var id string
		err := d.pool.QueryRowContext(ctx,
			`SELECT id FROM contacts WHERE lower(email) = $1 AND email IS NOT NULL AND email != '' LIMIT 1`,
			emailLower,
		).Scan(&id)
		if err == nil {
			return id, nil
		}
		if err != sql.ErrNoRows {
			return "", fmt.Errorf("contacts: find email: %w", err)
		}
	}
	var id string
	err := d.pool.QueryRowContext(ctx,
		`SELECT id FROM contacts WHERE source_type = $1 AND source_id = $2 LIMIT 1`,
		src.Kind, src.SourceID,
	).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("contacts: find source: %w", err)
	}
	return id, nil
}
