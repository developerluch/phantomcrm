package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AuditEntry represents a row from the audit_log table.
type AuditEntry struct {
	ID           int             `json:"id"`
	OrgID        string          `json:"orgId"`
	UserID       string          `json:"userId"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resourceType"`
	ResourceID   string          `json:"resourceId"`
	Details      json.RawMessage `json:"details"`
	IPAddress    string          `json:"ipAddress"`
	CreatedAt    time.Time       `json:"createdAt"`
}

// CreateAuditEntry inserts a new audit log entry.
func (d *DB) CreateAuditEntry(ctx context.Context, entry AuditEntry) error {
	details := entry.Details
	if details == nil {
		details = json.RawMessage("{}")
	}
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO audit_log (org_id, user_id, action, resource_type, resource_id, details, ip_address)
		 VALUES (NULLIF($1,'')::UUID, NULLIF($2,'')::UUID, $3, $4, $5, $6, $7)`,
		entry.OrgID, entry.UserID, entry.Action, entry.ResourceType, entry.ResourceID,
		details, entry.IPAddress)
	if err != nil {
		return fmt.Errorf("db: create audit entry: %w", err)
	}
	return nil
}

// ListAuditEntries returns audit log entries ordered by created_at DESC with pagination.
func (d *DB) ListAuditEntries(ctx context.Context, limit, offset int) ([]AuditEntry, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id, COALESCE(org_id::TEXT,''), COALESCE(user_id::TEXT,''),
		        action, COALESCE(resource_type,''), COALESCE(resource_id,''),
		        COALESCE(details, '{}'), COALESCE(ip_address,''), created_at
		 FROM audit_log
		 ORDER BY created_at DESC
		 LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("db: list audit entries: %w", err)
	}
	defer rows.Close()

	var result []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var details sql.NullString
		if err := rows.Scan(
			&e.ID, &e.OrgID, &e.UserID,
			&e.Action, &e.ResourceType, &e.ResourceID,
			&details, &e.IPAddress, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan audit entry: %w", err)
		}
		if details.Valid && details.String != "" {
			e.Details = json.RawMessage(details.String)
		} else {
			e.Details = json.RawMessage("{}")
		}
		result = append(result, e)
	}
	return result, rows.Err()
}
