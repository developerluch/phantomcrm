package db

import (
	"context"
	"encoding/json"
	"time"
)

type ChatConversation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Title     string    `json:"title,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type ChatMessage struct {
	ID             string          `json:"id"`
	ConversationID string          `json:"conversationId"`
	Role           string          `json:"role"`
	Content        string          `json:"content"`
	ToolCallsJSON  json.RawMessage `json:"toolCalls,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
}

func (d *DB) CreateChatConversation(ctx context.Context, userID, title string) (*ChatConversation, error) {
	var cc ChatConversation
	err := d.pool.QueryRowContext(ctx, `INSERT INTO chat_conversations (user_id, title) VALUES ($1, $2)
		RETURNING id, user_id, COALESCE(title,''), created_at`, userID, title).
		Scan(&cc.ID, &cc.UserID, &cc.Title, &cc.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &cc, nil
}

func (d *DB) ListChatConversations(ctx context.Context, userID string) ([]ChatConversation, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, user_id, COALESCE(title,''), created_at
		FROM chat_conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []ChatConversation
	for rows.Next() {
		var cc ChatConversation
		if err := rows.Scan(&cc.ID, &cc.UserID, &cc.Title, &cc.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, cc)
	}
	return result, rows.Err()
}

func (d *DB) GetChatConversation(ctx context.Context, id string) (*ChatConversation, error) {
	var cc ChatConversation
	err := d.pool.QueryRowContext(ctx, `SELECT id, user_id, COALESCE(title,''), created_at
		FROM chat_conversations WHERE id = $1`, id).
		Scan(&cc.ID, &cc.UserID, &cc.Title, &cc.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &cc, nil
}

func (d *DB) CreateChatMessage(ctx context.Context, conversationID, role, content string, toolCalls json.RawMessage) (*ChatMessage, error) {
	var cm ChatMessage
	var tc *[]byte
	err := d.pool.QueryRowContext(ctx, `INSERT INTO chat_messages (conversation_id, role, content, tool_calls_json)
		VALUES ($1, $2, $3, $4)
		RETURNING id, conversation_id, role, content, tool_calls_json, created_at`,
		conversationID, role, content, toolCalls).
		Scan(&cm.ID, &cm.ConversationID, &cm.Role, &cm.Content, &tc, &cm.CreatedAt)
	if err != nil {
		return nil, err
	}
	if tc != nil {
		cm.ToolCallsJSON = json.RawMessage(*tc)
	}
	return &cm, nil
}

func (d *DB) ListChatMessages(ctx context.Context, conversationID string) ([]ChatMessage, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, conversation_id, role, content, tool_calls_json, created_at
		FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []ChatMessage
	for rows.Next() {
		var cm ChatMessage
		var tc *[]byte
		if err := rows.Scan(&cm.ID, &cm.ConversationID, &cm.Role, &cm.Content, &tc, &cm.CreatedAt); err != nil {
			return nil, err
		}
		if tc != nil {
			cm.ToolCallsJSON = json.RawMessage(*tc)
		}
		result = append(result, cm)
	}
	return result, rows.Err()
}

func (d *DB) UpdateConversationTitle(ctx context.Context, id, title string) error {
	_, err := d.pool.ExecContext(ctx, `UPDATE chat_conversations SET title = $2 WHERE id = $1`, id, title)
	return err
}

func (d *DB) DeleteChatConversation(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, `DELETE FROM chat_conversations WHERE id = $1`, id)
	return err
}
