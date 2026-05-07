package db

import (
	"context"
	"fmt"
	"time"
)

// PurgeWarning represents a row from purge_warnings with optional joined agent info.
type PurgeWarning struct {
	ID               string     `json:"id"`
	DiscordID        int64      `json:"discordId"`
	GuildID          int64      `json:"guildId"`
	WarningType      string     `json:"warningType"`
	SentAt           time.Time  `json:"sentAt"`
	ResponseDeadline time.Time  `json:"responseDeadline"`
	RespondedAt      *time.Time `json:"respondedAt,omitempty"`
	ActionTaken      string     `json:"actionTaken"`
	// Joined from agents table
	AgentName  string     `json:"agentName,omitempty"`
	LastActive *time.Time `json:"lastActive,omitempty"`
}

// PurgeStatus is a summary of purge system state.
type PurgeStatus struct {
	ActiveWarnings int `json:"activeWarnings"`
	UpcomingPurges int `json:"upcomingPurges"`
	RecentActions  int `json:"recentActions"`
	RetainedCount  int `json:"retainedCount"`
}

// ListPurgeWarnings returns active (unresolved) purge warnings, optionally filtered by guild.
func (d *DB) ListPurgeWarnings(ctx context.Context, guildID int64) ([]PurgeWarning, error) {
	query := `SELECT pw.id, pw.discord_id, pw.guild_id, pw.warning_type, pw.sent_at, pw.response_deadline, pw.responded_at, pw.action_taken,
		COALESCE(a.first_name || ' ' || a.last_name, ''), a.last_active
		FROM purge_warnings pw
		LEFT JOIN onboarding_agents a ON a.discord_id = pw.discord_id
		WHERE pw.action_taken = 'none'`
	args := []any{}
	if guildID > 0 {
		query += " AND pw.guild_id = $1"
		args = append(args, guildID)
	}
	query += " ORDER BY pw.response_deadline ASC"
	rows, err := d.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []PurgeWarning
	for rows.Next() {
		var pw PurgeWarning
		if err := rows.Scan(&pw.ID, &pw.DiscordID, &pw.GuildID, &pw.WarningType, &pw.SentAt, &pw.ResponseDeadline, &pw.RespondedAt, &pw.ActionTaken, &pw.AgentName, &pw.LastActive); err != nil {
			return nil, err
		}
		result = append(result, pw)
	}
	return result, rows.Err()
}

// GetPurgeStatus returns aggregate counts for the purge system dashboard.
func (d *DB) GetPurgeStatus(ctx context.Context, guildID int64) (*PurgeStatus, error) {
	var ps PurgeStatus
	guildFilter := ""
	args := []any{}
	if guildID > 0 {
		guildFilter = " AND guild_id = $1"
		args = append(args, guildID)
	}
	d.pool.QueryRowContext(ctx, `SELECT COUNT(*) FROM purge_warnings WHERE action_taken = 'none' AND responded_at IS NULL`+guildFilter, args...).Scan(&ps.ActiveWarnings)
	d.pool.QueryRowContext(ctx, `SELECT COUNT(*) FROM purge_warnings WHERE action_taken = 'none' AND responded_at IS NULL AND response_deadline < NOW()`+guildFilter, args...).Scan(&ps.UpcomingPurges)
	d.pool.QueryRowContext(ctx, `SELECT COUNT(*) FROM purge_warnings WHERE action_taken != 'none' AND sent_at > NOW() - INTERVAL '7 days'`+guildFilter, args...).Scan(&ps.RecentActions)
	d.pool.QueryRowContext(ctx, `SELECT COUNT(*) FROM purge_warnings WHERE action_taken = 'retained'`+guildFilter, args...).Scan(&ps.RetainedCount)
	return &ps, nil
}

// CreatePurgeWarning inserts or upserts a purge warning for an agent.
func (d *DB) CreatePurgeWarning(ctx context.Context, discordID, guildID int64, warningType string, deadline time.Time) (*PurgeWarning, error) {
	var pw PurgeWarning
	err := d.pool.QueryRowContext(ctx, `INSERT INTO purge_warnings (discord_id, guild_id, warning_type, response_deadline)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (discord_id, guild_id, warning_type) DO UPDATE SET sent_at = NOW(), response_deadline = EXCLUDED.response_deadline, responded_at = NULL, action_taken = 'none'
		RETURNING id, discord_id, guild_id, warning_type, sent_at, response_deadline, responded_at, action_taken`,
		discordID, guildID, warningType, deadline).Scan(&pw.ID, &pw.DiscordID, &pw.GuildID, &pw.WarningType, &pw.SentAt, &pw.ResponseDeadline, &pw.RespondedAt, &pw.ActionTaken)
	if err != nil {
		return nil, err
	}
	return &pw, nil
}

// RespondToPurgeWarning marks a warning as responded to (agent retained).
func (d *DB) RespondToPurgeWarning(ctx context.Context, id string) (*PurgeWarning, error) {
	var pw PurgeWarning
	err := d.pool.QueryRowContext(ctx, `UPDATE purge_warnings SET responded_at = NOW(), action_taken = 'retained'
		WHERE id = $1 AND action_taken = 'none'
		RETURNING id, discord_id, guild_id, warning_type, sent_at, response_deadline, responded_at, action_taken`,
		id).Scan(&pw.ID, &pw.DiscordID, &pw.GuildID, &pw.WarningType, &pw.SentAt, &pw.ResponseDeadline, &pw.RespondedAt, &pw.ActionTaken)
	if err != nil {
		return nil, err
	}
	return &pw, nil
}

// ExecutePurgeAction sets the final action on a purge warning (e.g. "kicked").
func (d *DB) ExecutePurgeAction(ctx context.Context, id, action string) error {
	_, err := d.pool.ExecContext(ctx, `UPDATE purge_warnings SET action_taken = $2, responded_at = NOW()
		WHERE id = $1`, id, action)
	return err
}

// GetExpiredUnrespondedWarnings returns warnings whose deadline has passed with no response.
func (d *DB) GetExpiredUnrespondedWarnings(ctx context.Context) ([]PurgeWarning, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT pw.id, pw.discord_id, pw.guild_id, pw.warning_type, pw.sent_at, pw.response_deadline, pw.responded_at, pw.action_taken,
		COALESCE(a.first_name || ' ' || a.last_name, ''), a.last_active
		FROM purge_warnings pw
		LEFT JOIN onboarding_agents a ON a.discord_id = pw.discord_id
		WHERE pw.action_taken = 'none' AND pw.responded_at IS NULL AND pw.response_deadline < NOW()
		ORDER BY pw.response_deadline ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []PurgeWarning
	for rows.Next() {
		var pw PurgeWarning
		if err := rows.Scan(&pw.ID, &pw.DiscordID, &pw.GuildID, &pw.WarningType, &pw.SentAt, &pw.ResponseDeadline, &pw.RespondedAt, &pw.ActionTaken, &pw.AgentName, &pw.LastActive); err != nil {
			return nil, err
		}
		result = append(result, pw)
	}
	return result, rows.Err()
}

// GetInactiveAgentsForPurge returns agents who have not been active in the given number of days.
// Excludes agents in Welcome or Kicked stages.
func (d *DB) GetInactiveAgentsForPurge(ctx context.Context, inactiveDays int) ([]Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents
		WHERE current_stage NOT IN ($1, $2)
		AND kicked_at IS NULL
		AND (last_active IS NULL OR last_active < NOW() - make_interval(days => $3))
		ORDER BY last_active ASC NULLS FIRST`, AgentSelectColumns(""))
	rows, err := d.pool.QueryContext(ctx, query, StageKicked, StageWelcome, inactiveDays)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []Agent
	for rows.Next() {
		a, err := ScanAgent(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("db: scan inactive agent for purge: %w", err)
		}
		result = append(result, a)
	}
	return result, rows.Err()
}
