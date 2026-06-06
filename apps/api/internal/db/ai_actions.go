package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

const (
	AIActionStatusPending   = "pending"
	AIActionStatusExecuting = "executing"
	AIActionStatusSucceeded = "succeeded"
	AIActionStatusFailed    = "failed"
	AIActionStatusDismissed = "dismissed"
)

type AISettings struct {
	UserID        string          `json:"userId,omitempty"`
	FullTrustMode bool            `json:"fullTrustMode"`
	Categories    map[string]bool `json:"categories"`
	CreatedAt     time.Time       `json:"createdAt,omitempty"`
	UpdatedAt     time.Time       `json:"updatedAt,omitempty"`
}

type AIActionRequest struct {
	ID                   string          `json:"id"`
	UserID               string          `json:"userId"`
	ConversationID       string          `json:"conversationId"`
	MessageID            *string         `json:"messageId,omitempty"`
	ActionType           string          `json:"actionType"`
	Category             string          `json:"category"`
	InputJSON            json.RawMessage `json:"inputJson"`
	Status               string          `json:"status"`
	ResultJSON           json.RawMessage `json:"resultJson,omitempty"`
	Error                string          `json:"error,omitempty"`
	RequiresConfirmation bool            `json:"requiresConfirmation"`
	CreatedAt            time.Time       `json:"createdAt"`
	ConfirmedAt          *time.Time      `json:"confirmedAt,omitempty"`
	ExecutedAt           *time.Time      `json:"executedAt,omitempty"`
}

func DefaultAICategories() map[string]bool {
	return map[string]bool{
		"analytics":     true,
		"agents":        true,
		"recruits":      true,
		"sales":         true,
		"expenses":      true,
		"messaging":     true,
		"appointments":  true,
		"licenses":      true,
		"lockIns":       true,
		"documents":     true,
		"notifications": true,
	}
}

func normalizeAICategories(categories map[string]bool) map[string]bool {
	normalized := DefaultAICategories()
	for key := range normalized {
		if value, ok := categories[key]; ok {
			normalized[key] = value
		}
	}
	return normalized
}

func DefaultAISettings(userID string) *AISettings {
	return &AISettings{
		UserID:        userID,
		FullTrustMode: false,
		Categories:    DefaultAICategories(),
	}
}

func (d *DB) GetAISettings(ctx context.Context, userID string) (*AISettings, error) {
	settings := DefaultAISettings(userID)
	var categoriesBytes []byte
	err := d.pool.QueryRowContext(ctx, `SELECT user_id, full_trust_mode, categories, created_at, updated_at
		FROM ai_settings WHERE user_id = $1`, userID).
		Scan(&settings.UserID, &settings.FullTrustMode, &categoriesBytes, &settings.CreatedAt, &settings.UpdatedAt)
	if err == sql.ErrNoRows {
		return settings, nil
	}
	if err != nil {
		return nil, err
	}

	var stored map[string]bool
	if len(categoriesBytes) > 0 {
		_ = json.Unmarshal(categoriesBytes, &stored)
	}
	settings.Categories = normalizeAICategories(stored)
	return settings, nil
}

func (d *DB) UpdateAISettings(ctx context.Context, userID string, settings AISettings) (*AISettings, error) {
	categories := normalizeAICategories(settings.Categories)
	categoriesJSON, err := json.Marshal(categories)
	if err != nil {
		return nil, err
	}

	var updated AISettings
	var categoriesBytes []byte
	err = d.pool.QueryRowContext(ctx, `INSERT INTO ai_settings (user_id, full_trust_mode, categories)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			full_trust_mode = EXCLUDED.full_trust_mode,
			categories = EXCLUDED.categories,
			updated_at = NOW()
		RETURNING user_id, full_trust_mode, categories, created_at, updated_at`,
		userID, settings.FullTrustMode, categoriesJSON).
		Scan(&updated.UserID, &updated.FullTrustMode, &categoriesBytes, &updated.CreatedAt, &updated.UpdatedAt)
	if err != nil {
		return nil, err
	}

	var stored map[string]bool
	if len(categoriesBytes) > 0 {
		_ = json.Unmarshal(categoriesBytes, &stored)
	}
	updated.Categories = normalizeAICategories(stored)
	return &updated, nil
}

func (d *DB) CreateAIActionRequest(ctx context.Context, action *AIActionRequest) (*AIActionRequest, error) {
	input := action.InputJSON
	if len(input) == 0 {
		input = json.RawMessage(`{}`)
	}
	status := action.Status
	if status == "" {
		status = AIActionStatusPending
	}

	var created AIActionRequest
	row := d.pool.QueryRowContext(ctx, `INSERT INTO ai_action_requests
		(user_id, conversation_id, message_id, action_type, category, input_json, status, requires_confirmation)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, user_id, conversation_id, message_id, action_type, category, input_json, status,
			result_json, error, requires_confirmation, created_at, confirmed_at, executed_at`,
		action.UserID, action.ConversationID, action.MessageID, action.ActionType, action.Category, input, status, action.RequiresConfirmation)
	if err := scanAIAction(row, &created); err != nil {
		return nil, err
	}
	return &created, nil
}

func (d *DB) GetAIActionRequest(ctx context.Context, id string) (*AIActionRequest, error) {
	var action AIActionRequest
	row := d.pool.QueryRowContext(ctx, `SELECT id, user_id, conversation_id, message_id, action_type, category, input_json, status,
		result_json, error, requires_confirmation, created_at, confirmed_at, executed_at
		FROM ai_action_requests WHERE id = $1`, id)
	if err := scanAIAction(row, &action); err != nil {
		return nil, err
	}
	return &action, nil
}

func (d *DB) ListAIActionRequests(ctx context.Context, userID, conversationID string) ([]AIActionRequest, error) {
	query := `SELECT id, user_id, conversation_id, message_id, action_type, category, input_json, status,
		result_json, error, requires_confirmation, created_at, confirmed_at, executed_at
		FROM ai_action_requests WHERE user_id = $1`
	args := []any{userID}
	if conversationID != "" {
		query += ` AND conversation_id = $2`
		args = append(args, conversationID)
	}
	query += ` ORDER BY created_at ASC LIMIT 100`

	rows, err := d.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actions []AIActionRequest
	for rows.Next() {
		var action AIActionRequest
		if err := scanAIAction(rows, &action); err != nil {
			return nil, err
		}
		actions = append(actions, action)
	}
	return actions, rows.Err()
}

func (d *DB) AttachAIActionMessage(ctx context.Context, actionID, messageID string) error {
	_, err := d.pool.ExecContext(ctx, `UPDATE ai_action_requests SET message_id = $2 WHERE id = $1`, actionID, messageID)
	return err
}

func (d *DB) MarkAIActionExecuting(ctx context.Context, actionID string, confirmed bool) (*AIActionRequest, error) {
	confirmedSQL := `confirmed_at`
	if confirmed {
		confirmedSQL = `COALESCE(confirmed_at, NOW())`
	}
	var action AIActionRequest
	row := d.pool.QueryRowContext(ctx, `UPDATE ai_action_requests SET status = $2, confirmed_at = `+confirmedSQL+`
		WHERE id = $1
		RETURNING id, user_id, conversation_id, message_id, action_type, category, input_json, status,
			result_json, error, requires_confirmation, created_at, confirmed_at, executed_at`,
		actionID, AIActionStatusExecuting)
	if err := scanAIAction(row, &action); err != nil {
		return nil, err
	}
	return &action, nil
}

func (d *DB) MarkAIActionSucceeded(ctx context.Context, actionID string, result json.RawMessage) (*AIActionRequest, error) {
	if len(result) == 0 {
		result = json.RawMessage(`{}`)
	}
	var action AIActionRequest
	row := d.pool.QueryRowContext(ctx, `UPDATE ai_action_requests
		SET status = $2, result_json = $3, error = NULL, executed_at = NOW()
		WHERE id = $1
		RETURNING id, user_id, conversation_id, message_id, action_type, category, input_json, status,
			result_json, error, requires_confirmation, created_at, confirmed_at, executed_at`,
		actionID, AIActionStatusSucceeded, result)
	if err := scanAIAction(row, &action); err != nil {
		return nil, err
	}
	return &action, nil
}

func (d *DB) MarkAIActionFailed(ctx context.Context, actionID, errorMessage string, result json.RawMessage) (*AIActionRequest, error) {
	var action AIActionRequest
	row := d.pool.QueryRowContext(ctx, `UPDATE ai_action_requests
		SET status = $2, result_json = $3, error = $4, executed_at = NOW()
		WHERE id = $1
		RETURNING id, user_id, conversation_id, message_id, action_type, category, input_json, status,
			result_json, error, requires_confirmation, created_at, confirmed_at, executed_at`,
		actionID, AIActionStatusFailed, nullableRaw(result), errorMessage)
	if err := scanAIAction(row, &action); err != nil {
		return nil, err
	}
	return &action, nil
}

func (d *DB) DismissAIAction(ctx context.Context, actionID string) (*AIActionRequest, error) {
	var action AIActionRequest
	row := d.pool.QueryRowContext(ctx, `UPDATE ai_action_requests
		SET status = $2
		WHERE id = $1 AND status = $3
		RETURNING id, user_id, conversation_id, message_id, action_type, category, input_json, status,
			result_json, error, requires_confirmation, created_at, confirmed_at, executed_at`,
		actionID, AIActionStatusDismissed, AIActionStatusPending)
	if err := scanAIAction(row, &action); err != nil {
		return nil, err
	}
	return &action, nil
}

type aiActionScanner interface {
	Scan(dest ...any) error
}

func scanAIAction(row aiActionScanner, action *AIActionRequest) error {
	var messageID sql.NullString
	var inputBytes []byte
	var resultJSON sql.NullString
	var errorText sql.NullString
	var confirmedAt sql.NullTime
	var executedAt sql.NullTime
	if err := row.Scan(
		&action.ID,
		&action.UserID,
		&action.ConversationID,
		&messageID,
		&action.ActionType,
		&action.Category,
		&inputBytes,
		&action.Status,
		&resultJSON,
		&errorText,
		&action.RequiresConfirmation,
		&action.CreatedAt,
		&confirmedAt,
		&executedAt,
	); err != nil {
		return err
	}
	if messageID.Valid {
		action.MessageID = &messageID.String
	}
	action.InputJSON = json.RawMessage(inputBytes)
	if len(action.InputJSON) == 0 {
		action.InputJSON = json.RawMessage(`{}`)
	}
	if resultJSON.Valid && resultJSON.String != "" {
		action.ResultJSON = json.RawMessage(resultJSON.String)
	}
	if errorText.Valid {
		action.Error = errorText.String
	}
	if confirmedAt.Valid {
		action.ConfirmedAt = &confirmedAt.Time
	}
	if executedAt.Valid {
		action.ExecutedAt = &executedAt.Time
	}
	return nil
}

func nullableRaw(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}
