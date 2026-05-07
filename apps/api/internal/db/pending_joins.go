package db

import (
	"context"
	"fmt"
	"time"
)

type PendingJoin struct {
	ID         string     `json:"id"`
	DiscordID  int64      `json:"discordId"`
	GuildID    int64      `json:"guildId"`
	Username   string     `json:"username"`
	AvatarURL  string     `json:"avatarUrl,omitempty"`
	JoinedAt   time.Time  `json:"joinedAt"`
	Status     string     `json:"status"`
	ReviewedBy string     `json:"reviewedBy,omitempty"`
	ReviewedAt *time.Time `json:"reviewedAt,omitempty"`
}

func (d *DB) ListPendingJoins(ctx context.Context, guildID int64) ([]PendingJoin, error) {
	query := `SELECT id, discord_id, guild_id, username, COALESCE(avatar_url,''), joined_at, status, COALESCE(reviewed_by,''), reviewed_at
		FROM pending_joins WHERE status = 'pending'`
	args := []any{}
	if guildID > 0 {
		query += " AND guild_id = $1"
		args = append(args, guildID)
	}
	query += " ORDER BY joined_at ASC"
	rows, err := d.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []PendingJoin
	for rows.Next() {
		var pj PendingJoin
		if err := rows.Scan(&pj.ID, &pj.DiscordID, &pj.GuildID, &pj.Username, &pj.AvatarURL, &pj.JoinedAt, &pj.Status, &pj.ReviewedBy, &pj.ReviewedAt); err != nil {
			return nil, err
		}
		result = append(result, pj)
	}
	return result, rows.Err()
}

func (d *DB) GetPendingJoin(ctx context.Context, id string) (*PendingJoin, error) {
	var pj PendingJoin
	err := d.pool.QueryRowContext(ctx, `SELECT id, discord_id, guild_id, username, COALESCE(avatar_url,''), joined_at, status, COALESCE(reviewed_by,''), reviewed_at
		FROM pending_joins WHERE id = $1`, id).Scan(&pj.ID, &pj.DiscordID, &pj.GuildID, &pj.Username, &pj.AvatarURL, &pj.JoinedAt, &pj.Status, &pj.ReviewedBy, &pj.ReviewedAt)
	if err != nil {
		return nil, err
	}
	return &pj, nil
}

func (d *DB) CreatePendingJoin(ctx context.Context, discordID, guildID int64, username, avatarURL string) (*PendingJoin, error) {
	var pj PendingJoin
	err := d.pool.QueryRowContext(ctx, `INSERT INTO pending_joins (discord_id, guild_id, username, avatar_url)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (discord_id, guild_id) DO UPDATE SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url, status = 'pending', reviewed_by = NULL, reviewed_at = NULL
		RETURNING id, discord_id, guild_id, username, COALESCE(avatar_url,''), joined_at, status, COALESCE(reviewed_by,''), reviewed_at`,
		discordID, guildID, username, avatarURL).Scan(&pj.ID, &pj.DiscordID, &pj.GuildID, &pj.Username, &pj.AvatarURL, &pj.JoinedAt, &pj.Status, &pj.ReviewedBy, &pj.ReviewedAt)
	if err != nil {
		return nil, err
	}
	return &pj, nil
}

func (d *DB) ApprovePendingJoin(ctx context.Context, id, reviewedBy string) (*PendingJoin, error) {
	var pj PendingJoin
	err := d.pool.QueryRowContext(ctx, `UPDATE pending_joins SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
		WHERE id = $1 AND status = 'pending'
		RETURNING id, discord_id, guild_id, username, COALESCE(avatar_url,''), joined_at, status, COALESCE(reviewed_by,''), reviewed_at`,
		id, reviewedBy).Scan(&pj.ID, &pj.DiscordID, &pj.GuildID, &pj.Username, &pj.AvatarURL, &pj.JoinedAt, &pj.Status, &pj.ReviewedBy, &pj.ReviewedAt)
	if err != nil {
		return nil, err
	}
	return &pj, nil
}

func (d *DB) RejectPendingJoin(ctx context.Context, id, reviewedBy string) (*PendingJoin, error) {
	var pj PendingJoin
	err := d.pool.QueryRowContext(ctx, `UPDATE pending_joins SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
		WHERE id = $1 AND status = 'pending'
		RETURNING id, discord_id, guild_id, username, COALESCE(avatar_url,''), joined_at, status, COALESCE(reviewed_by,''), reviewed_at`,
		id, reviewedBy).Scan(&pj.ID, &pj.DiscordID, &pj.GuildID, &pj.Username, &pj.AvatarURL, &pj.JoinedAt, &pj.Status, &pj.ReviewedBy, &pj.ReviewedAt)
	if err != nil {
		return nil, err
	}
	return &pj, nil
}

func (d *DB) BulkUpdatePendingJoins(ctx context.Context, ids []string, status, reviewedBy string) ([]PendingJoin, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	// Build placeholder list
	placeholders := ""
	args := []any{status, reviewedBy}
	for i, id := range ids {
		if i > 0 {
			placeholders += ","
		}
		placeholders += fmt.Sprintf("$%d", i+3)
		args = append(args, id)
	}
	query := fmt.Sprintf(`UPDATE pending_joins SET status = $1, reviewed_by = $2, reviewed_at = NOW()
		WHERE id IN (%s) AND status = 'pending'
		RETURNING id, discord_id, guild_id, username, COALESCE(avatar_url,''), joined_at, status, COALESCE(reviewed_by,''), reviewed_at`, placeholders)
	rows, err := d.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []PendingJoin
	for rows.Next() {
		var pj PendingJoin
		if err := rows.Scan(&pj.ID, &pj.DiscordID, &pj.GuildID, &pj.Username, &pj.AvatarURL, &pj.JoinedAt, &pj.Status, &pj.ReviewedBy, &pj.ReviewedAt); err != nil {
			return nil, err
		}
		result = append(result, pj)
	}
	return result, rows.Err()
}

func (d *DB) CountPendingJoins(ctx context.Context, guildID int64) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM pending_joins WHERE status = 'pending'`
	args := []any{}
	if guildID > 0 {
		query += " AND guild_id = $1"
		args = append(args, guildID)
	}
	err := d.pool.QueryRowContext(ctx, query, args...).Scan(&count)
	return count, err
}
