package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Campaign represents a row from the campaigns table.
type Campaign struct {
	ID              string          `json:"id"`
	OrgID           string          `json:"orgId"`
	CreatedBy       string          `json:"createdBy"`
	Name            string          `json:"name"`
	Channel         string          `json:"channel"`
	TargetType      string          `json:"targetType"`
	TargetFilter    json.RawMessage `json:"targetFilter"`
	MessageTemplate string          `json:"messageTemplate"`
	Status          string          `json:"status"`
	ScheduledAt     *time.Time      `json:"scheduledAt"`
	SentAt          *time.Time      `json:"sentAt"`
	SentCount       int             `json:"sentCount"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

// CreateCampaign inserts a new campaign and returns its generated UUID.
func (d *DB) CreateCampaign(ctx context.Context, c Campaign) (string, error) {
	targetFilter := c.TargetFilter
	if targetFilter == nil {
		targetFilter = json.RawMessage("{}")
	}
	channel := c.Channel
	if channel == "" {
		channel = "discord"
	}
	targetType := c.TargetType
	if targetType == "" {
		targetType = "all"
	}
	status := c.Status
	if status == "" {
		status = "draft"
	}

	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO campaigns (org_id, created_by, name, channel, target_type, target_filter, message_template, status, scheduled_at)
		 VALUES (NULLIF($1,'')::UUID, NULLIF($2,'')::UUID, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id::TEXT`,
		c.OrgID, c.CreatedBy, c.Name, channel, targetType,
		targetFilter, c.MessageTemplate, status, c.ScheduledAt).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create campaign: %w", err)
	}
	return id, nil
}

// GetCampaign returns a campaign by ID, or nil if not found.
func (d *DB) GetCampaign(ctx context.Context, id string) (*Campaign, error) {
	var c Campaign
	var targetFilter sql.NullString
	var scheduledAt, sentAt sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(org_id::TEXT,''), COALESCE(created_by::TEXT,''),
		        name, COALESCE(channel,'discord'), COALESCE(target_type,'all'),
		        COALESCE(target_filter,'{}'), message_template, COALESCE(status,'draft'),
		        scheduled_at, sent_at, COALESCE(sent_count,0),
		        created_at, updated_at
		 FROM campaigns WHERE id = $1::UUID`, id).Scan(
		&c.ID, &c.OrgID, &c.CreatedBy,
		&c.Name, &c.Channel, &c.TargetType,
		&targetFilter, &c.MessageTemplate, &c.Status,
		&scheduledAt, &sentAt, &c.SentCount,
		&c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get campaign: %w", err)
	}
	if targetFilter.Valid && targetFilter.String != "" {
		c.TargetFilter = json.RawMessage(targetFilter.String)
	} else {
		c.TargetFilter = json.RawMessage("{}")
	}
	c.ScheduledAt = nullTime(scheduledAt)
	c.SentAt = nullTime(sentAt)
	return &c, nil
}

// ListCampaigns returns all campaigns ordered by creation date descending.
func (d *DB) ListCampaigns(ctx context.Context) ([]Campaign, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, COALESCE(org_id::TEXT,''), COALESCE(created_by::TEXT,''),
		        name, COALESCE(channel,'discord'), COALESCE(target_type,'all'),
		        COALESCE(target_filter,'{}'), message_template, COALESCE(status,'draft'),
		        scheduled_at, sent_at, COALESCE(sent_count,0),
		        created_at, updated_at
		 FROM campaigns ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: list campaigns: %w", err)
	}
	defer rows.Close()

	var result []Campaign
	for rows.Next() {
		var c Campaign
		var targetFilter sql.NullString
		var scheduledAt, sentAt sql.NullTime
		if err := rows.Scan(
			&c.ID, &c.OrgID, &c.CreatedBy,
			&c.Name, &c.Channel, &c.TargetType,
			&targetFilter, &c.MessageTemplate, &c.Status,
			&scheduledAt, &sentAt, &c.SentCount,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan campaign: %w", err)
		}
		if targetFilter.Valid && targetFilter.String != "" {
			c.TargetFilter = json.RawMessage(targetFilter.String)
		} else {
			c.TargetFilter = json.RawMessage("{}")
		}
		c.ScheduledAt = nullTime(scheduledAt)
		c.SentAt = nullTime(sentAt)
		result = append(result, c)
	}
	return result, rows.Err()
}

// UpdateCampaignStatus updates the status of a campaign and sets sent_at if status is "sent".
func (d *DB) UpdateCampaignStatus(ctx context.Context, id, status string) error {
	var err error
	if status == "sent" {
		_, err = d.pool.ExecContext(ctx,
			`UPDATE campaigns SET status = $1, sent_at = NOW(), updated_at = NOW()
			 WHERE id = $2::UUID`, status, id)
	} else {
		_, err = d.pool.ExecContext(ctx,
			`UPDATE campaigns SET status = $1, updated_at = NOW()
			 WHERE id = $2::UUID`, status, id)
	}
	if err != nil {
		return fmt.Errorf("db: update campaign status: %w", err)
	}
	return nil
}

// DeleteCampaign deletes a campaign by ID.
func (d *DB) DeleteCampaign(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM campaigns WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: delete campaign: %w", err)
	}
	return nil
}
