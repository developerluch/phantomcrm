package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/developerluch/phantomcrm/apps/api/internal/events"
)

// AddTag attaches a tag to a contact. Idempotent — re-adding is a no-op.
// Publishes contact.tagged exactly once per logical add (no event emitted
// on a no-op).
func (d *DB) AddTag(ctx context.Context, contactID, tag string, actorAgentID *string) error {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return fmt.Errorf("contact_tags: tag is empty")
	}
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("contact_tags: begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx,
		`INSERT INTO contact_tags (contact_id, tag) VALUES ($1, $2)
		 ON CONFLICT (contact_id, tag) DO NOTHING`,
		contactID, tag,
	)
	if err != nil {
		return fmt.Errorf("contact_tags: insert: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		// Already present — commit the empty tx and skip the event.
		return tx.Commit()
	}

	pub := events.NewPgPublisher(tx)
	if err := pub.Publish(ctx, events.Event{
		Type:         events.TypeContactTagged,
		ActorAgentID: actorAgentID,
		ContactID:    &contactID,
		SubjectType:  "contact",
		SubjectID:    contactID,
		Payload:      map[string]any{"tag": tag},
	}); err != nil {
		return err
	}
	return tx.Commit()
}

// RemoveTag detaches a tag from a contact. Idempotent — removing a missing
// tag is a no-op. Publishes contact.untagged only when a row was actually
// deleted.
func (d *DB) RemoveTag(ctx context.Context, contactID, tag string, actorAgentID *string) error {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return nil
	}
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("contact_tags: begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx,
		`DELETE FROM contact_tags WHERE contact_id = $1 AND tag = $2`,
		contactID, tag,
	)
	if err != nil {
		return fmt.Errorf("contact_tags: delete: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return tx.Commit()
	}

	pub := events.NewPgPublisher(tx)
	if err := pub.Publish(ctx, events.Event{
		Type:         events.TypeContactUntagged,
		ActorAgentID: actorAgentID,
		ContactID:    &contactID,
		SubjectType:  "contact",
		SubjectID:    contactID,
		Payload:      map[string]any{"tag": tag},
	}); err != nil {
		return err
	}
	return tx.Commit()
}

// GetTagsForContact returns the sorted tag list for a contact.
func (d *DB) GetTagsForContact(ctx context.Context, contactID string) ([]string, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT tag FROM contact_tags WHERE contact_id = $1 ORDER BY tag`,
		contactID,
	)
	if err != nil {
		return nil, fmt.Errorf("contact_tags: list: %w", err)
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, fmt.Errorf("contact_tags: scan: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
