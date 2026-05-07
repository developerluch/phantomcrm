package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Event is the envelope for every domain event written to the append-only log.
// Callers populate Type (from catalog.go), OccurredAt (optional; defaults to now),
// ActorAgentID (optional — null for system events), ContactID (for contact-scoped
// events), SubjectType/SubjectID (the thing the event happened to), and Payload.
type Event struct {
	Type         string         `json:"type"`
	OccurredAt   time.Time      `json:"occurredAt"`
	ActorAgentID *string        `json:"actorAgentId,omitempty"`
	ContactID    *string        `json:"contactId,omitempty"`
	SubjectType  string         `json:"subjectType"`
	SubjectID    string         `json:"subjectId"`
	Payload      map[string]any `json:"payload"`
}

// Publisher persists an Event. Implementations must preserve LSP:
//   - Any Event whose Type is in KnownTypes MUST be persisted.
//   - Implementations MUST be safe to call multiple times for the same logical
//     state change (idempotency is achieved by the append-only design; replays
//     are expected for future automation replay).
//   - An implementation MAY reject an unknown Type.
//   - An implementation MUST NOT spawn goroutines for persistence; the caller
//     controls the transaction.
type Publisher interface {
	Publish(ctx context.Context, e Event) error
}

// Execer is the minimal SQL-exec surface needed by PgPublisher.
// Both *sql.DB and *sql.Tx satisfy this, so a caller can pass a transaction
// to publish in-tx, or a DB handle for out-of-tx publish.
type Execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// PgPublisher writes events to the Postgres `events` table.
type PgPublisher struct {
	exec Execer
}

// NewPgPublisher returns a Publisher backed by the given Execer.
// Pass a *sql.DB for out-of-tx publishing, or a *sql.Tx from a caller's open
// transaction to publish in the same transaction as the state change.
func NewPgPublisher(exec Execer) *PgPublisher {
	return &PgPublisher{exec: exec}
}

// Publish persists the event.
//
// Validation:
//   - Type must be non-empty.
//   - Payload is serialized to JSON; nil is permitted (stored as '{}'::jsonb).
//
// The function does NOT enforce KnownTypes membership by default so that the
// CRM domain can extend the catalog without a migration. Consumers that want
// strictness can wrap this with a check against KnownTypes.
func (p *PgPublisher) Publish(ctx context.Context, e Event) error {
	if e.Type == "" {
		return fmt.Errorf("events: Event.Type is required")
	}
	if e.OccurredAt.IsZero() {
		e.OccurredAt = time.Now().UTC()
	}

	payloadBytes, err := json.Marshal(e.Payload)
	if err != nil {
		return fmt.Errorf("events: marshal payload: %w", err)
	}
	if len(payloadBytes) == 0 || string(payloadBytes) == "null" {
		payloadBytes = []byte("{}")
	}

	_, err = p.exec.ExecContext(ctx,
		`INSERT INTO events (type, occurred_at, actor_agent_id, contact_id, subject_type, subject_id, payload)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
		e.Type, e.OccurredAt, e.ActorAgentID, e.ContactID, e.SubjectType, e.SubjectID, string(payloadBytes),
	)
	if err != nil {
		return fmt.Errorf("events: insert: %w", err)
	}
	return nil
}

// Compile-time check that PgPublisher satisfies Publisher.
var _ Publisher = (*PgPublisher)(nil)
