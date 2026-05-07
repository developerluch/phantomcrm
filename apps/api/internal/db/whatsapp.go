package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// WhatsAppSession represents a row from the whatsapp_sessions table.
type WhatsAppSession struct {
	ID              string     `json:"id"`
	VADiscordID     string     `json:"vaDiscordId"`
	VAName          string     `json:"vaName"`
	PhoneNumber     string     `json:"phoneNumber"`
	Status          string     `json:"status"`
	LastConnectedAt *time.Time `json:"lastConnectedAt"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

// WhatsAppConversation represents a row from the whatsapp_conversations table.
type WhatsAppConversation struct {
	ID             string     `json:"id"`
	SessionID      *string    `json:"sessionId"`
	ContactPhone   string     `json:"contactPhone"`
	ContactName    string     `json:"contactName"`
	AgentDiscordID string     `json:"agentDiscordId"`
	LastMessageAt  *time.Time `json:"lastMessageAt"`
	UnreadCount    int        `json:"unreadCount"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	RecruitID      *string    `json:"recruitId"`
}

// WhatsAppMessage represents a row from the whatsapp_messages table.
type WhatsAppMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversationId"`
	Sender         string    `json:"sender"`
	Body           string    `json:"body"`
	MediaURL       string    `json:"mediaUrl"`
	MediaType      string    `json:"mediaType"`
	IsFromContact  bool      `json:"isFromContact"`
	SentAt         time.Time `json:"sentAt"`
}

// UpsertWhatsAppSession creates or updates a WhatsApp session and returns its ID.
func (d *DB) UpsertWhatsAppSession(ctx context.Context, s WhatsAppSession) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO whatsapp_sessions (va_discord_id, va_name, phone_number, status, last_connected_at)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (va_discord_id) DO UPDATE SET
		   va_name = EXCLUDED.va_name,
		   phone_number = EXCLUDED.phone_number,
		   status = EXCLUDED.status,
		   last_connected_at = EXCLUDED.last_connected_at,
		   updated_at = NOW()
		 RETURNING id::TEXT`,
		s.VADiscordID, s.VAName, s.PhoneNumber, s.Status, s.LastConnectedAt).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: upsert whatsapp session: %w", err)
	}
	return id, nil
}

// ListWhatsAppSessions returns all WhatsApp sessions.
func (d *DB) ListWhatsAppSessions(ctx context.Context) ([]WhatsAppSession, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, va_discord_id, COALESCE(va_name,''), COALESCE(phone_number,''),
		        COALESCE(status,'disconnected'), last_connected_at, created_at, updated_at
		 FROM whatsapp_sessions ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: list whatsapp sessions: %w", err)
	}
	defer rows.Close()

	var result []WhatsAppSession
	for rows.Next() {
		var s WhatsAppSession
		var lastConn sql.NullTime
		if err := rows.Scan(
			&s.ID, &s.VADiscordID, &s.VAName, &s.PhoneNumber,
			&s.Status, &lastConn, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan whatsapp session: %w", err)
		}
		s.LastConnectedAt = nullTime(lastConn)
		result = append(result, s)
	}
	return result, rows.Err()
}

// GetWhatsAppSession returns a WhatsApp session by ID, or nil if not found.
func (d *DB) GetWhatsAppSession(ctx context.Context, id string) (*WhatsAppSession, error) {
	var s WhatsAppSession
	var lastConn sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, va_discord_id, COALESCE(va_name,''), COALESCE(phone_number,''),
		        COALESCE(status,'disconnected'), last_connected_at, created_at, updated_at
		 FROM whatsapp_sessions WHERE id = $1::UUID`, id).Scan(
		&s.ID, &s.VADiscordID, &s.VAName, &s.PhoneNumber,
		&s.Status, &lastConn, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get whatsapp session: %w", err)
	}
	s.LastConnectedAt = nullTime(lastConn)
	return &s, nil
}

// ListConversations returns all conversations for a given session.
func (d *DB) ListConversations(ctx context.Context, sessionID string) ([]WhatsAppConversation, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, COALESCE(session_id::TEXT,''), contact_phone, COALESCE(contact_name,''),
		        COALESCE(agent_discord_id,''), last_message_at,
		        COALESCE(unread_count,0), created_at, updated_at, recruit_id::TEXT
		 FROM whatsapp_conversations WHERE session_id = $1::UUID
		 ORDER BY COALESCE(last_message_at, created_at) DESC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("db: list conversations: %w", err)
	}
	defer rows.Close()
	return d.scanConversations(rows)
}

// scanConversations scans rows into WhatsAppConversation slices.
func (d *DB) scanConversations(rows *sql.Rows) ([]WhatsAppConversation, error) {
	var result []WhatsAppConversation
	for rows.Next() {
		var c WhatsAppConversation
		var sessionID, recruitID sql.NullString
		var lastMsg sql.NullTime
		if err := rows.Scan(
			&c.ID, &sessionID, &c.ContactPhone, &c.ContactName,
			&c.AgentDiscordID, &lastMsg,
			&c.UnreadCount, &c.CreatedAt, &c.UpdatedAt, &recruitID,
		); err != nil {
			return nil, fmt.Errorf("db: scan conversation: %w", err)
		}
		c.SessionID = nullStr(sessionID)
		c.RecruitID = nullStr(recruitID)
		c.LastMessageAt = nullTime(lastMsg)
		result = append(result, c)
	}
	return result, rows.Err()
}

// FindOrCreateConversationByPhone finds a conversation by phone or creates one without a session.
func (d *DB) FindOrCreateConversationByPhone(ctx context.Context, phone, contactName string) (*WhatsAppConversation, error) {
	// First try to find existing
	var c WhatsAppConversation
	var sessionID, recruitID sql.NullString
	var lastMsg sql.NullTime
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(session_id::TEXT,''), contact_phone, COALESCE(contact_name,''),
		        COALESCE(agent_discord_id,''), last_message_at,
		        COALESCE(unread_count,0), created_at, updated_at, recruit_id::TEXT
		 FROM whatsapp_conversations WHERE contact_phone = $1
		 ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 1`, phone).Scan(
		&c.ID, &sessionID, &c.ContactPhone, &c.ContactName,
		&c.AgentDiscordID, &lastMsg,
		&c.UnreadCount, &c.CreatedAt, &c.UpdatedAt, &recruitID)

	if err == nil {
		c.SessionID = nullStr(sessionID)
		c.RecruitID = nullStr(recruitID)
		c.LastMessageAt = nullTime(lastMsg)
		return &c, nil
	}
	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("db: find conversation by phone: %w", err)
	}

	// Create new conversation without session
	var id string
	err = d.pool.QueryRowContext(ctx,
		`INSERT INTO whatsapp_conversations (contact_phone, contact_name)
		 VALUES ($1, $2)
		 RETURNING id::TEXT`, phone, contactName).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("db: create conversation: %w", err)
	}

	return &WhatsAppConversation{
		ID:           id,
		ContactPhone: phone,
		ContactName:  contactName,
	}, nil
}

// LinkConversationToRecruit links a WhatsApp conversation to a recruit.
func (d *DB) LinkConversationToRecruit(ctx context.Context, conversationID, recruitID string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE whatsapp_conversations SET recruit_id = $1::UUID WHERE id = $2::UUID`,
		recruitID, conversationID)
	if err != nil {
		return fmt.Errorf("db: link conversation to recruit: %w", err)
	}
	return nil
}

// GetConversationsByRecruit returns all conversations linked to a recruit.
func (d *DB) GetConversationsByRecruit(ctx context.Context, recruitID string) ([]WhatsAppConversation, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, COALESCE(session_id::TEXT,''), contact_phone, COALESCE(contact_name,''),
		        COALESCE(agent_discord_id,''), last_message_at,
		        COALESCE(unread_count,0), created_at, updated_at, recruit_id::TEXT
		 FROM whatsapp_conversations WHERE recruit_id = $1::UUID
		 ORDER BY COALESCE(last_message_at, created_at) DESC`, recruitID)
	if err != nil {
		return nil, fmt.Errorf("db: get conversations by recruit: %w", err)
	}
	defer rows.Close()
	return d.scanConversations(rows)
}

// ListAllConversations returns all WhatsApp conversations regardless of session.
func (d *DB) ListAllConversations(ctx context.Context) ([]WhatsAppConversation, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, COALESCE(session_id::TEXT,''), contact_phone, COALESCE(contact_name,''),
		        COALESCE(agent_discord_id,''), last_message_at,
		        COALESCE(unread_count,0), created_at, updated_at, recruit_id::TEXT
		 FROM whatsapp_conversations
		 ORDER BY COALESCE(last_message_at, created_at) DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: list all conversations: %w", err)
	}
	defer rows.Close()
	return d.scanConversations(rows)
}

// UpdateConversationLastMessage updates last_message_at and optionally increments unread_count.
func (d *DB) UpdateConversationLastMessage(ctx context.Context, conversationID string, isFromContact bool) error {
	if isFromContact {
		_, err := d.pool.ExecContext(ctx,
			`UPDATE whatsapp_conversations SET last_message_at = NOW(), unread_count = unread_count + 1, updated_at = NOW() WHERE id = $1::UUID`,
			conversationID)
		return err
	}
	_, err := d.pool.ExecContext(ctx,
		`UPDATE whatsapp_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1::UUID`,
		conversationID)
	return err
}

// CreateMessage inserts a new WhatsApp message and returns its generated UUID.
func (d *DB) CreateMessage(ctx context.Context, msg WhatsAppMessage) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO whatsapp_messages (conversation_id, sender, body, media_url, media_type, is_from_contact)
		 VALUES ($1::UUID, $2, $3, $4, $5, $6)
		 RETURNING id::TEXT`,
		msg.ConversationID, msg.Sender, msg.Body, msg.MediaURL, msg.MediaType, msg.IsFromContact).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create whatsapp message: %w", err)
	}
	return id, nil
}

// ListMessages returns messages for a conversation, ordered by sent_at DESC, limited.
func (d *DB) ListMessages(ctx context.Context, conversationID string, limit int) ([]WhatsAppMessage, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, conversation_id::TEXT, sender, body,
		        COALESCE(media_url,''), COALESCE(media_type,''),
		        COALESCE(is_from_contact, false), sent_at
		 FROM whatsapp_messages WHERE conversation_id = $1::UUID
		 ORDER BY sent_at DESC
		 LIMIT $2`, conversationID, limit)
	if err != nil {
		return nil, fmt.Errorf("db: list messages: %w", err)
	}
	defer rows.Close()

	var result []WhatsAppMessage
	for rows.Next() {
		var m WhatsAppMessage
		if err := rows.Scan(
			&m.ID, &m.ConversationID, &m.Sender, &m.Body,
			&m.MediaURL, &m.MediaType,
			&m.IsFromContact, &m.SentAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan message: %w", err)
		}
		result = append(result, m)
	}
	return result, rows.Err()
}
