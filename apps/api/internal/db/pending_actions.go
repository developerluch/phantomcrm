package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// PendingAction represents a queued action for the Discord bot to execute.
type PendingAction struct {
	ID              int             `json:"id"`
	ActionType      string          `json:"action_type"`
	TargetDiscordID int64           `json:"target_discord_id"`
	Data            json.RawMessage `json:"data"`
	Status          string          `json:"status"`
	CreatedAt       time.Time       `json:"created_at"`
	ProcessedAt     *time.Time      `json:"processed_at,omitempty"`
	ErrorMessage    string          `json:"error_message,omitempty"`
}

// CreatePendingAction inserts a new pending action for the bot to pick up.
func (d *DB) CreatePendingAction(ctx context.Context, actionType string, targetDiscordID int64, data interface{}) (int, error) {
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return 0, fmt.Errorf("db: marshal action data: %w", err)
	}

	var id int
	err = d.pool.QueryRowContext(ctx,
		`INSERT INTO pending_actions (action_type, target_discord_id, data)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		actionType, targetDiscordID, dataJSON,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("db: create pending action: %w", err)
	}
	return id, nil
}

// GetPendingActions returns all unprocessed pending actions.
func (d *DB) GetPendingActions(ctx context.Context) ([]PendingAction, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id, action_type, target_discord_id, data, status, created_at, processed_at, COALESCE(error_message, '')
		 FROM pending_actions
		 WHERE status = 'pending'
		 ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("db: get pending actions: %w", err)
	}
	defer rows.Close()

	var actions []PendingAction
	for rows.Next() {
		var a PendingAction
		if err := rows.Scan(&a.ID, &a.ActionType, &a.TargetDiscordID, &a.Data, &a.Status, &a.CreatedAt, &a.ProcessedAt, &a.ErrorMessage); err != nil {
			return nil, fmt.Errorf("db: scan pending action: %w", err)
		}
		actions = append(actions, a)
	}
	return actions, rows.Err()
}

// CompletePendingAction marks an action as completed or failed.
func (d *DB) CompletePendingAction(ctx context.Context, id int, errMsg string) error {
	status := "completed"
	if errMsg != "" {
		status = "failed"
	}
	_, err := d.pool.ExecContext(ctx,
		`UPDATE pending_actions
		 SET status = $1, processed_at = NOW(), error_message = $2
		 WHERE id = $3`,
		status, errMsg, id,
	)
	return err
}
