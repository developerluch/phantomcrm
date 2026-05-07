// Package bulk provides the polymorphic BulkAction dispatcher. Registering
// new actions (e.g. M2's SendMessageAction, M5's EnrollInCampaignAction)
// NEVER requires editing the dispatcher — only a Register call at init.
package bulk

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sync"
)

// MaxIDsPerBulk is the hard cap on how many IDs a single bulk op may touch.
// Requests exceeding this return 413 at the handler.
const MaxIDsPerBulk = 500

// Actor is the authenticated caller context passed into BulkAction.Apply.
type Actor struct {
	AgentDiscordID string
	UserID         string
	IsAdmin        bool
}

// SkipReason explains why a single ID was skipped during a bulk op (row not
// visible to actor, invalid state, etc.) without aborting the whole batch.
type SkipReason struct {
	ID     string
	Reason string
}

// Report is the outcome of BulkAction.Apply across all supplied IDs.
type Report struct {
	Affected int
	Skipped  []SkipReason
	Errors   []string
}

// BulkAction is the plug-in interface every registered bulk operation
// implements. Dispatcher never switches on action name except at lookup.
type BulkAction interface {
	// Name is the stable identifier clients pass in the `action` field of
	// POST /api/v1/crm/contacts/bulk.
	Name() string

	// Validate parses and checks the JSON payload without touching the DB.
	Validate(payload json.RawMessage) error

	// Apply executes the action within the provided tx. Emits one event per
	// affected row via the configured events.Publisher.
	Apply(ctx context.Context, tx *sql.Tx, ids []string, payload json.RawMessage, actor Actor) (Report, error)
}

// Registry is the lookup table from action name to implementation. Actions
// register themselves once at init time; the dispatcher reads from this map.
type Registry struct {
	mu      sync.RWMutex
	actions map[string]BulkAction
}

// NewRegistry returns an empty Registry.
func NewRegistry() *Registry {
	return &Registry{actions: map[string]BulkAction{}}
}

// Register adds a BulkAction to the registry. Returns an error if the name
// is already taken — two actions must never share a name.
func (r *Registry) Register(a BulkAction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.actions[a.Name()]; exists {
		return errors.New("bulk: action already registered: " + a.Name())
	}
	r.actions[a.Name()] = a
	return nil
}

// Get returns the BulkAction with the given name.
func (r *Registry) Get(name string) (BulkAction, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	a, ok := r.actions[name]
	if !ok {
		return nil, errors.New("bulk: unknown action: " + name)
	}
	return a, nil
}

// Names returns the sorted list of registered action names. Useful for
// error messages that list valid actions.
func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.actions))
	for n := range r.actions {
		out = append(out, n)
	}
	return out
}
