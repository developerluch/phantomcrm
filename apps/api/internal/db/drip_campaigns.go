package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// DripCampaign represents a multi-step messaging campaign triggered by a recruit stage change.
type DripCampaign struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Channel      string    `json:"channel"`      // "whatsapp" or "sms"
	TriggerStage string    `json:"triggerStage"`
	IsActive     bool      `json:"isActive"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// DripStep represents one step in a drip campaign sequence.
type DripStep struct {
	ID              string    `json:"id"`
	CampaignID      string    `json:"campaignId"`
	StepOrder       int       `json:"stepOrder"`
	DelayMinutes    int       `json:"delayMinutes"`
	MessageTemplate string    `json:"messageTemplate"`
	CreatedAt       time.Time `json:"createdAt"`
}

// DripExecution tracks a recruit's progress through a drip campaign.
type DripExecution struct {
	ID          string     `json:"id"`
	CampaignID  string     `json:"campaignId"`
	RecruitID   string     `json:"recruitId"`
	CurrentStep int        `json:"currentStep"`
	Status      string     `json:"status"` // "active", "completed", "cancelled", "opted_out"
	NextSendAt  *time.Time `json:"nextSendAt"`
	StartedAt   time.Time  `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// CreateDripCampaign inserts a new drip campaign and returns its ID.
func (d *DB) CreateDripCampaign(ctx context.Context, c DripCampaign) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO drip_campaigns (name, channel, trigger_stage, is_active)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id::TEXT`,
		c.Name, c.Channel, c.TriggerStage, c.IsActive).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create drip campaign: %w", err)
	}
	return id, nil
}

// GetDripCampaign returns a drip campaign by ID, or nil if not found.
func (d *DB) GetDripCampaign(ctx context.Context, id string) (*DripCampaign, error) {
	var c DripCampaign
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, name, channel, trigger_stage, is_active, created_at, updated_at
		 FROM drip_campaigns WHERE id = $1::UUID`, id).Scan(
		&c.ID, &c.Name, &c.Channel, &c.TriggerStage, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get drip campaign: %w", err)
	}
	return &c, nil
}

// ListDripCampaigns returns all drip campaigns ordered by creation date descending.
func (d *DB) ListDripCampaigns(ctx context.Context) ([]DripCampaign, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, name, channel, trigger_stage, is_active, created_at, updated_at
		 FROM drip_campaigns ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: list drip campaigns: %w", err)
	}
	defer rows.Close()

	var result []DripCampaign
	for rows.Next() {
		var c DripCampaign
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Channel, &c.TriggerStage, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan drip campaign: %w", err)
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// UpdateDripCampaign dynamically updates a drip campaign's fields.
func (d *DB) UpdateDripCampaign(ctx context.Context, id string, updates map[string]interface{}) error {
	fieldMap := map[string]string{
		"name":         "name",
		"channel":      "channel",
		"triggerStage": "trigger_stage",
		"isActive":     "is_active",
	}

	var sets []string
	var args []interface{}
	i := 1
	for jsonKey, val := range updates {
		col, ok := fieldMap[jsonKey]
		if !ok {
			continue
		}
		sets = append(sets, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	if len(sets) == 0 {
		return nil
	}

	sets = append(sets, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now())
	i++

	args = append(args, id)
	query := fmt.Sprintf("UPDATE drip_campaigns SET %s WHERE id = $%d::UUID", strings.Join(sets, ", "), i)
	_, err := d.pool.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("db: update drip campaign: %w", err)
	}
	return nil
}

// DeleteDripCampaign deletes a drip campaign by ID.
func (d *DB) DeleteDripCampaign(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM drip_campaigns WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete drip campaign: %w", err)
	}
	return nil
}

// ListActiveCampaignsByStage returns active drip campaigns for a given trigger stage.
func (d *DB) ListActiveCampaignsByStage(ctx context.Context, stage string) ([]DripCampaign, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, name, channel, trigger_stage, is_active, created_at, updated_at
		 FROM drip_campaigns WHERE trigger_stage = $1 AND is_active = true
		 ORDER BY created_at DESC`, stage)
	if err != nil {
		return nil, fmt.Errorf("db: list active campaigns by stage: %w", err)
	}
	defer rows.Close()

	var result []DripCampaign
	for rows.Next() {
		var c DripCampaign
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Channel, &c.TriggerStage, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan drip campaign: %w", err)
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// CreateDripStep inserts a new drip step and returns its ID.
func (d *DB) CreateDripStep(ctx context.Context, s DripStep) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO drip_steps (campaign_id, step_order, delay_minutes, message_template)
		 VALUES ($1::UUID, $2, $3, $4)
		 RETURNING id::TEXT`,
		s.CampaignID, s.StepOrder, s.DelayMinutes, s.MessageTemplate).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create drip step: %w", err)
	}
	return id, nil
}

// ListDripSteps returns all steps for a campaign ordered by step_order ascending.
func (d *DB) ListDripSteps(ctx context.Context, campaignID string) ([]DripStep, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, campaign_id::TEXT, step_order, delay_minutes, message_template, created_at
		 FROM drip_steps WHERE campaign_id = $1::UUID
		 ORDER BY step_order ASC`, campaignID)
	if err != nil {
		return nil, fmt.Errorf("db: list drip steps: %w", err)
	}
	defer rows.Close()

	var result []DripStep
	for rows.Next() {
		var s DripStep
		if err := rows.Scan(
			&s.ID, &s.CampaignID, &s.StepOrder, &s.DelayMinutes, &s.MessageTemplate, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan drip step: %w", err)
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// GetDripStep returns a specific step by campaign ID and step order, or nil if not found.
func (d *DB) GetDripStep(ctx context.Context, campaignID string, stepOrder int) (*DripStep, error) {
	var s DripStep
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, campaign_id::TEXT, step_order, delay_minutes, message_template, created_at
		 FROM drip_steps WHERE campaign_id = $1::UUID AND step_order = $2`,
		campaignID, stepOrder).Scan(
		&s.ID, &s.CampaignID, &s.StepOrder, &s.DelayMinutes, &s.MessageTemplate, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get drip step: %w", err)
	}
	return &s, nil
}

// UpdateDripStep dynamically updates a drip step's fields.
func (d *DB) UpdateDripStep(ctx context.Context, id string, updates map[string]interface{}) error {
	fieldMap := map[string]string{
		"stepOrder":       "step_order",
		"delayMinutes":    "delay_minutes",
		"messageTemplate": "message_template",
	}

	var sets []string
	var args []interface{}
	i := 1
	for jsonKey, val := range updates {
		col, ok := fieldMap[jsonKey]
		if !ok {
			continue
		}
		sets = append(sets, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	if len(sets) == 0 {
		return nil
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE drip_steps SET %s WHERE id = $%d::UUID", strings.Join(sets, ", "), i)
	_, err := d.pool.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("db: update drip step: %w", err)
	}
	return nil
}

// DeleteDripStep deletes a drip step by ID.
func (d *DB) DeleteDripStep(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM drip_steps WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete drip step: %w", err)
	}
	return nil
}

// StartExecution begins a new drip execution for a recruit, with deduplication.
// If the recruit already has an active execution for this campaign, the existing execution ID is returned.
func (d *DB) StartExecution(ctx context.Context, campaignID, recruitID string, firstDelay int) (string, error) {
	// Check for existing active execution (dedup).
	var existingID string
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT FROM drip_executions
		 WHERE campaign_id = $1::UUID AND recruit_id = $2::UUID AND status = 'active'`,
		campaignID, recruitID).Scan(&existingID)
	if err == nil {
		return existingID, nil
	}
	if err != sql.ErrNoRows {
		return "", fmt.Errorf("db: check existing drip execution: %w", err)
	}

	var id string
	err = d.pool.QueryRowContext(ctx,
		`INSERT INTO drip_executions (campaign_id, recruit_id, current_step, status, next_send_at, started_at)
		 VALUES ($1::UUID, $2::UUID, 1, 'active', NOW() + ($3 || ' minutes')::INTERVAL, NOW())
		 RETURNING id::TEXT`,
		campaignID, recruitID, fmt.Sprintf("%d", firstDelay)).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: start drip execution: %w", err)
	}
	return id, nil
}

// ListDueExecutions returns active executions whose next_send_at is at or before the given time.
func (d *DB) ListDueExecutions(ctx context.Context, now time.Time) ([]DripExecution, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, campaign_id::TEXT, recruit_id::TEXT, current_step, status,
		        next_send_at, started_at, completed_at, created_at
		 FROM drip_executions
		 WHERE status = 'active' AND next_send_at <= $1
		 ORDER BY next_send_at ASC
		 LIMIT 100`, now)
	if err != nil {
		return nil, fmt.Errorf("db: list due executions: %w", err)
	}
	defer rows.Close()

	var result []DripExecution
	for rows.Next() {
		var e DripExecution
		var nextSend, completedAt sql.NullTime
		if err := rows.Scan(
			&e.ID, &e.CampaignID, &e.RecruitID, &e.CurrentStep, &e.Status,
			&nextSend, &e.StartedAt, &completedAt, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan drip execution: %w", err)
		}
		e.NextSendAt = nullTime(nextSend)
		e.CompletedAt = nullTime(completedAt)
		result = append(result, e)
	}
	return result, rows.Err()
}

// AdvanceExecution updates the current step and next send time for an execution.
func (d *DB) AdvanceExecution(ctx context.Context, id string, nextStep int, nextSendAt *time.Time) error {
	var nt sql.NullTime
	if nextSendAt != nil {
		nt = sql.NullTime{Time: *nextSendAt, Valid: true}
	}
	_, err := d.pool.ExecContext(ctx,
		`UPDATE drip_executions SET current_step = $1, next_send_at = $2
		 WHERE id = $3::UUID`,
		nextStep, nt, id)
	if err != nil {
		return fmt.Errorf("db: advance drip execution: %w", err)
	}
	return nil
}

// CompleteExecution marks an execution as completed.
func (d *DB) CompleteExecution(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE drip_executions SET status = 'completed', completed_at = NOW(), next_send_at = NULL
		 WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: complete drip execution: %w", err)
	}
	return nil
}

// CancelExecutionsByRecruitID cancels all active executions for a recruit with the given reason.
func (d *DB) CancelExecutionsByRecruitID(ctx context.Context, recruitID, reason string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE drip_executions SET status = $1, completed_at = NOW(), next_send_at = NULL
		 WHERE recruit_id = $2::UUID AND status = 'active'`,
		reason, recruitID)
	if err != nil {
		return fmt.Errorf("db: cancel drip executions for recruit: %w", err)
	}
	return nil
}

// ListDripExecutions returns all executions for a campaign ordered by creation date descending.
func (d *DB) ListDripExecutions(ctx context.Context, campaignID string) ([]DripExecution, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, campaign_id::TEXT, recruit_id::TEXT, current_step, status,
		        next_send_at, started_at, completed_at, created_at
		 FROM drip_executions WHERE campaign_id = $1::UUID
		 ORDER BY created_at DESC`, campaignID)
	if err != nil {
		return nil, fmt.Errorf("db: list drip executions: %w", err)
	}
	defer rows.Close()

	var result []DripExecution
	for rows.Next() {
		var e DripExecution
		var nextSend, completedAt sql.NullTime
		if err := rows.Scan(
			&e.ID, &e.CampaignID, &e.RecruitID, &e.CurrentStep, &e.Status,
			&nextSend, &e.StartedAt, &completedAt, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan drip execution: %w", err)
		}
		e.NextSendAt = nullTime(nextSend)
		e.CompletedAt = nullTime(completedAt)
		result = append(result, e)
	}
	return result, rows.Err()
}
