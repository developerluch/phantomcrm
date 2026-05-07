package db

import (
	"context"
	"time"
)

type UserIntegration struct {
	ID              string     `json:"id"`
	UserID          string     `json:"userId"`
	Provider        string     `json:"provider"`
	AccessTokenEnc  string     `json:"-"`
	RefreshTokenEnc string     `json:"-"`
	TokenExpiry     *time.Time `json:"tokenExpiry,omitempty"`
	Scopes          string     `json:"scopes,omitempty"`
	GoogleEmail     string     `json:"googleEmail,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
}

func (d *DB) GetUserIntegration(ctx context.Context, userID, provider string) (*UserIntegration, error) {
	var ui UserIntegration
	err := d.pool.QueryRowContext(ctx, `SELECT id, user_id, provider, access_token_enc, refresh_token_enc, token_expiry, COALESCE(scopes,''), COALESCE(google_email,''), created_at
		FROM user_integrations WHERE user_id = $1 AND provider = $2`, userID, provider).
		Scan(&ui.ID, &ui.UserID, &ui.Provider, &ui.AccessTokenEnc, &ui.RefreshTokenEnc, &ui.TokenExpiry, &ui.Scopes, &ui.GoogleEmail, &ui.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &ui, nil
}

func (d *DB) UpsertUserIntegration(ctx context.Context, userID, provider, accessToken, refreshToken string, expiry *time.Time, scopes, googleEmail string) (*UserIntegration, error) {
	var ui UserIntegration
	err := d.pool.QueryRowContext(ctx, `INSERT INTO user_integrations (user_id, provider, access_token_enc, refresh_token_enc, token_expiry, scopes, google_email)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, provider) DO UPDATE SET access_token_enc = EXCLUDED.access_token_enc, refresh_token_enc = EXCLUDED.refresh_token_enc, token_expiry = EXCLUDED.token_expiry, scopes = EXCLUDED.scopes, google_email = COALESCE(EXCLUDED.google_email, user_integrations.google_email)
		RETURNING id, user_id, provider, access_token_enc, refresh_token_enc, token_expiry, COALESCE(scopes,''), COALESCE(google_email,''), created_at`,
		userID, provider, accessToken, refreshToken, expiry, scopes, googleEmail).
		Scan(&ui.ID, &ui.UserID, &ui.Provider, &ui.AccessTokenEnc, &ui.RefreshTokenEnc, &ui.TokenExpiry, &ui.Scopes, &ui.GoogleEmail, &ui.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &ui, nil
}

func (d *DB) DeleteUserIntegration(ctx context.Context, userID, provider string) error {
	_, err := d.pool.ExecContext(ctx, `DELETE FROM user_integrations WHERE user_id = $1 AND provider = $2`, userID, provider)
	return err
}

func (d *DB) ListUserIntegrations(ctx context.Context, userID string) ([]UserIntegration, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, user_id, provider, access_token_enc, refresh_token_enc, token_expiry, COALESCE(scopes,''), COALESCE(google_email,''), created_at
		FROM user_integrations WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []UserIntegration
	for rows.Next() {
		var ui UserIntegration
		if err := rows.Scan(&ui.ID, &ui.UserID, &ui.Provider, &ui.AccessTokenEnc, &ui.RefreshTokenEnc, &ui.TokenExpiry, &ui.Scopes, &ui.GoogleEmail, &ui.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, ui)
	}
	return result, rows.Err()
}
