package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Organization represents a row from the organizations table.
type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateOrganization inserts a new organization and returns its generated UUID.
func (d *DB) CreateOrganization(ctx context.Context, name, slug string) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO organizations (name, slug)
		 VALUES ($1, $2)
		 RETURNING id::TEXT`, name, slug).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create organization: %w", err)
	}
	return id, nil
}

// GetOrganization returns an organization by ID, or nil if not found.
func (d *DB) GetOrganization(ctx context.Context, id string) (*Organization, error) {
	var o Organization
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, name, slug, created_at, updated_at
		 FROM organizations WHERE id = $1::UUID`, id).Scan(
		&o.ID, &o.Name, &o.Slug, &o.CreatedAt, &o.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get organization: %w", err)
	}
	return &o, nil
}

// GetOrganizationBySlug returns an organization by slug, or nil if not found.
func (d *DB) GetOrganizationBySlug(ctx context.Context, slug string) (*Organization, error) {
	var o Organization
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, name, slug, created_at, updated_at
		 FROM organizations WHERE slug = $1`, slug).Scan(
		&o.ID, &o.Name, &o.Slug, &o.CreatedAt, &o.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get organization by slug: %w", err)
	}
	return &o, nil
}

// ListOrganizations returns all organizations ordered by name.
func (d *DB) ListOrganizations(ctx context.Context) ([]Organization, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, name, slug, created_at, updated_at
		 FROM organizations ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("db: list organizations: %w", err)
	}
	defer rows.Close()

	var result []Organization
	for rows.Next() {
		var o Organization
		if err := rows.Scan(&o.ID, &o.Name, &o.Slug, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, fmt.Errorf("db: scan organization: %w", err)
		}
		result = append(result, o)
	}
	return result, rows.Err()
}

// UpdateOrganization updates an organization's name and slug.
func (d *DB) UpdateOrganization(ctx context.Context, id, name, slug string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE organizations SET name = $2, slug = $3, updated_at = NOW()
		 WHERE id = $1::UUID`, id, name, slug)
	if err != nil {
		return fmt.Errorf("db: update organization: %w", err)
	}
	return nil
}

// DeleteOrganization removes an organization by ID.
func (d *DB) DeleteOrganization(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM organizations WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: delete organization: %w", err)
	}
	return nil
}
