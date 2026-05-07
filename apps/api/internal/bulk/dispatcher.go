package bulk

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

// ErrTooManyIDs is returned when len(ids) exceeds MaxIDsPerBulk. Handlers
// map this to HTTP 413.
var ErrTooManyIDs = errors.New("bulk: too many ids")

// Dispatcher owns a Registry and a *sql.DB; handlers call Dispatch.
type Dispatcher struct {
	reg *Registry
	db  *sql.DB
}

// NewDispatcher returns a Dispatcher backed by the given registry and DB.
func NewDispatcher(reg *Registry, db *sql.DB) *Dispatcher {
	return &Dispatcher{reg: reg, db: db}
}

// Dispatch validates the id-count cap and payload, opens a tx, invokes the
// action, and commits/rolls back atomically. Returns a Report that captures
// partial progress on failure (422 at the handler).
//
// Stub — tx handling + event publishing land with the first concrete action.
func (d *Dispatcher) Dispatch(
	ctx context.Context,
	actionName string,
	ids []string,
	payload json.RawMessage,
	actor Actor,
) (Report, error) {
	if len(ids) > MaxIDsPerBulk {
		return Report{}, ErrTooManyIDs
	}

	action, err := d.reg.Get(actionName)
	if err != nil {
		return Report{}, err
	}
	if err := action.Validate(payload); err != nil {
		return Report{}, fmt.Errorf("bulk: validate %s: %w", actionName, err)
	}

	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return Report{}, fmt.Errorf("bulk: begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck // rollback is best-effort after commit

	report, err := action.Apply(ctx, tx, ids, payload, actor)
	if err != nil {
		return report, err
	}

	if err := tx.Commit(); err != nil {
		return report, fmt.Errorf("bulk: commit: %w", err)
	}
	return report, nil
}
