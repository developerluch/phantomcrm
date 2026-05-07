package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Address mirrors the addresses table. Multiple addresses per contact (kind:
// mailing/home/work/prior) are supported; is_primary is unique per contact
// (enforced by M0 migration's uq_addresses_primary).
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

// ListAddressesForContact returns every address attached to contactID. The
// caller is responsible for having already verified the contact is visible
// to the actor — this helper does not enforce visibility on addresses
// because addresses have no scope of their own.
func ListAddressesForContact(ctx context.Context, pool *sql.DB, contactID string) ([]Address, error) {
	const q = `SELECT id, contact_id, kind, line1, line2, city, state, postal_code,
		country, is_primary, verified_at, source, created_at, updated_at
		FROM addresses WHERE contact_id = $1
		ORDER BY is_primary DESC, kind, created_at`
	rows, err := pool.QueryContext(ctx, q, contactID)
	if err != nil {
		return nil, fmt.Errorf("addresses: list: %w", err)
	}
	defer rows.Close()
	out := []Address{}
	for rows.Next() {
		a, err := scanAddress(rows)
		if err != nil {
			return nil, fmt.Errorf("addresses: scan: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func scanAddress(s scanner) (Address, error) {
	var (
		a          Address
		line1      sql.NullString
		line2      sql.NullString
		city       sql.NullString
		state      sql.NullString
		postalCode sql.NullString
		country    sql.NullString
		source     sql.NullString
		verifiedAt sql.NullTime
	)
	if err := s.Scan(
		&a.ID, &a.ContactID, &a.Kind,
		&line1, &line2, &city, &state, &postalCode, &country,
		&a.IsPrimary, &verifiedAt, &source,
		&a.CreatedAt, &a.UpdatedAt,
	); err != nil {
		return Address{}, err
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
	if postalCode.Valid {
		a.PostalCode = &postalCode.String
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
	return a, nil
}
