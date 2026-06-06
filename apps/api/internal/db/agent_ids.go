package db

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"

	"github.com/lib/pq"
)

const agentIDAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// GenerateAgentID returns an account-level business Agent ID.
func GenerateAgentID() (string, error) {
	const length = 8
	out := make([]byte, length)
	max := big.NewInt(int64(len(agentIDAlphabet)))
	for i := range out {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		out[i] = agentIDAlphabet[n.Int64()]
	}
	return "AGT-" + string(out), nil
}

// migrateUserAgentIDs adds canonical business Agent IDs and backfills sales
// rows that were previously keyed by Discord ID.
func (d *DB) migrateUserAgentIDs(ctx context.Context) error {
	statements := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_id TEXT`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_agent_id ON users(agent_id) WHERE agent_id IS NOT NULL`,
	}
	for _, statement := range statements {
		if _, err := d.pool.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("db: migrate user agent ids: %w", err)
		}
	}

	rows, err := d.pool.QueryContext(ctx, `SELECT id::TEXT FROM users WHERE COALESCE(agent_id, '') = ''`)
	if err != nil {
		return fmt.Errorf("db: list users without agent id: %w", err)
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return fmt.Errorf("db: scan user without agent id: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("db: scan users without agent id: %w", err)
	}

	for _, userID := range userIDs {
		if err := d.assignAgentID(ctx, userID); err != nil {
			return err
		}
	}

	if _, err := d.pool.ExecContext(ctx, `ALTER TABLE users ALTER COLUMN agent_id SET NOT NULL`); err != nil {
		return fmt.Errorf("db: enforce user agent id: %w", err)
	}

	if _, err := d.pool.ExecContext(ctx, `
		UPDATE sales s
		SET agent_discord_id = u.agent_id
		FROM users u
		WHERE COALESCE(u.discord_id, '') <> ''
		  AND s.agent_discord_id = u.discord_id
		  AND s.agent_discord_id <> u.agent_id
	`); err != nil {
		return fmt.Errorf("db: backfill sale agent ids: %w", err)
	}

	return nil
}

func (d *DB) assignAgentID(ctx context.Context, userID string) error {
	for attempt := 0; attempt < 8; attempt++ {
		agentID, err := GenerateAgentID()
		if err != nil {
			return fmt.Errorf("db: generate agent id: %w", err)
		}
		_, err = d.pool.ExecContext(ctx,
			`UPDATE users SET agent_id = $1, updated_at = NOW() WHERE id = $2::UUID`,
			agentID, userID)
		if err == nil {
			return nil
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			continue
		}
		return fmt.Errorf("db: assign agent id: %w", err)
	}
	return fmt.Errorf("db: assign agent id: exhausted unique id retries for user %s", userID)
}

// EnsureUserAgentID returns a user's business Agent ID, assigning one if missing.
func (d *DB) EnsureUserAgentID(ctx context.Context, userID string) (string, error) {
	user, err := d.GetUserByID(ctx, userID)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", nil
	}
	if user.AgentID != "" {
		return user.AgentID, nil
	}
	if err := d.assignAgentID(ctx, userID); err != nil {
		return "", err
	}
	user, err = d.GetUserByID(ctx, userID)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", nil
	}
	return user.AgentID, nil
}
