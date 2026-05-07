package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// BugReport represents a row from the bug_reports table.
type BugReport struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Description string    `json:"description"`
	Severity    string    `json:"severity"`
	PageURL     string    `json:"pageUrl"`
	UserAgent   string    `json:"userAgent"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// CreateBugReport inserts a new bug report and returns its generated UUID.
func (d *DB) CreateBugReport(ctx context.Context, br BugReport) (string, error) {
	severity := br.Severity
	if severity == "" {
		severity = "medium"
	}

	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO bug_reports (user_id, description, severity, page_url, user_agent)
		 VALUES (NULLIF($1,''), $2, $3, NULLIF($4,''), NULLIF($5,''))
		 RETURNING id::TEXT`,
		br.UserID, br.Description, severity, br.PageURL, br.UserAgent).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create bug report: %w", err)
	}
	return id, nil
}

// ListBugReports returns all bug reports ordered by creation date descending.
func (d *DB) ListBugReports(ctx context.Context) ([]BugReport, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id::TEXT, COALESCE(user_id,''), description, severity,
		        COALESCE(page_url,''), COALESCE(user_agent,''),
		        COALESCE(status,'open'), created_at
		 FROM bug_reports ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: list bug reports: %w", err)
	}
	defer rows.Close()

	var result []BugReport
	for rows.Next() {
		var br BugReport
		if err := rows.Scan(
			&br.ID, &br.UserID, &br.Description, &br.Severity,
			&br.PageURL, &br.UserAgent, &br.Status, &br.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan bug report: %w", err)
		}
		result = append(result, br)
	}
	return result, rows.Err()
}

// GetBugReport returns a single bug report by ID.
func (d *DB) GetBugReport(ctx context.Context, id string) (*BugReport, error) {
	var br BugReport
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(user_id,''), description, severity,
		        COALESCE(page_url,''), COALESCE(user_agent,''),
		        COALESCE(status,'open'), created_at
		 FROM bug_reports WHERE id = $1::UUID`, id).Scan(
		&br.ID, &br.UserID, &br.Description, &br.Severity,
		&br.PageURL, &br.UserAgent, &br.Status, &br.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get bug report: %w", err)
	}
	return &br, nil
}
