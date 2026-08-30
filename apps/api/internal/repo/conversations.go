package repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
)

// Conversation is one open thread between an agent and a contact on a
// single channel/provider tuple. Inbound webhooks bump unread_count and
// last_inbound_at; outbound sends update last_outbound_at and (for WA)
// extend whatsapp_window_expires_at.
type Conversation struct {
	ID                      string     `json:"id"`
	ContactID               string     `json:"contactId"`
	Channel                 string     `json:"channel"`
	Provider                string     `json:"provider"`
	ExternalThreadID        *string    `json:"externalThreadId,omitempty"`
	Status                  string     `json:"status"`
	AssignedAgentID         *string    `json:"assignedAgentId,omitempty"`
	LastInboundAt           *time.Time `json:"lastInboundAt,omitempty"`
	LastOutboundAt          *time.Time `json:"lastOutboundAt,omitempty"`
	UnreadCount             int        `json:"unreadCount"`
	WhatsAppWindowExpiresAt *time.Time `json:"whatsappWindowExpiresAt,omitempty"`
	SnoozeUntil             *time.Time `json:"snoozeUntil,omitempty"`
	CreatedAt               time.Time  `json:"createdAt"`
	UpdatedAt               time.Time  `json:"updatedAt"`
}

// ConversationRepo handles CRUD for conversations.
type ConversationRepo struct {
	pool *sql.DB
}

func NewConversationRepo(pool *sql.DB) *ConversationRepo {
	return &ConversationRepo{pool: pool}
}

// ListConversationsQuery filters the inbox list. Empty filters mean "any".
type ListConversationsQuery struct {
	Channel         string // sms | whatsapp | email | voice
	Status          string // open | snoozed | closed
	AssignedAgentID string
	ContactID       string
	Cursor          string // last_inbound_at|id pair, base64-free
	Limit           int
}

const conversationColumns = `id, contact_id, channel, provider, external_thread_id,
	status, assigned_agent_id, last_inbound_at, last_outbound_at, unread_count,
	whatsapp_window_expires_at, snooze_until, created_at, updated_at`

func scanConversation(s scanner) (Conversation, error) {
	var (
		c        Conversation
		extID    sql.NullString
		assigned sql.NullString
		lastIn   sql.NullTime
		lastOut  sql.NullTime
		waExpire sql.NullTime
		snooze   sql.NullTime
	)
	if err := s.Scan(
		&c.ID, &c.ContactID, &c.Channel, &c.Provider, &extID,
		&c.Status, &assigned, &lastIn, &lastOut, &c.UnreadCount,
		&waExpire, &snooze, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return Conversation{}, err
	}
	if extID.Valid {
		c.ExternalThreadID = &extID.String
	}
	if assigned.Valid {
		c.AssignedAgentID = &assigned.String
	}
	if lastIn.Valid {
		c.LastInboundAt = &lastIn.Time
	}
	if lastOut.Valid {
		c.LastOutboundAt = &lastOut.Time
	}
	if waExpire.Valid {
		c.WhatsAppWindowExpiresAt = &waExpire.Time
	}
	if snooze.Valid {
		c.SnoozeUntil = &snooze.Time
	}
	return c, nil
}

// Create inserts a new conversation, allocating a ULID PK if c.ID is empty.
func (r *ConversationRepo) Create(ctx context.Context, c Conversation) (Conversation, error) {
	if strings.TrimSpace(c.ID) == "" {
		c.ID = ulid.Make().String()
	}
	if c.Status == "" {
		c.Status = "open"
	}
	now := time.Now().UTC()
	if c.CreatedAt.IsZero() {
		c.CreatedAt = now
	}
	c.UpdatedAt = now

	_, err := r.pool.ExecContext(ctx, `
		INSERT INTO conversations (id, contact_id, channel, provider, external_thread_id,
			status, assigned_agent_id, last_inbound_at, last_outbound_at, unread_count,
			whatsapp_window_expires_at, snooze_until, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		c.ID, c.ContactID, c.Channel, c.Provider, nullString(c.ExternalThreadID),
		c.Status, nullString(c.AssignedAgentID), nullTime(c.LastInboundAt), nullTime(c.LastOutboundAt),
		c.UnreadCount, nullTime(c.WhatsAppWindowExpiresAt), nullTime(c.SnoozeUntil),
		c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		return Conversation{}, fmt.Errorf("conversations: create: %w", err)
	}
	return c, nil
}

// Get returns the conversation by id, or ErrNotFound.
func (r *ConversationRepo) Get(ctx context.Context, id string) (Conversation, error) {
	row := r.pool.QueryRowContext(ctx,
		`SELECT `+conversationColumns+` FROM conversations WHERE id = $1`, id)
	c, err := scanConversation(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Conversation{}, ErrNotFound
	}
	if err != nil {
		return Conversation{}, fmt.Errorf("conversations: get: %w", err)
	}
	return c, nil
}

// FindOpenByContactChannelProvider returns the open thread for the given
// (contact, channel, provider) tuple. Returns ErrNotFound if none exists.
func (r *ConversationRepo) FindOpenByContactChannelProvider(
	ctx context.Context, contactID, channel, provider string,
) (Conversation, error) {
	row := r.pool.QueryRowContext(ctx,
		`SELECT `+conversationColumns+` FROM conversations
		 WHERE contact_id = $1 AND channel = $2 AND provider = $3 AND status = 'open'
		 ORDER BY created_at DESC LIMIT 1`,
		contactID, channel, provider,
	)
	c, err := scanConversation(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Conversation{}, ErrNotFound
	}
	if err != nil {
		return Conversation{}, fmt.Errorf("conversations: find open: %w", err)
	}
	return c, nil
}

// List returns a page of conversations matching q.
func (r *ConversationRepo) List(ctx context.Context, q ListConversationsQuery) (Page[Conversation], error) {
	limit := q.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var (
		where []string
		args  []any
	)
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if q.Channel != "" {
		add("channel = $%d", q.Channel)
	}
	if q.Status != "" {
		add("status = $%d", q.Status)
	}
	if q.AssignedAgentID != "" {
		add("assigned_agent_id = $%d", q.AssignedAgentID)
	}
	if q.ContactID != "" {
		add("contact_id = $%d", q.ContactID)
	}
	if q.Cursor != "" {
		// Cursor format: "<RFC3339Nano>|<id>". Rows are ordered by
		// last_inbound_at DESC NULLS LAST, id DESC, so the cursor
		// predicate selects rows strictly older than the cursor.
		parts := strings.SplitN(q.Cursor, "|", 2)
		if len(parts) == 2 {
			t, err := time.Parse(time.RFC3339Nano, parts[0])
			if err == nil {
				args = append(args, t, parts[1])
				where = append(where,
					fmt.Sprintf("(last_inbound_at, id) < ($%d, $%d)", len(args)-1, len(args)))
			}
		}
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	args = append(args, limit+1)
	query := `SELECT ` + conversationColumns + ` FROM conversations` + whereSQL +
		` ORDER BY last_inbound_at DESC NULLS LAST, id DESC LIMIT $` + fmt.Sprintf("%d", len(args))

	rows, err := r.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return Page[Conversation]{}, fmt.Errorf("conversations: list: %w", err)
	}
	defer rows.Close()

	var items []Conversation
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return Page[Conversation]{}, fmt.Errorf("conversations: scan: %w", err)
		}
		items = append(items, c)
	}
	if err := rows.Err(); err != nil {
		return Page[Conversation]{}, fmt.Errorf("conversations: rows: %w", err)
	}

	page := Page[Conversation]{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		last := page.Items[limit-1]
		ts := time.Time{}
		if last.LastInboundAt != nil {
			ts = *last.LastInboundAt
		}
		page.NextCursor = ts.Format(time.RFC3339Nano) + "|" + last.ID
	}
	return page, nil
}

// BumpUnread increments unread_count by n (typically 1) and updates
// last_inbound_at, both atomically.
func (r *ConversationRepo) BumpUnread(ctx context.Context, id string, n int, at time.Time) error {
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET unread_count = unread_count + $2,
		     last_inbound_at = $3, updated_at = now() WHERE id = $1`,
		id, n, at.UTC(),
	)
	if err != nil {
		return fmt.Errorf("conversations: bump unread: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// MarkRead zeros unread_count.
func (r *ConversationRepo) MarkRead(ctx context.Context, id string) error {
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET unread_count = 0, updated_at = now() WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("conversations: mark read: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// MarkOutbound updates last_outbound_at after a successful send.
func (r *ConversationRepo) MarkOutbound(ctx context.Context, id string, at time.Time) error {
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET last_outbound_at = $2, updated_at = now() WHERE id = $1`,
		id, at.UTC(),
	)
	if err != nil {
		return fmt.Errorf("conversations: mark outbound: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// ExtendWhatsAppWindow sets whatsapp_window_expires_at to expires (typically
// now()+24h on every WA inbound).
func (r *ConversationRepo) ExtendWhatsAppWindow(ctx context.Context, id string, expires time.Time) error {
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET whatsapp_window_expires_at = $2, updated_at = now() WHERE id = $1`,
		id, expires.UTC(),
	)
	if err != nil {
		return fmt.Errorf("conversations: extend wa window: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// Snooze marks a conversation status='snoozed' until the given time.
func (r *ConversationRepo) Snooze(ctx context.Context, id string, until time.Time) error {
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET status = 'snoozed', snooze_until = $2, updated_at = now()
		 WHERE id = $1`, id, until.UTC())
	if err != nil {
		return fmt.Errorf("conversations: snooze: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// Close marks the thread closed. Future inbound messages will create a new thread.
func (r *ConversationRepo) Close(ctx context.Context, id string) error {
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET status = 'closed', snooze_until = NULL, updated_at = now()
		 WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("conversations: close: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// Assign sets assigned_agent_id. Pass empty string to clear.
func (r *ConversationRepo) Assign(ctx context.Context, id, agentID string) error {
	var arg sql.NullString
	if strings.TrimSpace(agentID) != "" {
		arg = sql.NullString{String: agentID, Valid: true}
	}
	res, err := r.pool.ExecContext(ctx,
		`UPDATE conversations SET assigned_agent_id = $2, updated_at = now() WHERE id = $1`,
		id, arg)
	if err != nil {
		return fmt.Errorf("conversations: assign: %w", err)
	}
	if rowsAffected(res) == 0 {
		return ErrNotFound
	}
	return nil
}

// ListByContact returns every conversation for a contact, newest activity first.
// No pagination — contacts typically have a handful of threads at most.
func (r *ConversationRepo) ListByContact(ctx context.Context, contactID string) ([]Conversation, error) {
	rows, err := r.pool.QueryContext(ctx,
		`SELECT `+conversationColumns+` FROM conversations
		 WHERE contact_id = $1
		 ORDER BY COALESCE(last_inbound_at, last_outbound_at, created_at) DESC, id DESC`,
		contactID)
	if err != nil {
		return nil, fmt.Errorf("conversations: list by contact: %w", err)
	}
	defer rows.Close()
	out := []Conversation{}
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return nil, fmt.Errorf("conversations: scan: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ── helpers shared with messages.go / templates.go ────────────────────────

func nullString(p *string) sql.NullString {
	if p == nil || *p == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *p, Valid: true}
}

func nullTime(p *time.Time) sql.NullTime {
	if p == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *p, Valid: true}
}

func rowsAffected(r sql.Result) int64 {
	if r == nil {
		return 0
	}
	n, _ := r.RowsAffected()
	return n
}
