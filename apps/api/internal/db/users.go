package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// User represents a row from the users table.
type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	DiscordID    string     `json:"discordId"`
	GoogleID     string     `json:"googleId"`
	DisplayName  string     `json:"displayName"`
	AvatarURL    string     `json:"avatarUrl"`
	OrgID        string     `json:"orgId"`
	RoleID       string     `json:"roleId"`
	IsActive     bool       `json:"isActive"`
	LastLoginAt  *time.Time `json:"lastLoginAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

// UserUpdate holds optional fields to update on a user.
type UserUpdate struct {
	Email        *string
	PasswordHash *string
	DiscordID    *string
	GoogleID     *string
	DisplayName  *string
	AvatarURL    *string
	OrgID        *string
	RoleID       *string
	IsActive     *bool
}

// CreateUser inserts a new user row.
func (d *DB) CreateUser(ctx context.Context, u User) error {
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, discord_id, google_id, display_name, avatar_url, org_id, role_id, is_active)
		 VALUES ($1::UUID, $2, $3, $4, NULLIF($5,''), $6, $7, NULLIF($8,'')::UUID, $9::UUID, $10)`,
		u.ID, u.Email, u.PasswordHash, u.DiscordID, u.GoogleID, u.DisplayName, u.AvatarURL,
		u.OrgID, u.RoleID, u.IsActive)
	if err != nil {
		return fmt.Errorf("db: create user: %w", err)
	}
	return nil
}

// GetUserByID returns a user by ID, or nil if not found.
func (d *DB) GetUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	var lastLogin sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(email,''), COALESCE(password_hash,''),
		        COALESCE(discord_id,''), COALESCE(google_id,''),
		        COALESCE(display_name,''), COALESCE(avatar_url,''),
		        COALESCE(org_id::TEXT,''), role_id::TEXT,
		        COALESCE(is_active, true), last_login_at, created_at, updated_at
		 FROM users WHERE id = $1::UUID`, id).Scan(
		&u.ID, &u.Email, &u.PasswordHash,
		&u.DiscordID, &u.GoogleID,
		&u.DisplayName, &u.AvatarURL,
		&u.OrgID, &u.RoleID,
		&u.IsActive, &lastLogin, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get user by id: %w", err)
	}
	u.LastLoginAt = nullTime(lastLogin)
	return &u, nil
}

// GetUserByEmail returns a user by email, or nil if not found.
func (d *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	var lastLogin sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(email,''), COALESCE(password_hash,''),
		        COALESCE(discord_id,''), COALESCE(google_id,''),
		        COALESCE(display_name,''), COALESCE(avatar_url,''),
		        COALESCE(org_id::TEXT,''), role_id::TEXT,
		        COALESCE(is_active, true), last_login_at, created_at, updated_at
		 FROM users WHERE email = $1`, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash,
		&u.DiscordID, &u.GoogleID,
		&u.DisplayName, &u.AvatarURL,
		&u.OrgID, &u.RoleID,
		&u.IsActive, &lastLogin, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get user by email: %w", err)
	}
	u.LastLoginAt = nullTime(lastLogin)
	return &u, nil
}

// GetUserByDiscordID returns a user by Discord ID, or nil if not found.
func (d *DB) GetUserByDiscordID(ctx context.Context, discordID string) (*User, error) {
	var u User
	var lastLogin sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(email,''), COALESCE(password_hash,''),
		        COALESCE(discord_id,''), COALESCE(google_id,''),
		        COALESCE(display_name,''), COALESCE(avatar_url,''),
		        COALESCE(org_id::TEXT,''), role_id::TEXT,
		        COALESCE(is_active, true), last_login_at, created_at, updated_at
		 FROM users WHERE discord_id = $1`, discordID).Scan(
		&u.ID, &u.Email, &u.PasswordHash,
		&u.DiscordID, &u.GoogleID,
		&u.DisplayName, &u.AvatarURL,
		&u.OrgID, &u.RoleID,
		&u.IsActive, &lastLogin, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get user by discord id: %w", err)
	}
	u.LastLoginAt = nullTime(lastLogin)
	return &u, nil
}

// GetUserByGoogleID returns a user by Google ID (sub claim), or nil if not found.
func (d *DB) GetUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
	var u User
	var lastLogin sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(email,''), COALESCE(password_hash,''),
		        COALESCE(discord_id,''), COALESCE(google_id,''),
		        COALESCE(display_name,''), COALESCE(avatar_url,''),
		        COALESCE(org_id::TEXT,''), role_id::TEXT,
		        COALESCE(is_active, true), last_login_at, created_at, updated_at
		 FROM users WHERE google_id = $1`, googleID).Scan(
		&u.ID, &u.Email, &u.PasswordHash,
		&u.DiscordID, &u.GoogleID,
		&u.DisplayName, &u.AvatarURL,
		&u.OrgID, &u.RoleID,
		&u.IsActive, &lastLogin, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get user by google id: %w", err)
	}
	u.LastLoginAt = nullTime(lastLogin)
	return &u, nil
}

// UpdateUser applies partial updates to a user row.
func (d *DB) UpdateUser(ctx context.Context, id string, updates UserUpdate) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	if updates.Email != nil {
		sets = append(sets, fmt.Sprintf("email = $%d", argN))
		args = append(args, *updates.Email)
		argN++
	}
	if updates.PasswordHash != nil {
		sets = append(sets, fmt.Sprintf("password_hash = $%d", argN))
		args = append(args, *updates.PasswordHash)
		argN++
	}
	if updates.DiscordID != nil {
		sets = append(sets, fmt.Sprintf("discord_id = $%d", argN))
		args = append(args, *updates.DiscordID)
		argN++
	}
	if updates.GoogleID != nil {
		sets = append(sets, fmt.Sprintf("google_id = NULLIF($%d,'')", argN))
		args = append(args, *updates.GoogleID)
		argN++
	}
	if updates.DisplayName != nil {
		sets = append(sets, fmt.Sprintf("display_name = $%d", argN))
		args = append(args, *updates.DisplayName)
		argN++
	}
	if updates.AvatarURL != nil {
		sets = append(sets, fmt.Sprintf("avatar_url = $%d", argN))
		args = append(args, *updates.AvatarURL)
		argN++
	}
	if updates.OrgID != nil {
		sets = append(sets, fmt.Sprintf("org_id = NULLIF($%d,'')::UUID", argN))
		args = append(args, *updates.OrgID)
		argN++
	}
	if updates.RoleID != nil {
		sets = append(sets, fmt.Sprintf("role_id = $%d::UUID", argN))
		args = append(args, *updates.RoleID)
		argN++
	}
	if updates.IsActive != nil {
		sets = append(sets, fmt.Sprintf("is_active = $%d", argN))
		args = append(args, *updates.IsActive)
		argN++
	}

	if len(args) == 0 {
		return nil
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d::UUID",
		strings.Join(sets, ", "), argN)
	_, err := d.pool.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("db: update user: %w", err)
	}
	return nil
}

// ListUsers returns all users ordered by creation date.
func (d *DB) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, COALESCE(email,''), COALESCE(password_hash,''),
		        COALESCE(discord_id,''), COALESCE(google_id,''),
		        COALESCE(display_name,''), COALESCE(avatar_url,''),
		        COALESCE(org_id::TEXT,''), role_id::TEXT,
		        COALESCE(is_active, true), last_login_at, created_at, updated_at
		 FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: list users: %w", err)
	}
	defer rows.Close()

	var result []User
	for rows.Next() {
		var u User
		var lastLogin sql.NullTime
		if err := rows.Scan(
			&u.ID, &u.Email, &u.PasswordHash,
			&u.DiscordID, &u.GoogleID,
			&u.DisplayName, &u.AvatarURL,
			&u.OrgID, &u.RoleID,
			&u.IsActive, &lastLogin, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan user: %w", err)
		}
		u.LastLoginAt = nullTime(lastLogin)
		result = append(result, u)
	}
	return result, rows.Err()
}

// UpdateLastLogin sets last_login_at to NOW() for the given user.
func (d *DB) UpdateLastLogin(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: update last login: %w", err)
	}
	return nil
}
