package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type Notification struct {
	ID        string                 `json:"id"`
	UserID    *string                `json:"userId"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	Read      bool                   `json:"read"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt time.Time              `json:"createdAt"`
}

func (d *DB) CreateNotification(ctx context.Context, n *Notification) (string, error) {
	dataJSON, _ := json.Marshal(n.Data)
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO notifications (user_id, type, title, message, data)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id::TEXT`,
		n.UserID, n.Type, n.Title, n.Message, dataJSON).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create notification: %w", err)
	}
	return id, nil
}

func (d *DB) ListNotifications(ctx context.Context, userID string, notifType string, page, perPage int) ([]Notification, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 25
	}
	offset := (page - 1) * perPage

	where := "user_id = $1::UUID"
	args := []interface{}{userID}
	argN := 2
	if notifType != "" {
		where += fmt.Sprintf(" AND type = $%d", argN)
		args = append(args, notifType)
		argN++
	}

	var total int
	d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM notifications WHERE "+where, args...).Scan(&total)

	args = append(args, perPage, offset)
	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT id::TEXT, user_id::TEXT, type, title, message, read, data, created_at
		 FROM notifications WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argN, argN+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("db: list notifications: %w", err)
	}
	defer rows.Close()

	var result []Notification
	for rows.Next() {
		var n Notification
		var userID sql.NullString
		var dataBytes []byte
		if err := rows.Scan(&n.ID, &userID, &n.Type, &n.Title, &n.Message, &n.Read, &dataBytes, &n.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("db: scan notification: %w", err)
		}
		n.UserID = nullStr(userID)
		if dataBytes != nil {
			json.Unmarshal(dataBytes, &n.Data)
		}
		result = append(result, n)
	}
	return result, total, rows.Err()
}

func (d *DB) GetUnreadNotificationCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := d.pool.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM notifications WHERE user_id = $1::UUID AND read = FALSE", userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("db: unread count: %w", err)
	}
	return count, nil
}

func (d *DB) MarkNotificationRead(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "UPDATE notifications SET read = TRUE WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: mark read: %w", err)
	}
	return nil
}

func (d *DB) MarkAllNotificationsRead(ctx context.Context, userID string) error {
	_, err := d.pool.ExecContext(ctx, "UPDATE notifications SET read = TRUE WHERE user_id = $1::UUID AND read = FALSE", userID)
	if err != nil {
		return fmt.Errorf("db: mark all read: %w", err)
	}
	return nil
}
