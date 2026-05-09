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

// Message is one inbound or outbound entry on a conversation. Append-only.
type Message struct {
	ID                  string         `json:"id"`
	ConversationID      string         `json:"conversationId"`
	ContactID           string         `json:"contactId"`
	Direction           string         `json:"direction"` // inbound | outbound
	Channel             string         `json:"channel"`
	Provider            string         `json:"provider"`
	ExternalMessageID   *string        `json:"externalMessageId,omitempty"`
	FromAddr            *string        `json:"fromAddr,omitempty"`
	ToAddr              *string        `json:"toAddr,omitempty"`
	Body                string         `json:"body"`
	MediaURLs           []string       `json:"mediaUrls,omitempty"`
	TemplateID          *string        `json:"templateId,omitempty"`
	TemplateVariables   map[string]any `json:"templateVariables,omitempty"`
	Status              string         `json:"status"`
	ErrorCode           *string        `json:"errorCode,omitempty"`
	ErrorMessage        *string        `json:"errorMessage,omitempty"`
	SentByAgentID       *string        `json:"sentByAgentId,omitempty"`
	SentByAutomationID  *string        `json:"sentByAutomationId,omitempty"`
	CostCents           *int           `json:"costCents,omitempty"`
	IdempotencyKey      *string        `json:"idempotencyKey,omitempty"`
	CreatedAt           time.Time      `json:"createdAt"`
}

// MessageRepo handles inserts + reads on the messages table.
type MessageRepo struct {
	pool *sql.DB
}

func NewMessageRepo(pool *sql.DB) *MessageRepo {
	return &MessageRepo{pool: pool}
}

const messageColumns = `id, conversation_id, contact_id, direction, channel, provider,
	external_message_id, from_addr, to_addr, body, media_urls, template_id,
	template_variables, status, error_code, error_message, sent_by_agent_id,
	sent_by_automation_id, cost_cents, idempotency_key, created_at`

func scanMessage(s scanner) (Message, error) {
	var (
		m         Message
		extID     sql.NullString
		fromAddr  sql.NullString
		toAddr    sql.NullString
		mediaB    []byte
		tmplID    sql.NullString
		tmplVarsB []byte
		errCode   sql.NullString
		errMsg    sql.NullString
		byAgent   sql.NullString
		byAuto    sql.NullString
		costCents sql.NullInt32
		idemKey   sql.NullString
	)
	if err := s.Scan(
		&m.ID, &m.ConversationID, &m.ContactID, &m.Direction, &m.Channel, &m.Provider,
		&extID, &fromAddr, &toAddr, &m.Body, &mediaB, &tmplID,
		&tmplVarsB, &m.Status, &errCode, &errMsg, &byAgent,
		&byAuto, &costCents, &idemKey, &m.CreatedAt,
	); err != nil {
		return Message{}, err
	}
	if extID.Valid {
		m.ExternalMessageID = &extID.String
	}
	if fromAddr.Valid {
		m.FromAddr = &fromAddr.String
	}
	if toAddr.Valid {
		m.ToAddr = &toAddr.String
	}
	if len(mediaB) > 0 {
		_ = json.Unmarshal(mediaB, &m.MediaURLs)
	}
	if tmplID.Valid {
		m.TemplateID = &tmplID.String
	}
	if len(tmplVarsB) > 0 {
		_ = json.Unmarshal(tmplVarsB, &m.TemplateVariables)
	}
	if errCode.Valid {
		m.ErrorCode = &errCode.String
	}
	if errMsg.Valid {
		m.ErrorMessage = &errMsg.String
	}
	if byAgent.Valid {
		m.SentByAgentID = &byAgent.String
	}
	if byAuto.Valid {
		m.SentByAutomationID = &byAuto.String
	}
	if costCents.Valid {
		c := int(costCents.Int32)
		m.CostCents = &c
	}
	if idemKey.Valid {
		m.IdempotencyKey = &idemKey.String
	}
	return m, nil
}

// Insert appends a new message and returns it with the allocated ULID.
func (r *MessageRepo) Insert(ctx context.Context, m Message) (Message, error) {
	if strings.TrimSpace(m.ID) == "" {
		m.ID = ulid.Make().String()
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now().UTC()
	}
	if m.Status == "" {
		m.Status = "queued"
	}

	mediaB, _ := json.Marshal(orEmptySlice(m.MediaURLs))
	tmplVarsB, _ := json.Marshal(orEmptyMap(m.TemplateVariables))

	var costCents sql.NullInt32
	if m.CostCents != nil {
		costCents = sql.NullInt32{Int32: int32(*m.CostCents), Valid: true}
	}

	_, err := r.pool.ExecContext(ctx, `
		INSERT INTO messages (id, conversation_id, contact_id, direction, channel, provider,
			external_message_id, from_addr, to_addr, body, media_urls, template_id,
			template_variables, status, error_code, error_message, sent_by_agent_id,
			sent_by_automation_id, cost_cents, idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
			$17, $18, $19, $20, $21)`,
		m.ID, m.ConversationID, m.ContactID, m.Direction, m.Channel, m.Provider,
		nullString(m.ExternalMessageID), nullString(m.FromAddr), nullString(m.ToAddr),
		m.Body, mediaB, nullString(m.TemplateID),
		tmplVarsB, m.Status, nullString(m.ErrorCode), nullString(m.ErrorMessage),
		nullString(m.SentByAgentID), nullString(m.SentByAutomationID), costCents,
		nullString(m.IdempotencyKey), m.CreatedAt,
	)
	if err != nil {
		return Message{}, fmt.Errorf("messages: insert: %w", err)
	}
	return m, nil
}

// FindByIdempotencyKey returns the existing message for the given
// (conversation, key) tuple, or ErrNotFound.
func (r *MessageRepo) FindByIdempotencyKey(ctx context.Context, conversationID, key string) (Message, error) {
	if strings.TrimSpace(key) == "" {
		return Message{}, ErrNotFound
	}
	row := r.pool.QueryRowContext(ctx,
		`SELECT `+messageColumns+` FROM messages
		 WHERE conversation_id = $1 AND idempotency_key = $2 LIMIT 1`,
		conversationID, key,
	)
	m, err := scanMessage(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Message{}, ErrNotFound
	}
	if err != nil {
		return Message{}, fmt.Errorf("messages: find idem: %w", err)
	}
	return m, nil
}

// ListByConversation returns the most-recent messages first, paginated by
// (created_at, id) cursor.
func (r *MessageRepo) ListByConversation(
	ctx context.Context, conversationID, cursor string, limit int,
) (Page[Message], error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args := []any{conversationID}
	cursorPred := ""
	if cursor != "" {
		parts := strings.SplitN(cursor, "|", 2)
		if len(parts) == 2 {
			t, err := time.Parse(time.RFC3339Nano, parts[0])
			if err == nil {
				args = append(args, t, parts[1])
				cursorPred = " AND (created_at, id) < ($2, $3)"
			}
		}
	}
	args = append(args, limit+1)
	query := `SELECT ` + messageColumns + ` FROM messages
	          WHERE conversation_id = $1` + cursorPred + `
	          ORDER BY created_at DESC, id DESC LIMIT $` + fmt.Sprintf("%d", len(args))

	rows, err := r.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return Page[Message]{}, fmt.Errorf("messages: list: %w", err)
	}
	defer rows.Close()
	var items []Message
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return Page[Message]{}, fmt.Errorf("messages: scan: %w", err)
		}
		items = append(items, m)
	}
	if err := rows.Err(); err != nil {
		return Page[Message]{}, fmt.Errorf("messages: rows: %w", err)
	}

	page := Page[Message]{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		last := page.Items[limit-1]
		page.NextCursor = last.CreatedAt.Format(time.RFC3339Nano) + "|" + last.ID
	}
	return page, nil
}

func orEmptySlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func orEmptyMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}
