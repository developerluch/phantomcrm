package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/oklog/ulid/v2"
	"phantomcrm-api/internal/events"
)

// Address is a physical address attached to a contact. Multiple addresses per
// contact are supported (mailing, home, work, prior, policy). Exactly one
// address per contact may be marked primary (enforced by a partial unique
// index).
type Address struct {
	ID         string     `json:"id"`
	ContactID  string     `json:"contactId"`
	Kind       string     `json:"kind"`
	Line1      *string    `json:"line1,omitempty"`
	Line2      *string    `json:"line2,omitempty"`
	City       *string    `json:"city,omitempty"`
	State      *string    `json:"state,omitempty"`
	PostalCode *string    `json:"postalCode,omitempty"`
	Country    *string    `json:"country,omitempty"`
	IsPrimary  bool       `json:"isPrimary"`
	VerifiedAt *time.Time `json:"verifiedAt,omitempty"`
	Source     *string    `json:"source,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// AddressInput is the write payload for Create/Update. Nil pointer fields on
// Update mean "do not change"; on Create they mean "unset / NULL."
type AddressInput struct {
	Kind       string
	Line1      *string
	Line2      *string
	City       *string
	State      *string
	PostalCode *string
	Country    *string
	IsPrimary  bool
	Source     *string
}

// CreateAddress inserts a new address for a contact. If IsPrimary is true,
// any existing primary for the contact is demoted in the same transaction
// so the partial unique index is never violated. Publishes address.created
// (and address.primary_changed when applicable).
func (d *DB) CreateAddress(ctx context.Context, contactID string, in AddressInput) (*Address, error) {
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("addresses: begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	pub := events.NewPgPublisher(tx)

	var previousPrimary *string
	if in.IsPrimary {
		demoted, err := d.demotePrimaryAddressTx(ctx, tx, contactID)
		if err != nil {
			return nil, err
		}
		previousPrimary = demoted
	}

	id := ulid.Make().String()
	kind := in.Kind
	if kind == "" {
		kind = "mailing"
	}
	country := in.Country
	if country == nil {
		defaultCountry := "US"
		country = &defaultCountry
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO addresses (id, contact_id, kind, line1, line2, city, state, postal_code, country, is_primary, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		id, contactID, kind, in.Line1, in.Line2, in.City, in.State, in.PostalCode, country, in.IsPrimary, in.Source,
	)
	if err != nil {
		return nil, fmt.Errorf("addresses: insert: %w", err)
	}

	if err := pub.Publish(ctx, events.Event{
		Type:        events.TypeAddressCreated,
		ContactID:   &contactID,
		SubjectType: "address",
		SubjectID:   id,
		Payload: map[string]any{
			"kind":       kind,
			"isPrimary":  in.IsPrimary,
			"line1":      derefOr(in.Line1, ""),
			"city":       derefOr(in.City, ""),
			"state":      derefOr(in.State, ""),
			"postalCode": derefOr(in.PostalCode, ""),
		},
	}); err != nil {
		return nil, err
	}

	if previousPrimary != nil {
		if err := pub.Publish(ctx, events.Event{
			Type:        events.TypeAddressPrimaryChanged,
			ContactID:   &contactID,
			SubjectType: "contact",
			SubjectID:   contactID,
			Payload: map[string]any{
				"fromAddressId": *previousPrimary,
				"toAddressId":   id,
			},
		}); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("addresses: commit: %w", err)
	}

	return d.GetAddress(ctx, id)
}

// GetAddress loads a single address row.
func (d *DB) GetAddress(ctx context.Context, id string) (*Address, error) {
	var a Address
	var line1, line2, city, state, postal, country, source sql.NullString
	var verifiedAt sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id, contact_id, kind, line1, line2, city, state, postal_code, country,
		        is_primary, verified_at, source, created_at, updated_at
		 FROM addresses WHERE id = $1`, id,
	).Scan(&a.ID, &a.ContactID, &a.Kind, &line1, &line2, &city, &state, &postal, &country,
		&a.IsPrimary, &verifiedAt, &source, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("addresses: get: %w", err)
	}
	if line1.Valid {
		a.Line1 = &line1.String
	}
	if line2.Valid {
		a.Line2 = &line2.String
	}
	if city.Valid {
		a.City = &city.String
	}
	if state.Valid {
		a.State = &state.String
	}
	if postal.Valid {
		a.PostalCode = &postal.String
	}
	if country.Valid {
		a.Country = &country.String
	}
	if source.Valid {
		a.Source = &source.String
	}
	if verifiedAt.Valid {
		a.VerifiedAt = &verifiedAt.Time
	}
	return &a, nil
}

// GetAddressesForContact returns all addresses for a contact ordered with the
// primary address first, then by created_at DESC.
func (d *DB) GetAddressesForContact(ctx context.Context, contactID string) ([]Address, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id, contact_id, kind, line1, line2, city, state, postal_code, country,
		        is_primary, verified_at, source, created_at, updated_at
		 FROM addresses WHERE contact_id = $1
		 ORDER BY is_primary DESC, created_at DESC`, contactID,
	)
	if err != nil {
		return nil, fmt.Errorf("addresses: list: %w", err)
	}
	defer rows.Close()

	out := []Address{}
	for rows.Next() {
		var a Address
		var line1, line2, city, state, postal, country, source sql.NullString
		var verifiedAt sql.NullTime
		if err := rows.Scan(&a.ID, &a.ContactID, &a.Kind, &line1, &line2, &city, &state, &postal, &country,
			&a.IsPrimary, &verifiedAt, &source, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("addresses: scan: %w", err)
		}
		if line1.Valid {
			a.Line1 = &line1.String
		}
		if line2.Valid {
			a.Line2 = &line2.String
		}
		if city.Valid {
			a.City = &city.String
		}
		if state.Valid {
			a.State = &state.String
		}
		if postal.Valid {
			a.PostalCode = &postal.String
		}
		if country.Valid {
			a.Country = &country.String
		}
		if source.Valid {
			a.Source = &source.String
		}
		if verifiedAt.Valid {
			a.VerifiedAt = &verifiedAt.Time
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("addresses: rows: %w", err)
	}
	return out, nil
}

// UpdateAddress applies a partial update. Nil pointers in the input mean
// "do not change." Publishes address.updated (and address.primary_changed
// when primary flips).
func (d *DB) UpdateAddress(ctx context.Context, id string, in AddressInput) (*Address, error) {
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("addresses: begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	pub := events.NewPgPublisher(tx)

	var contactID string
	var wasPrimary bool
	if err := tx.QueryRowContext(ctx,
		`SELECT contact_id, is_primary FROM addresses WHERE id = $1`, id,
	).Scan(&contactID, &wasPrimary); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("addresses: load: %w", err)
	}

	var previousPrimary *string
	if in.IsPrimary && !wasPrimary {
		demoted, err := d.demotePrimaryAddressTx(ctx, tx, contactID)
		if err != nil {
			return nil, err
		}
		previousPrimary = demoted
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE addresses SET
			kind        = COALESCE(NULLIF($1, ''), kind),
			line1       = COALESCE($2, line1),
			line2       = COALESCE($3, line2),
			city        = COALESCE($4, city),
			state       = COALESCE($5, state),
			postal_code = COALESCE($6, postal_code),
			country     = COALESCE($7, country),
			is_primary  = $8,
			source      = COALESCE($9, source),
			updated_at  = NOW()
		 WHERE id = $10`,
		in.Kind, in.Line1, in.Line2, in.City, in.State, in.PostalCode, in.Country, in.IsPrimary, in.Source, id,
	)
	if err != nil {
		return nil, fmt.Errorf("addresses: update: %w", err)
	}

	if err := pub.Publish(ctx, events.Event{
		Type:        events.TypeAddressUpdated,
		ContactID:   &contactID,
		SubjectType: "address",
		SubjectID:   id,
		Payload: map[string]any{
			"kind":      in.Kind,
			"isPrimary": in.IsPrimary,
		},
	}); err != nil {
		return nil, err
	}

	if previousPrimary != nil {
		if err := pub.Publish(ctx, events.Event{
			Type:        events.TypeAddressPrimaryChanged,
			ContactID:   &contactID,
			SubjectType: "contact",
			SubjectID:   contactID,
			Payload: map[string]any{
				"fromAddressId": *previousPrimary,
				"toAddressId":   id,
			},
		}); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("addresses: commit: %w", err)
	}
	return d.GetAddress(ctx, id)
}

// DeleteAddress removes an address and publishes address.deleted.
func (d *DB) DeleteAddress(ctx context.Context, id string) error {
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("addresses: begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var contactID string
	if err := tx.QueryRowContext(ctx,
		`SELECT contact_id FROM addresses WHERE id = $1`, id,
	).Scan(&contactID); err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return fmt.Errorf("addresses: load: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM addresses WHERE id = $1`, id); err != nil {
		return fmt.Errorf("addresses: delete: %w", err)
	}

	pub := events.NewPgPublisher(tx)
	if err := pub.Publish(ctx, events.Event{
		Type:        events.TypeAddressDeleted,
		ContactID:   &contactID,
		SubjectType: "address",
		SubjectID:   id,
		Payload:     map[string]any{"addressId": id},
	}); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("addresses: commit: %w", err)
	}
	return nil
}

// SetPrimaryAddress promotes one address to primary, demoting the previous
// primary. Publishes address.primary_changed.
func (d *DB) SetPrimaryAddress(ctx context.Context, contactID, addressID string) error {
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("addresses: begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	previous, err := d.demotePrimaryAddressTx(ctx, tx, contactID)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE addresses SET is_primary = true, updated_at = NOW() WHERE id = $1 AND contact_id = $2`,
		addressID, contactID,
	); err != nil {
		return fmt.Errorf("addresses: promote: %w", err)
	}

	pub := events.NewPgPublisher(tx)
	payload := map[string]any{"toAddressId": addressID}
	if previous != nil {
		payload["fromAddressId"] = *previous
	}
	if err := pub.Publish(ctx, events.Event{
		Type:        events.TypeAddressPrimaryChanged,
		ContactID:   &contactID,
		SubjectType: "contact",
		SubjectID:   contactID,
		Payload:     payload,
	}); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("addresses: commit: %w", err)
	}
	return nil
}

// demotePrimaryAddressTx clears is_primary on the current primary for a
// contact, returning its ID if there was one. Idempotent.
func (d *DB) demotePrimaryAddressTx(ctx context.Context, tx *sql.Tx, contactID string) (*string, error) {
	var previousID sql.NullString
	err := tx.QueryRowContext(ctx,
		`SELECT id FROM addresses WHERE contact_id = $1 AND is_primary = true LIMIT 1`,
		contactID,
	).Scan(&previousID)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("addresses: load primary: %w", err)
	}
	if !previousID.Valid {
		return nil, nil
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE addresses SET is_primary = false, updated_at = NOW() WHERE id = $1`,
		previousID.String,
	); err != nil {
		return nil, fmt.Errorf("addresses: demote: %w", err)
	}
	return &previousID.String, nil
}

// insertAddressFromSourceTx is called during contact insert to synthesize a
// primary mailing address when the source row carries physical address
// fields. No-op if the source has no address data.
func (d *DB) insertAddressFromSourceTx(ctx context.Context, tx *sql.Tx, pub events.Publisher, contactID string, src SourceRow) error {
	if !hasAddress(src) {
		return nil
	}
	id := ulid.Make().String()
	country := src.Country
	if country == "" {
		country = "US"
	}
	source := "source:" + src.Kind
	_, err := tx.ExecContext(ctx,
		`INSERT INTO addresses (id, contact_id, kind, line1, line2, city, state, postal_code, country, is_primary, source)
		 VALUES ($1, $2, 'mailing', $3, $4, $5, $6, $7, $8, true, $9)`,
		id, contactID,
		nullIfEmpty(src.AddressLine1),
		nullIfEmpty(src.AddressLine2),
		nullIfEmpty(src.City),
		nullIfEmpty(src.State),
		nullIfEmpty(src.PostalCode),
		country,
		source,
	)
	if err != nil {
		return fmt.Errorf("addresses: synth insert: %w", err)
	}
	return pub.Publish(ctx, events.Event{
		Type:        events.TypeAddressCreated,
		ContactID:   &contactID,
		SubjectType: "address",
		SubjectID:   id,
		Payload: map[string]any{
			"kind":      "mailing",
			"isPrimary": true,
			"source":    source,
		},
	})
}
