package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// StageConfig holds SMS template and manager mapping for a recruit pipeline stage.
type StageConfig struct {
	ID               string    `json:"id"`
	Stage            string    `json:"stage"`
	SmsTemplate      string    `json:"smsTemplate"`
	ManagerDiscordID string    `json:"managerDiscordId"`
	ManagerName      string    `json:"managerName"`
	NotifyDiscord    bool      `json:"notifyDiscord"`
	AutoAssign       bool      `json:"autoAssign"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// StageOrderSQL returns the pipeline sequence for ORDER BY.
const StageOrderSQL = `CASE stage
	WHEN 'NEW_LEAD' THEN 1
	WHEN 'PREQUALIFIED' THEN 2
	WHEN 'INTERVIEW_SCHEDULED' THEN 3
	WHEN 'INTERVIEWED' THEN 4
	WHEN 'ONBOARDING' THEN 5
	WHEN 'IN_COURSE' THEN 6
	WHEN 'LICENSED' THEN 7
	WHEN 'CONTRACTING' THEN 8
	WHEN 'ACTIVE' THEN 9
	WHEN 'REJECTED' THEN 10
	ELSE 11 END`

func (d *DB) ListStageConfigs(ctx context.Context) ([]StageConfig, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, stage, sms_template, manager_discord_id, manager_name,
		        notify_discord, auto_assign, created_at, updated_at
		 FROM stage_configs ORDER BY `+StageOrderSQL)
	if err != nil {
		return nil, fmt.Errorf("db: list stage configs: %w", err)
	}
	defer rows.Close()

	var result []StageConfig
	for rows.Next() {
		var sc StageConfig
		if err := rows.Scan(&sc.ID, &sc.Stage, &sc.SmsTemplate, &sc.ManagerDiscordID,
			&sc.ManagerName, &sc.NotifyDiscord, &sc.AutoAssign, &sc.CreatedAt, &sc.UpdatedAt); err != nil {
			return nil, fmt.Errorf("db: scan stage config: %w", err)
		}
		result = append(result, sc)
	}
	return result, rows.Err()
}

func (d *DB) GetStageConfig(ctx context.Context, stage string) (*StageConfig, error) {
	var sc StageConfig
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, stage, sms_template, manager_discord_id, manager_name,
		        notify_discord, auto_assign, created_at, updated_at
		 FROM stage_configs WHERE stage = $1`, stage).Scan(
		&sc.ID, &sc.Stage, &sc.SmsTemplate, &sc.ManagerDiscordID,
		&sc.ManagerName, &sc.NotifyDiscord, &sc.AutoAssign, &sc.CreatedAt, &sc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get stage config: %w", err)
	}
	return &sc, nil
}

func (d *DB) UpdateStageConfig(ctx context.Context, stage string, updates map[string]interface{}) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	fieldMap := map[string]string{
		"smsTemplate":      "sms_template",
		"managerDiscordId": "manager_discord_id",
		"managerName":      "manager_name",
		"notifyDiscord":    "notify_discord",
		"autoAssign":       "auto_assign",
	}

	for jsonKey, col := range fieldMap {
		if v, ok := updates[jsonKey]; ok {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, argN))
			args = append(args, v)
			argN++
		}
	}

	args = append(args, stage)
	query := fmt.Sprintf("UPDATE stage_configs SET %s WHERE stage = $%d", strings.Join(sets, ", "), argN)
	_, err := d.pool.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("db: update stage config: %w", err)
	}
	return nil
}
