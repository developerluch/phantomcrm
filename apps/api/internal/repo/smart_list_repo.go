package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
	"github.com/oklog/ulid/v2"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

// SmartList is a persisted filter. Owner can edit/delete; agents in
// SharedWithAgentIDs can read and run the preview but not mutate.
type SmartList struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Description         *string   `json:"description,omitempty"`
	OwnerAgentDiscordID string    `json:"ownerAgentDiscordId"`
	SharedWithAgentIDs  []string  `json:"sharedWithAgentIds"`
	FilterJSON          []byte    `json:"filter"` // raw JSON; clients parse into their FilterNode
	IsPinned            bool      `json:"isPinned"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// ─── Entity metadata ────────────────────────────────────────────────────

func (SmartList) TableName() string                    { return "smart_lists" }
func (SmartList) PrimaryKey() string                   { return "id" }
func (SmartList) SoftDeleteColumn() (string, string)   { return "", "" } // hard delete
func (SmartList) OwnerColumn() string                  { return "owner_agent_discord_id" }
func (SmartList) SharedColumn() string                 { return "shared_with_agent_ids" }
func (SmartList) FieldRegistry() filters.FieldRegistry { return smartListRegistry() }

// smartListRegistry returns a tiny registry so BuildWhere can enforce
// visibility. Only the fields that BuildWhere itself reads are needed — no
// user-facing filter DSL runs against smart_lists.
func smartListRegistry() filters.FieldRegistry {
	r := filters.NewMapRegistry()
	r.Register("smart_lists",
		filters.FieldSpec{Name: "id", Column: "smart_lists.id", Type: filters.FieldText,
			AllowedOps: []filters.Op{filters.OpEq, filters.OpNeq, filters.OpIn, filters.OpNin}},
	)
	return r
}

// ─── Repo ───────────────────────────────────────────────────────────────

// SmartListRepo is the CRUD + pin surface for saved filters.
type SmartListRepo struct {
	pool *sql.DB
}

// NewSmartListRepo binds a repo to a connection pool.
func NewSmartListRepo(pool *sql.DB) *SmartListRepo {
	return &SmartListRepo{pool: pool}
}

const smartListColumns = `id, name, description, owner_agent_discord_id,
	shared_with_agent_ids, filter_json, is_pinned, created_at, updated_at`

// Create inserts a new smart list owned by scope.ActorDiscordID. Empty ID is
// auto-generated. FilterJSON must be valid JSON (caller validates shape).
func (r *SmartListRepo) Create(ctx context.Context, s SmartList, scope ActorScope) (SmartList, error) {
	if s.ID == "" {
		s.ID = ulid.Make().String()
	}
	if strings.TrimSpace(s.Name) == "" {
		return SmartList{}, fmt.Errorf("%w: name required", ErrInvalidPayload)
	}
	if len(s.FilterJSON) == 0 {
		return SmartList{}, fmt.Errorf("%w: filter required", ErrInvalidPayload)
	}
	if !json.Valid(s.FilterJSON) {
		return SmartList{}, fmt.Errorf("%w: filter is not valid JSON", ErrInvalidPayload)
	}
	// Owner is always the caller — prevents a non-admin crafting a payload
	// with someone else's discord id as owner.
	s.OwnerAgentDiscordID = scope.ActorDiscordID
	if s.SharedWithAgentIDs == nil {
		s.SharedWithAgentIDs = []string{}
	}
	const q = `INSERT INTO smart_lists (id, name, description, owner_agent_discord_id,
		shared_with_agent_ids, filter_json, is_pinned)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING created_at, updated_at`
	err := r.pool.QueryRowContext(ctx, q,
		s.ID, s.Name, s.Description, s.OwnerAgentDiscordID,
		pq.Array(s.SharedWithAgentIDs), s.FilterJSON, s.IsPinned,
	).Scan(&s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return SmartList{}, fmt.Errorf("smart_lists: insert: %w", err)
	}
	return s, nil
}

// Get returns a smart list visible to scope (owner or in shared_with_agent_ids),
// or ErrNotFound when invisible. Admins bypass visibility.
func (r *SmartListRepo) Get(ctx context.Context, id string, scope ActorScope) (SmartList, error) {
	visSQL, visArgs := visibilityTail(SmartList{}, scope, 2)
	q := fmt.Sprintf(`SELECT %s FROM smart_lists WHERE id = $1%s`, smartListColumns, visSQL)
	args := append([]any{id}, visArgs...)
	row := r.pool.QueryRowContext(ctx, q, args...)
	s, err := scanSmartList(row)
	if errors.Is(err, sql.ErrNoRows) {
		return SmartList{}, ErrNotFound
	}
	if err != nil {
		return SmartList{}, fmt.Errorf("smart_lists: get: %w", err)
	}
	return s, nil
}

// List returns every smart list visible to scope — rows the actor owns plus
// rows that include the actor in shared_with_agent_ids. Sorted newest first.
func (r *SmartListRepo) List(ctx context.Context, scope ActorScope) ([]SmartList, error) {
	visSQL, visArgs := visibilityTail(SmartList{}, scope, 1)
	// visibilityTail returns " AND (...)"; for a standalone WHERE we need
	// either WHERE <expr> or just TRUE for admins.
	where := "WHERE TRUE" + visSQL
	q := fmt.Sprintf(`SELECT %s FROM smart_lists %s ORDER BY is_pinned DESC, updated_at DESC`,
		smartListColumns, where)
	rows, err := r.pool.QueryContext(ctx, q, visArgs...)
	if err != nil {
		return nil, fmt.Errorf("smart_lists: list: %w", err)
	}
	defer rows.Close()
	out := []SmartList{}
	for rows.Next() {
		s, err := scanSmartList(rows)
		if err != nil {
			return nil, fmt.Errorf("smart_lists: scan: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// smartListUpdatable is the closed column whitelist for Update. Owner +
// filter + id + created_at are never patchable; ownership transfer or
// filter rewrite go through dedicated methods.
var smartListUpdatable = map[string]string{
	"name":               "name",
	"description":        "description",
	"sharedWithAgentIds": "shared_with_agent_ids",
	"isPinned":           "is_pinned",
	"filter":             "filter_json", // re-saving a filter is a common UX; treat as patchable
}

// Update patches a smart list. Only the owner (or an admin) can mutate —
// shared-with actors have read access but not write access.
func (r *SmartListRepo) Update(ctx context.Context, id string, patch map[string]any, scope ActorScope) (SmartList, error) {
	if len(patch) == 0 {
		return r.Get(ctx, id, scope)
	}
	setParts := make([]string, 0, len(patch))
	args := make([]any, 0, len(patch)+2)
	i := 1
	for k, v := range patch {
		col, ok := smartListUpdatable[k]
		if !ok {
			return SmartList{}, fmt.Errorf("smart_lists: column %q is not patchable", k)
		}
		switch col {
		case "filter_json":
			// Accept []byte, string, or JSON-marshalable; coerce to []byte.
			b, err := coerceJSONBytes(v)
			if err != nil {
				return SmartList{}, fmt.Errorf("%w: filter: %v", ErrInvalidPayload, err)
			}
			v = b
		case "shared_with_agent_ids":
			arr, err := coerceStringArray(v)
			if err != nil {
				return SmartList{}, fmt.Errorf("%w: sharedWithAgentIds: %v", ErrInvalidPayload, err)
			}
			v = pq.Array(arr)
		}
		setParts = append(setParts, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, v)
		i++
	}
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now())
	i++

	// WHERE: id match + owner-only (admins bypass via scope).
	args = append(args, id)
	idPh := fmt.Sprintf("$%d", i)
	i++

	whereTail := ""
	if !scope.IsAdmin {
		// Owner-only — shared_with grants read but not write.
		whereTail = fmt.Sprintf(" AND owner_agent_discord_id = $%d", i)
		args = append(args, scope.ActorDiscordID)
	}

	q := fmt.Sprintf(`UPDATE smart_lists SET %s WHERE id = %s%s
		RETURNING %s`, strings.Join(setParts, ", "), idPh, whereTail, smartListColumns)
	row := r.pool.QueryRowContext(ctx, q, args...)
	s, err := scanSmartList(row)
	if errors.Is(err, sql.ErrNoRows) {
		return SmartList{}, ErrNotFound
	}
	if err != nil {
		return SmartList{}, fmt.Errorf("smart_lists: update: %w", err)
	}
	return s, nil
}

// Delete removes a smart list. Owner-only (admins bypass). Silently succeeds
// with zero affected rows when the id is not visible — handlers map that to
// 404 via ErrNotFound.
func (r *SmartListRepo) Delete(ctx context.Context, id string, scope ActorScope) error {
	args := []any{id}
	where := "id = $1"
	if !scope.IsAdmin {
		where += " AND owner_agent_discord_id = $2"
		args = append(args, scope.ActorDiscordID)
	}
	res, err := r.pool.ExecContext(ctx, "DELETE FROM smart_lists WHERE "+where, args...)
	if err != nil {
		return fmt.Errorf("smart_lists: delete: %w", err)
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return ErrNotFound
	}
	return nil
}

// SetPinned toggles the is_pinned flag. Owner-only.
func (r *SmartListRepo) SetPinned(ctx context.Context, id string, pinned bool, scope ActorScope) error {
	_, err := r.Update(ctx, id, map[string]any{"isPinned": pinned}, scope)
	return err
}

// ─── Scanning ───────────────────────────────────────────────────────────

func scanSmartList(s scanner) (SmartList, error) {
	var (
		sl     SmartList
		desc   sql.NullString
		shared pq.StringArray
	)
	err := s.Scan(
		&sl.ID, &sl.Name, &desc, &sl.OwnerAgentDiscordID,
		&shared, &sl.FilterJSON, &sl.IsPinned,
		&sl.CreatedAt, &sl.UpdatedAt,
	)
	if err != nil {
		return SmartList{}, err
	}
	if desc.Valid {
		sl.Description = &desc.String
	}
	sl.SharedWithAgentIDs = []string(shared)
	return sl, nil
}

// ─── Coercion helpers ───────────────────────────────────────────────────

func coerceJSONBytes(v any) ([]byte, error) {
	switch x := v.(type) {
	case []byte:
		if !json.Valid(x) {
			return nil, errors.New("not valid JSON")
		}
		return x, nil
	case string:
		if !json.Valid([]byte(x)) {
			return nil, errors.New("not valid JSON")
		}
		return []byte(x), nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func coerceStringArray(v any) ([]string, error) {
	if arr, ok := v.([]string); ok {
		return arr, nil
	}
	if arr, ok := v.([]any); ok {
		out := make([]string, 0, len(arr))
		for _, e := range arr {
			s, ok := e.(string)
			if !ok {
				return nil, errors.New("array element is not a string")
			}
			out = append(out, s)
		}
		return out, nil
	}
	return nil, errors.New("not a string array")
}
