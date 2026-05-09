package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
)

// MessageTemplate is a pre-approved outbound template (typically for the
// WhatsApp 24h customer-care window). Approval is external — this table
// just stores the rendered body + variable schema.
type MessageTemplate struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Channel    string    `json:"channel"`
	Provider   string    `json:"provider"`
	ExternalID *string   `json:"externalId,omitempty"`
	Category   *string   `json:"category,omitempty"`
	Language   string    `json:"language"`
	Body       string    `json:"body"`
	Variables  []string  `json:"variables"`
	Status     string    `json:"status"` // draft | approved | rejected
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type TemplateRepo struct {
	pool *sql.DB
}

func NewTemplateRepo(pool *sql.DB) *TemplateRepo {
	return &TemplateRepo{pool: pool}
}

const templateColumns = `id, name, channel, provider, external_id, category, language,
	body, variables, status, created_at, updated_at`

func scanTemplate(s scanner) (MessageTemplate, error) {
	var (
		t        MessageTemplate
		extID    sql.NullString
		category sql.NullString
		varsB    []byte
	)
	if err := s.Scan(
		&t.ID, &t.Name, &t.Channel, &t.Provider, &extID, &category, &t.Language,
		&t.Body, &varsB, &t.Status, &t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return MessageTemplate{}, err
	}
	if extID.Valid {
		t.ExternalID = &extID.String
	}
	if category.Valid {
		t.Category = &category.String
	}
	if len(varsB) > 0 {
		_ = json.Unmarshal(varsB, &t.Variables)
	}
	if t.Variables == nil {
		t.Variables = []string{}
	}
	return t, nil
}

func (r *TemplateRepo) Create(ctx context.Context, t MessageTemplate) (MessageTemplate, error) {
	if strings.TrimSpace(t.ID) == "" {
		t.ID = ulid.Make().String()
	}
	if t.Language == "" {
		t.Language = "en"
	}
	if t.Status == "" {
		t.Status = "draft"
	}
	now := time.Now().UTC()
	if t.CreatedAt.IsZero() {
		t.CreatedAt = now
	}
	t.UpdatedAt = now
	varsB, _ := json.Marshal(orEmptyStringSlice(t.Variables))

	_, err := r.pool.ExecContext(ctx, `
		INSERT INTO message_templates (id, name, channel, provider, external_id, category,
			language, body, variables, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		t.ID, t.Name, t.Channel, t.Provider, nullString(t.ExternalID), nullString(t.Category),
		t.Language, t.Body, varsB, t.Status, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return MessageTemplate{}, fmt.Errorf("templates: create: %w", err)
	}
	return t, nil
}

func (r *TemplateRepo) Get(ctx context.Context, id string) (MessageTemplate, error) {
	row := r.pool.QueryRowContext(ctx,
		`SELECT `+templateColumns+` FROM message_templates WHERE id = $1`, id)
	t, err := scanTemplate(row)
	if errors.Is(err, sql.ErrNoRows) {
		return MessageTemplate{}, ErrNotFound
	}
	if err != nil {
		return MessageTemplate{}, fmt.Errorf("templates: get: %w", err)
	}
	return t, nil
}

func (r *TemplateRepo) Update(ctx context.Context, id string, patch map[string]any) (MessageTemplate, error) {
	if len(patch) == 0 {
		return r.Get(ctx, id)
	}
	allowed := map[string]string{
		"name":       "name",
		"channel":    "channel",
		"provider":   "provider",
		"externalId": "external_id",
		"category":   "category",
		"language":   "language",
		"body":       "body",
		"variables":  "variables",
		"status":     "status",
	}
	var sets []string
	var args []any
	for k, v := range patch {
		col, ok := allowed[k]
		if !ok {
			continue
		}
		if col == "variables" {
			b, _ := json.Marshal(v)
			args = append(args, b)
		} else {
			args = append(args, v)
		}
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	if len(sets) == 0 {
		return r.Get(ctx, id)
	}
	args = append(args, id)
	q := `UPDATE message_templates SET ` + strings.Join(sets, ", ") +
		`, updated_at = now() WHERE id = $` + fmt.Sprintf("%d", len(args))
	res, err := r.pool.ExecContext(ctx, q, args...)
	if err != nil {
		return MessageTemplate{}, fmt.Errorf("templates: update: %w", err)
	}
	if rowsAffected(res) == 0 {
		return MessageTemplate{}, ErrNotFound
	}
	return r.Get(ctx, id)
}

func (r *TemplateRepo) Delete(ctx context.Context, id string) error {
	res, err := r.pool.ExecContext(ctx,
		`DELETE FROM message_templates WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("templates: delete: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// List returns templates filtered by channel/status. Empty filters mean "any".
func (r *TemplateRepo) List(ctx context.Context, channel, status string) ([]MessageTemplate, error) {
	var (
		where []string
		args  []any
	)
	if channel != "" {
		args = append(args, channel)
		where = append(where, fmt.Sprintf("channel = $%d", len(args)))
	}
	if status != "" {
		args = append(args, status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}
	rows, err := r.pool.QueryContext(ctx,
		`SELECT `+templateColumns+` FROM message_templates`+whereSQL+
			` ORDER BY name ASC, id ASC`, args...)
	if err != nil {
		return nil, fmt.Errorf("templates: list: %w", err)
	}
	defer rows.Close()
	out := []MessageTemplate{}
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, fmt.Errorf("templates: scan: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func orEmptyStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
