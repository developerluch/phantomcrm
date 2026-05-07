package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Server struct {
	ID             string    `json:"id"`
	DiscordGuildID string    `json:"discordGuildId"`
	GuildName      string    `json:"guildName"`
	OwnerDiscordID *string   `json:"ownerDiscordId"`
	IconURL        *string   `json:"iconUrl"`
	IsActive       bool      `json:"isActive"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (d *DB) CreateServer(ctx context.Context, s *Server) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO servers (discord_guild_id, guild_name, owner_discord_id, icon_url)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (discord_guild_id) DO UPDATE SET guild_name = EXCLUDED.guild_name, updated_at = NOW()
		 RETURNING id::TEXT`,
		s.DiscordGuildID, s.GuildName, s.OwnerDiscordID, s.IconURL).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create server: %w", err)
	}
	return id, nil
}

func (d *DB) GetServer(ctx context.Context, id string) (*Server, error) {
	var s Server
	var ownerID, iconURL sql.NullString
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, discord_guild_id, guild_name, owner_discord_id, icon_url, is_active, created_at, updated_at
		 FROM servers WHERE id = $1::UUID`, id).Scan(
		&s.ID, &s.DiscordGuildID, &s.GuildName, &ownerID, &iconURL, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get server: %w", err)
	}
	s.OwnerDiscordID = nullStr(ownerID)
	s.IconURL = nullStr(iconURL)
	return &s, nil
}

func (d *DB) GetServerByGuildID(ctx context.Context, guildID string) (*Server, error) {
	var s Server
	var ownerID, iconURL sql.NullString
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, discord_guild_id, guild_name, owner_discord_id, icon_url, is_active, created_at, updated_at
		 FROM servers WHERE discord_guild_id = $1`, guildID).Scan(
		&s.ID, &s.DiscordGuildID, &s.GuildName, &ownerID, &iconURL, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get server by guild: %w", err)
	}
	s.OwnerDiscordID = nullStr(ownerID)
	s.IconURL = nullStr(iconURL)
	return &s, nil
}

func (d *DB) ListServers(ctx context.Context) ([]Server, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, discord_guild_id, guild_name, owner_discord_id, icon_url, is_active, created_at, updated_at
		 FROM servers WHERE is_active = TRUE ORDER BY guild_name`)
	if err != nil {
		return nil, fmt.Errorf("db: list servers: %w", err)
	}
	defer rows.Close()

	var result []Server
	for rows.Next() {
		var s Server
		var ownerID, iconURL sql.NullString
		if err := rows.Scan(&s.ID, &s.DiscordGuildID, &s.GuildName, &ownerID, &iconURL, &s.IsActive, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("db: scan server: %w", err)
		}
		s.OwnerDiscordID = nullStr(ownerID)
		s.IconURL = nullStr(iconURL)
		result = append(result, s)
	}
	return result, rows.Err()
}

func (d *DB) DeleteServer(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "UPDATE servers SET is_active = FALSE, updated_at = NOW() WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete server: %w", err)
	}
	return nil
}
