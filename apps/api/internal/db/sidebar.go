package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// SidebarActivityEntry represents a row from agent_activity_log used for sidebar display.
type SidebarActivityEntry struct {
	ID        int       `json:"id"`
	DiscordID int64     `json:"discordId"`
	EventType string    `json:"eventType"`
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"createdAt"`
}

// SidebarData aggregates data for an agent's sidebar view.
type SidebarData struct {
	AgentData      *Agent                `json:"agentData"`
	Profile        *AgentProfile         `json:"profile"`
	WavvGoal       int                   `json:"wavvGoal"`
	DailySummaries int                   `json:"dailySummaries"`
	LeaderboardRank int                  `json:"leaderboardRank"`
	Recruits       []Agent               `json:"recruits"`
	RecentActivity []SidebarActivityEntry `json:"recentActivity"`
}

// GetSidebarActivity returns recent activity log entries for an agent.
func (d *DB) GetSidebarActivity(ctx context.Context, discordID int64, limit int) ([]SidebarActivityEntry, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id, discord_id, event_type, COALESCE(details,''), created_at
		 FROM agent_activity_log
		 WHERE discord_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`, discordID, limit)
	if err != nil {
		return nil, fmt.Errorf("db: get sidebar activity: %w", err)
	}
	defer rows.Close()

	var result []SidebarActivityEntry
	for rows.Next() {
		var e SidebarActivityEntry
		if err := rows.Scan(&e.ID, &e.DiscordID, &e.EventType, &e.Details, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("db: scan sidebar activity: %w", err)
		}
		result = append(result, e)
	}
	return result, rows.Err()
}

// GetAgentLeaderboardRank returns the agent's rank on the current week's leaderboard.
// Returns 0 if the agent has no activity this week.
func (d *DB) GetAgentLeaderboardRank(ctx context.Context, discordID int64) (int, error) {
	ws := WeekStart(time.Now())
	var rank int
	err := d.pool.QueryRowContext(ctx,
		`SELECT COALESCE(r.rank, 0) FROM (
			SELECT discord_id, RANK() OVER (ORDER BY SUM(count) DESC) as rank
			FROM activity_entries
			WHERE week_start = $1
			GROUP BY discord_id
		) r WHERE r.discord_id = $2`, ws, discordID).Scan(&rank)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("db: get agent leaderboard rank: %w", err)
	}
	return rank, nil
}

// GetRecruits returns agents whose upline_manager_discord_id or direct_manager_discord_id
// matches the given manager's discord ID.
func (d *DB) GetRecruits(ctx context.Context, managerDiscordID int64) ([]Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents
		WHERE (upline_manager_discord_id = $1 OR direct_manager_discord_id = $1)
		  AND kicked_at IS NULL
		ORDER BY created_at DESC`, AgentSelectColumns(""))
	return d.queryAgents(ctx, query, managerDiscordID)
}
