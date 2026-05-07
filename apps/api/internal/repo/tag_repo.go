package repo

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// TagRepo handles per-contact tag mutations. Bulk operations go through
// DispatchBulk in bulk.go — this repo is for the single-contact paths the
// detail drawer hits (add a tag, remove a tag) plus the autocomplete source
// for the TagPicker.
type TagRepo struct {
	pool *sql.DB
}

// NewTagRepo binds a repo to a connection pool.
func NewTagRepo(pool *sql.DB) *TagRepo {
	return &TagRepo{pool: pool}
}

// AddTag attaches tag to a contact visible to scope. No-op if the tag is
// already attached. Returns ErrNotFound when the contact is not visible.
func (r *TagRepo) AddTag(ctx context.Context, contactID, tag string, scope ActorScope) error {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return fmt.Errorf("%w: tag must be non-empty", ErrInvalidPayload)
	}
	if len(tag) > 64 {
		return fmt.Errorf("%w: tag too long", ErrInvalidPayload)
	}
	if err := r.assertVisible(ctx, contactID, scope); err != nil {
		return err
	}
	_, err := r.pool.ExecContext(ctx,
		`INSERT INTO contact_tags (contact_id, tag) VALUES ($1, $2)
		 ON CONFLICT (contact_id, tag) DO NOTHING`,
		contactID, tag,
	)
	if err != nil {
		return fmt.Errorf("tags: add: %w", err)
	}
	return nil
}

// RemoveTag detaches tag from a contact visible to scope. No-op if absent.
func (r *TagRepo) RemoveTag(ctx context.Context, contactID, tag string, scope ActorScope) error {
	if err := r.assertVisible(ctx, contactID, scope); err != nil {
		return err
	}
	_, err := r.pool.ExecContext(ctx,
		`DELETE FROM contact_tags WHERE contact_id = $1 AND tag = $2`,
		contactID, strings.TrimSpace(tag),
	)
	if err != nil {
		return fmt.Errorf("tags: remove: %w", err)
	}
	return nil
}

// ListDistinctTags returns every tag in use, sorted alphabetically. Powers
// the TagPicker autocomplete. No visibility filter — tag names alone are not
// PII and matching current-state fan-out is already constrained by the
// contacts the actor can see in the picker's result view.
func (r *TagRepo) ListDistinctTags(ctx context.Context) ([]string, error) {
	rows, err := r.pool.QueryContext(ctx,
		`SELECT DISTINCT tag FROM contact_tags ORDER BY tag`)
	if err != nil {
		return nil, fmt.Errorf("tags: list distinct: %w", err)
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// assertVisible returns ErrNotFound when the contact does not exist or is
// outside the scope. Piggybacks on the scoped visibilityTail so tag writes
// can't escape the owner/shared predicate.
func (r *TagRepo) assertVisible(ctx context.Context, contactID string, scope ActorScope) error {
	visSQL, visArgs := visibilityTail(Contact{}, scope, 2)
	q := fmt.Sprintf(`SELECT 1 FROM contacts WHERE id = $1%s LIMIT 1`, visSQL)
	args := append([]any{contactID}, visArgs...)
	var one int
	err := r.pool.QueryRowContext(ctx, q, args...).Scan(&one)
	if err == sql.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("tags: visibility check: %w", err)
	}
	return nil
}
