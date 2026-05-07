package db

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ActivityEvent represents a row from agent_activity_log.
type ActivityEvent struct {
	DiscordID int64
	EventType string
	Details   string
	CreatedAt time.Time
}

// LogActivity records an event in the activity log.
func (d *DB) LogActivity(ctx context.Context, discordID int64, eventType, details string) error {
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO agent_activity_log (discord_id, event_type, details)
         VALUES ($1, $2, $3)`, discordID, eventType, details)
	return err
}

// GetAgentsByStage returns all agents at a given stage (excluding kicked).
func (d *DB) GetAgentsByStage(ctx context.Context, stage int) ([]Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents
         WHERE current_stage = $1 AND kicked_at IS NULL
         ORDER BY created_at DESC`, AgentSelectColumns(""))
	return d.queryAgents(ctx, query, stage)
}

// GetAllAgents returns all agents, optionally including kicked ones.
func (d *DB) GetAllAgents(ctx context.Context, includeKicked bool) ([]Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents`, AgentSelectColumns(""))
	if !includeKicked {
		query += ` WHERE kicked_at IS NULL`
	}
	query += ` ORDER BY created_at DESC`
	return d.queryAgents(ctx, query)
}

// SearchAgents searches agents by name (first or last).
func (d *DB) SearchAgents(ctx context.Context, query string) ([]Agent, error) {
	pattern := "%" + SanitizeLike(query) + "%"
	q := fmt.Sprintf(`SELECT %s FROM onboarding_agents
         WHERE (LOWER(first_name) LIKE LOWER($1) ESCAPE '\' OR LOWER(last_name) LIKE LOWER($1) ESCAPE '\')
           AND kicked_at IS NULL
         ORDER BY created_at DESC
         LIMIT 50`, AgentSelectColumns(""))
	return d.queryAgents(ctx, q, pattern)
}

// GetAgentActivity returns recent activity events for an agent.
func (d *DB) GetAgentActivity(ctx context.Context, discordID int64, limit int) ([]ActivityEvent, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT discord_id, event_type, COALESCE(details,''), created_at
         FROM agent_activity_log
         WHERE discord_id = $1
         ORDER BY created_at DESC
         LIMIT $2`, discordID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ActivityEvent
	for rows.Next() {
		var e ActivityEvent
		if err := rows.Scan(&e.DiscordID, &e.EventType, &e.Details, &e.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, rows.Err()
}

// KickAgent marks an agent as kicked.
func (d *DB) KickAgent(ctx context.Context, discordID int64, reason string) error {
	now := time.Now()
	_, err := d.pool.ExecContext(ctx,
		`UPDATE onboarding_agents
         SET kicked_at = $1, kicked_reason = $2, updated_at = NOW()
         WHERE discord_id = $3`, now, reason, discordID)
	if err != nil {
		return err
	}
	return d.LogActivity(ctx, discordID, "kicked", reason)
}

// GetAgentCounts returns a map of stage -> count for non-kicked agents.
func (d *DB) GetAgentCounts(ctx context.Context) (map[int]int, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT COALESCE(current_stage, 1), COUNT(*)
         FROM onboarding_agents
         WHERE kicked_at IS NULL
         GROUP BY current_stage
         ORDER BY current_stage`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[int]int)
	for rows.Next() {
		var stage, count int
		if err := rows.Scan(&stage, &count); err != nil {
			return nil, err
		}
		counts[stage] = count
	}
	return counts, rows.Err()
}

// DeleteAllAgents hard-deletes ALL agents from the onboarding_agents table.
// Returns the number of rows deleted.
func (d *DB) DeleteAllAgents(ctx context.Context) (int64, error) {
	res, err := d.pool.ExecContext(ctx, `DELETE FROM onboarding_agents`)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// GetKickedCount returns the number of kicked agents.
func (d *DB) GetKickedCount(ctx context.Context) (int, error) {
	var count int
	err := d.pool.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM onboarding_agents WHERE kicked_at IS NOT NULL`).Scan(&count)
	return count, err
}

// queryAgents is a helper that scans full Agent rows from any query.
func (d *DB) queryAgents(ctx context.Context, query string, args ...interface{}) ([]Agent, error) {
	rows, err := d.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Agent
	for rows.Next() {
		a, err := ScanAgent(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("db: scan agent: %w", err)
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

func (d *DB) FindAgentByEmail(ctx context.Context, email string) (*Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents WHERE LOWER(email) = LOWER($1) AND kicked_at IS NULL LIMIT 1`, AgentSelectColumns(""))
	rows, err := d.pool.QueryContext(ctx, query, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	a, err := ScanAgent(rows.Scan)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (d *DB) FindAgentByPhone(ctx context.Context, phone string) (*Agent, error) {
	var digits string
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			digits += string(c)
		}
	}
	if len(digits) == 0 {
		return nil, nil
	}

	// Try multiple formats: 10-digit, 11-digit with leading 1, +1 prefix
	candidates := []string{digits}
	if len(digits) == 10 {
		candidates = append(candidates, "1"+digits, "+1"+digits)
	} else if len(digits) == 11 && strings.HasPrefix(digits, "1") {
		candidates = append(candidates, digits[1:], "+"+digits)
	}

	for _, candidate := range candidates {
		query := fmt.Sprintf(`SELECT %s FROM onboarding_agents WHERE phone_number = $1 AND kicked_at IS NULL LIMIT 1`, AgentSelectColumns(""))
		rows, err := d.pool.QueryContext(ctx, query, candidate)
		if err != nil {
			return nil, err
		}
		if rows.Next() {
			a, err := ScanAgent(rows.Scan)
			rows.Close()
			if err != nil {
				return nil, err
			}
			return &a, nil
		}
		rows.Close()
	}
	return nil, nil
}
