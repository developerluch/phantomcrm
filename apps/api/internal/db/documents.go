package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Document represents a row from the documents table.
type Document struct {
	ID             string    `json:"id"`
	OrgID          string    `json:"orgId"`
	AgentDiscordID string    `json:"agentDiscordId"`
	UploadedBy     string    `json:"uploadedBy"`
	Filename       string    `json:"filename"`
	FileURL        string    `json:"fileUrl"`
	Category       string    `json:"category"`
	FileSize       int64     `json:"fileSize"`
	MimeType       string    `json:"mimeType"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// CreateDocument inserts a new document and returns its generated UUID.
func (d *DB) CreateDocument(ctx context.Context, doc Document) (string, error) {
	var id string
	category := doc.Category
	if category == "" {
		category = "general"
	}
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO documents (org_id, agent_discord_id, uploaded_by, filename, file_url, category, file_size, mime_type)
		 VALUES (NULLIF($1,'')::UUID, $2, NULLIF($3,'')::UUID, $4, $5, $6, $7, $8)
		 RETURNING id::TEXT`,
		doc.OrgID, doc.AgentDiscordID, doc.UploadedBy, doc.Filename, doc.FileURL,
		category, doc.FileSize, doc.MimeType).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create document: %w", err)
	}
	return id, nil
}

// GetDocument returns a document by ID, or nil if not found.
func (d *DB) GetDocument(ctx context.Context, id string) (*Document, error) {
	var doc Document
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, COALESCE(org_id::TEXT,''), COALESCE(agent_discord_id,''),
		        COALESCE(uploaded_by::TEXT,''), filename, file_url,
		        COALESCE(category,'general'), COALESCE(file_size,0), COALESCE(mime_type,''),
		        created_at, updated_at
		 FROM documents WHERE id = $1::UUID`, id).Scan(
		&doc.ID, &doc.OrgID, &doc.AgentDiscordID,
		&doc.UploadedBy, &doc.Filename, &doc.FileURL,
		&doc.Category, &doc.FileSize, &doc.MimeType,
		&doc.CreatedAt, &doc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get document: %w", err)
	}
	return &doc, nil
}

// ListDocuments returns documents, optionally filtered by agent discord ID.
// If agentDiscordID is non-empty, only that agent's documents are returned.
func (d *DB) ListDocuments(ctx context.Context, agentDiscordID string) ([]Document, error) {
	var rows *sql.Rows
	var err error

	if agentDiscordID != "" {
		rows, err = d.pool.QueryContext(ctx,
			`SELECT id::TEXT, COALESCE(org_id::TEXT,''), COALESCE(agent_discord_id,''),
			        COALESCE(uploaded_by::TEXT,''), filename, file_url,
			        COALESCE(category,'general'), COALESCE(file_size,0), COALESCE(mime_type,''),
			        created_at, updated_at
			 FROM documents WHERE agent_discord_id = $1
			 ORDER BY created_at DESC`, agentDiscordID)
	} else {
		rows, err = d.pool.QueryContext(ctx,
			`SELECT id::TEXT, COALESCE(org_id::TEXT,''), COALESCE(agent_discord_id,''),
			        COALESCE(uploaded_by::TEXT,''), filename, file_url,
			        COALESCE(category,'general'), COALESCE(file_size,0), COALESCE(mime_type,''),
			        created_at, updated_at
			 FROM documents ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, fmt.Errorf("db: list documents: %w", err)
	}
	defer rows.Close()

	var result []Document
	for rows.Next() {
		var doc Document
		if err := rows.Scan(
			&doc.ID, &doc.OrgID, &doc.AgentDiscordID,
			&doc.UploadedBy, &doc.Filename, &doc.FileURL,
			&doc.Category, &doc.FileSize, &doc.MimeType,
			&doc.CreatedAt, &doc.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("db: scan document: %w", err)
		}
		result = append(result, doc)
	}
	return result, rows.Err()
}

// DeleteDocument deletes a document by ID.
func (d *DB) DeleteDocument(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM documents WHERE id = $1::UUID`, id)
	if err != nil {
		return fmt.Errorf("db: delete document: %w", err)
	}
	return nil
}
