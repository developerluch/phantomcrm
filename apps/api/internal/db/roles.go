package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lib/pq"
)

// Role represents a row from the roles table.
type Role struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"isSystem"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
}

// GetRoleByID returns a role by ID, or nil if not found.
func (d *DB) GetRoleByID(ctx context.Context, id string) (*Role, error) {
	var r Role
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, name, permissions, COALESCE(is_system, false), sort_order, created_at
		 FROM roles WHERE id = $1::UUID`, id).Scan(
		&r.ID, &r.Name, pq.Array(&r.Permissions), &r.IsSystem, &r.SortOrder, &r.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get role by id: %w", err)
	}
	return &r, nil
}

// GetRoleByName returns a role by name, or nil if not found.
func (d *DB) GetRoleByName(ctx context.Context, name string) (*Role, error) {
	var r Role
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, name, permissions, COALESCE(is_system, false), sort_order, created_at
		 FROM roles WHERE name = $1`, name).Scan(
		&r.ID, &r.Name, pq.Array(&r.Permissions), &r.IsSystem, &r.SortOrder, &r.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get role by name: %w", err)
	}
	return &r, nil
}

// ListRoles returns all roles ordered by sort_order.
func (d *DB) ListRoles(ctx context.Context) ([]Role, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, name, permissions, COALESCE(is_system, false), sort_order, created_at
		 FROM roles ORDER BY sort_order`)
	if err != nil {
		return nil, fmt.Errorf("db: list roles: %w", err)
	}
	defer rows.Close()

	var result []Role
	for rows.Next() {
		var r Role
		if err := rows.Scan(&r.ID, &r.Name, pq.Array(&r.Permissions), &r.IsSystem, &r.SortOrder, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("db: scan role: %w", err)
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// CreateRole inserts a new role and returns its generated UUID.
func (d *DB) CreateRole(ctx context.Context, name string, permissions []string) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO roles (name, permissions, sort_order)
		 VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order),0)+1 FROM roles))
		 RETURNING id::TEXT`, name, pq.Array(permissions)).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create role: %w", err)
	}
	return id, nil
}

// UpdateRole updates the name and permissions of an existing role.
func (d *DB) UpdateRole(ctx context.Context, id string, name string, permissions []string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE roles SET name = $1, permissions = $2 WHERE id = $3::UUID`,
		name, pq.Array(permissions), id)
	if err != nil {
		return fmt.Errorf("db: update role: %w", err)
	}
	return nil
}

// DeleteRole deletes a role by ID.
func (d *DB) DeleteRole(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM roles WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: delete role: %w", err)
	}
	return nil
}
