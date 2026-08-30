package repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

// MaxBulkAffected is the hard cap on rows a single bulk op may touch. The
// dispatcher counts the filter match up front and returns ErrTooManyAffected
// (→ 413) rather than silently truncating.
const MaxBulkAffected = 500

// BulkActionKind identifies the mutation a bulk request wants to apply.
// The set is closed; unknown kinds are rejected with ErrInvalidPayload.
type BulkActionKind string

const (
	BulkSetLifecycle BulkActionKind = "setLifecycle"
	BulkSetOwner     BulkActionKind = "setOwner"
	BulkSetDNC       BulkActionKind = "setDNC"
	BulkArchive      BulkActionKind = "archive"
	BulkRestore      BulkActionKind = "restore"
	BulkAddTag       BulkActionKind = "addTag"
	BulkRemoveTag    BulkActionKind = "removeTag"
)

// validLifecycleStages enumerates the accepted values for setLifecycle. A
// bulk request passing anything else is rejected BEFORE any SQL runs — even
// though the value would be bound as a parameter, we want a fast 400 rather
// than "success with nonsense stored".
var validLifecycleStages = map[string]struct{}{
	"lead": {}, "prospect": {}, "customer": {}, "agent": {}, "churned": {},
}

// BulkRequest is the normalised bulk payload. Handlers construct one from
// the HTTP body and pass it to DispatchBulk. The dispatcher enforces scope,
// applies the cap, and runs the mutation.
type BulkRequest struct {
	Action  BulkActionKind
	Filter  filters.FilterNode
	Payload map[string]any
	Scope   ActorScope
}

// DispatchBulk is the single entry point for all contact bulk mutations.
// It is set-based (one SQL round trip per action) rather than per-id loops,
// which eliminates the id-in-request DoS surface and keeps correctness
// bound to the scoped BuildWhere predicate.
//
// Return: number of rows actually mutated. Zero on empty match or no-op.
func DispatchBulk(ctx context.Context, pool *sql.DB, req BulkRequest) (int, error) {
	if req.Filter == nil {
		return 0, fmt.Errorf("%w: filter is required", ErrInvalidPayload)
	}

	// Scope + filter become the WHERE clause used by both the count and the
	// mutation. Soft-delete semantics: archive must match non-archived rows;
	// restore must match archived rows; everything else excludes archived.
	includeArchived := req.Action == BulkRestore
	where, args, joins, err := BuildWhere(Contact{}, req.Filter, req.Scope, includeArchived)
	if err != nil {
		return 0, err
	}

	total, err := countMatches(ctx, pool, where, joins, args)
	if err != nil {
		return 0, fmt.Errorf("bulk: count: %w", err)
	}
	if total > MaxBulkAffected {
		return 0, fmt.Errorf("%w: %d matched, cap is %d", ErrTooManyAffected, total, MaxBulkAffected)
	}
	if total == 0 {
		return 0, nil
	}

	switch req.Action {
	case BulkSetLifecycle:
		return bulkSetColumn(ctx, pool, where, joins, args, "lifecycle_stage", req.Payload, validateLifecycle)
	case BulkSetOwner:
		return bulkSetColumn(ctx, pool, where, joins, args, "owner_agent_id", req.Payload, validateOwner)
	case BulkSetDNC:
		return bulkSetDNC(ctx, pool, where, joins, args, req.Payload)
	case BulkArchive:
		return bulkSetStatus(ctx, pool, where, joins, args, "archived")
	case BulkRestore:
		return bulkSetStatus(ctx, pool, where, joins, args, "active")
	case BulkAddTag:
		return bulkAddTag(ctx, pool, where, joins, args, req.Payload)
	case BulkRemoveTag:
		return bulkRemoveTag(ctx, pool, where, joins, args, req.Payload)
	}
	return 0, fmt.Errorf("%w: unknown action %q", ErrInvalidPayload, req.Action)
}

// ─── Count + helpers ────────────────────────────────────────────────────

func countMatches(ctx context.Context, pool *sql.DB, where string, joins []string, args []any) (int, error) {
	q := "SELECT COUNT(*) FROM contacts " + strings.Join(joins, " ") + " " + where
	var n int
	err := pool.QueryRowContext(ctx, q, args...).Scan(&n)
	return n, err
}

// joinFrom renders "FROM contacts <joins>" — factored out because bulk
// actions use the same prefix with different action clauses.
func joinFrom(joins []string) string {
	return "FROM contacts " + strings.Join(joins, " ")
}

// ─── Column set actions ─────────────────────────────────────────────────

type payloadValidator func(payload map[string]any) (string, error)

func validateLifecycle(payload map[string]any) (string, error) {
	raw, ok := payload["lifecycleStage"]
	if !ok {
		return "", fmt.Errorf("%w: lifecycleStage required", ErrInvalidPayload)
	}
	s, ok := raw.(string)
	if !ok {
		return "", fmt.Errorf("%w: lifecycleStage must be a string", ErrInvalidPayload)
	}
	if _, ok := validLifecycleStages[s]; !ok {
		return "", fmt.Errorf("%w: lifecycleStage %q is not a valid stage", ErrInvalidPayload, s)
	}
	return s, nil
}

func validateOwner(payload map[string]any) (string, error) {
	raw, ok := payload["ownerAgentDiscordId"]
	if !ok {
		return "", fmt.Errorf("%w: ownerAgentDiscordId required", ErrInvalidPayload)
	}
	s, ok := raw.(string)
	if !ok || s == "" {
		return "", fmt.Errorf("%w: ownerAgentDiscordId must be a non-empty string", ErrInvalidPayload)
	}
	return s, nil
}

// bulkSetColumn updates a single column to the validated payload value on
// every row matched by (where, args, joins). Returns the number of rows
// actually updated.
func bulkSetColumn(
	ctx context.Context, pool *sql.DB,
	where string, joins []string, args []any,
	col string, payload map[string]any,
	validate payloadValidator,
) (int, error) {
	val, err := validate(payload)
	if err != nil {
		return 0, err
	}
	// $N comes after the existing filter/scope args.
	n := len(args) + 1
	q := fmt.Sprintf(`
		UPDATE contacts SET %s = $%d, updated_at = NOW()
		WHERE id IN (SELECT contacts.id %s %s)`,
		col, n, joinFrom(joins), where)
	args = append(args, val)
	res, err := pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk: set %s: %w", col, err)
	}
	aff, _ := res.RowsAffected()
	return int(aff), nil
}

func bulkSetStatus(
	ctx context.Context, pool *sql.DB,
	where string, joins []string, args []any,
	newStatus string,
) (int, error) {
	n := len(args) + 1
	q := fmt.Sprintf(`
		UPDATE contacts SET status = $%d, updated_at = NOW()
		WHERE id IN (SELECT contacts.id %s %s) AND status <> $%d`,
		n, joinFrom(joins), where, n)
	args = append(args, newStatus)
	res, err := pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk: set status: %w", err)
	}
	aff, _ := res.RowsAffected()
	return int(aff), nil
}

// bulkSetDNC accepts any subset of {doNotSms, doNotEmail, doNotCall} and
// updates exactly those flags on matched rows.
func bulkSetDNC(
	ctx context.Context, pool *sql.DB,
	where string, joins []string, args []any,
	payload map[string]any,
) (int, error) {
	setParts := make([]string, 0, 3)
	n := len(args) + 1
	for key, col := range map[string]string{
		"doNotSms": "do_not_sms", "doNotEmail": "do_not_email", "doNotCall": "do_not_call",
	} {
		if raw, ok := payload[key]; ok {
			b, ok := raw.(bool)
			if !ok {
				return 0, fmt.Errorf("%w: %s must be a bool", ErrInvalidPayload, key)
			}
			setParts = append(setParts, fmt.Sprintf("%s = $%d", col, n))
			args = append(args, b)
			n++
		}
	}
	if len(setParts) == 0 {
		return 0, fmt.Errorf("%w: at least one of doNotSms/doNotEmail/doNotCall required", ErrInvalidPayload)
	}
	setParts = append(setParts, "updated_at = NOW()")
	q := fmt.Sprintf(`
		UPDATE contacts SET %s
		WHERE id IN (SELECT contacts.id %s %s)`,
		strings.Join(setParts, ", "), joinFrom(joins), where)
	res, err := pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk: set dnc: %w", err)
	}
	aff, _ := res.RowsAffected()
	return int(aff), nil
}

// ─── Tag actions ────────────────────────────────────────────────────────

func validateTag(payload map[string]any) (string, error) {
	raw, ok := payload["tag"]
	if !ok {
		return "", fmt.Errorf("%w: tag required", ErrInvalidPayload)
	}
	s, ok := raw.(string)
	if !ok || strings.TrimSpace(s) == "" {
		return "", fmt.Errorf("%w: tag must be a non-empty string", ErrInvalidPayload)
	}
	if len(s) > 64 {
		return "", fmt.Errorf("%w: tag too long (max 64 chars)", ErrInvalidPayload)
	}
	return strings.TrimSpace(s), nil
}

func bulkAddTag(
	ctx context.Context, pool *sql.DB,
	where string, joins []string, args []any,
	payload map[string]any,
) (int, error) {
	tag, err := validateTag(payload)
	if err != nil {
		return 0, err
	}
	n := len(args) + 1
	q := fmt.Sprintf(`
		INSERT INTO contact_tags (contact_id, tag)
		SELECT contacts.id, $%d %s %s
		ON CONFLICT (contact_id, tag) DO NOTHING`,
		n, joinFrom(joins), where)
	args = append(args, tag)
	res, err := pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk: add tag: %w", err)
	}
	aff, _ := res.RowsAffected()
	return int(aff), nil
}

func bulkRemoveTag(
	ctx context.Context, pool *sql.DB,
	where string, joins []string, args []any,
	payload map[string]any,
) (int, error) {
	tag, err := validateTag(payload)
	if err != nil {
		return 0, err
	}
	n := len(args) + 1
	q := fmt.Sprintf(`
		DELETE FROM contact_tags
		WHERE contact_id IN (SELECT contacts.id %s %s)
		AND tag = $%d`,
		joinFrom(joins), where, n)
	args = append(args, tag)
	res, err := pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk: remove tag: %w", err)
	}
	aff, _ := res.RowsAffected()
	return int(aff), nil
}

// Compile-time assertion: unknown actions must be caught by the switch.
var _ = BulkActionKind("")

// Ensure errors package imported for sentinel wraps above.
var _ = errors.New
