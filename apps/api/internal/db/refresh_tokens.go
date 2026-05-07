package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// RefreshToken represents a row from the refresh_tokens table.
type RefreshToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateRefreshToken inserts a new refresh token and returns its generated UUID.
func (d *DB) CreateRefreshToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1::UUID, $2, $3)
		 RETURNING id::TEXT`, userID, tokenHash, expiresAt).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create refresh token: %w", err)
	}
	return id, nil
}

// GetRefreshToken returns a refresh token by ID, or nil if not found.
func (d *DB) GetRefreshToken(ctx context.Context, id string) (*RefreshToken, error) {
	var rt RefreshToken
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, user_id::TEXT, token_hash, expires_at, created_at
		 FROM refresh_tokens WHERE id = $1::UUID`, id).Scan(
		&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get refresh token: %w", err)
	}
	return &rt, nil
}

// GetRefreshTokenByHash returns a refresh token by its hash, or nil if not found.
func (d *DB) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	var rt RefreshToken
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, user_id::TEXT, token_hash, expires_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`, tokenHash).Scan(
		&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get refresh token by hash: %w", err)
	}
	return &rt, nil
}

// DeleteRefreshToken deletes a single refresh token by ID.
func (d *DB) DeleteRefreshToken(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: delete refresh token: %w", err)
	}
	return nil
}

// DeleteUserRefreshTokens deletes all refresh tokens for a given user.
func (d *DB) DeleteUserRefreshTokens(ctx context.Context, userID string) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE user_id = $1::UUID`, userID)
	if err != nil {
		return fmt.Errorf("db: delete user refresh tokens: %w", err)
	}
	return nil
}

// CleanupExpiredTokens removes all refresh tokens that have passed their expiration.
func (d *DB) CleanupExpiredTokens(ctx context.Context) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE expires_at < NOW()`)
	if err != nil {
		return fmt.Errorf("db: cleanup expired tokens: %w", err)
	}
	return nil
}
