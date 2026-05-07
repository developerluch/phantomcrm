package repo

import (
	"context"
	"errors"
)

// ErrNotFound is returned by Get when the row does not exist OR when it
// exists but is not visible to the ActorScope. Handlers map to 404 — never
// reveal the existence of a row the caller cannot see.
var ErrNotFound = errors.New("repo: not found")

// ErrScoped is returned by Update/Archive/Restore when the row exists but
// the ActorScope cannot mutate it. Handlers map to 403.
var ErrScoped = errors.New("repo: not authorised for this row")

// ErrTooManyAffected is returned by DispatchBulk when the filter would touch
// more than MaxBulkAffected rows. Handlers map to 413.
var ErrTooManyAffected = errors.New("repo: too many rows affected")

// ErrInvalidPayload is returned when a bulk-action payload fails validation
// (missing required key, enum out of range, wrong type). Handlers map to 400.
var ErrInvalidPayload = errors.New("repo: invalid bulk payload")

// Repository is the generic CRUD + Bulk contract. Entity-specific operations
// (merge, convert, promote) live on dedicated services, NOT here — adding
// per-entity methods to Repository breaks LSP because noop impls would be
// required on unrelated entities.
type Repository[T Entity] interface {
	Get(ctx context.Context, id string, scope ActorScope) (T, error)
	List(ctx context.Context, q ListQuery) (Page[T], error)
	Create(ctx context.Context, t T) (T, error)
	Update(ctx context.Context, id string, patch map[string]any, scope ActorScope) (T, error)
	Archive(ctx context.Context, ids []string, scope ActorScope) (int, error)
	Restore(ctx context.Context, ids []string, scope ActorScope) (int, error)
	Bulk(ctx context.Context, op BulkOp, ids []string, payload any, scope ActorScope) (BulkResult, error)
}
