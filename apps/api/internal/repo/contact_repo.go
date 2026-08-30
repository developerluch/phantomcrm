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

// Contact is the supertype row as surfaced by Repository[Contact]. The shape
// mirrors db.Contact but lives here so the repo package depends only on
// filters, never on db. Handlers serialise this struct directly.
type Contact struct {
	ID                        string         `json:"id"`
	SourceType                string         `json:"sourceType"`
	SourceID                  *string        `json:"sourceId,omitempty"`
	OwnerAgentDiscordID       *string        `json:"ownerAgentDiscordId,omitempty"`
	FirstName                 *string        `json:"firstName,omitempty"`
	LastName                  *string        `json:"lastName,omitempty"`
	FullName                  string         `json:"fullName"`
	Email                     *string        `json:"email,omitempty"`
	Phone                     *string        `json:"phone,omitempty"`
	PhoneNormalized           *string        `json:"phoneNormalized,omitempty"`
	DOB                       *string        `json:"dob,omitempty"`
	LifecycleStage            string         `json:"lifecycleStage"`
	Status                    string         `json:"status"`
	DoNotSMS                  bool           `json:"doNotSms"`
	DoNotEmail                bool           `json:"doNotEmail"`
	DoNotCall                 bool           `json:"doNotCall"`
	CustomFields              map[string]any `json:"customFields"`
	SharedWithAgentDiscordIDs []string       `json:"sharedWithAgentDiscordIds"`
	Tags                      []string       `json:"tags"`
	CreatedAt                 time.Time      `json:"createdAt"`
	UpdatedAt                 time.Time      `json:"updatedAt"`
	LastActivityAt            *time.Time     `json:"lastActivityAt,omitempty"`
}

// ─── Entity metadata (value-receiver methods make any Contact value carry
//
//	its own metadata, which is what Repository[Contact] needs). ──
func (Contact) TableName() string                    { return "contacts" }
func (Contact) PrimaryKey() string                   { return "id" }
func (Contact) SoftDeleteColumn() (string, string)   { return "status", "archived" }
func (Contact) OwnerColumn() string                  { return "owner_agent_id" }
func (Contact) SharedColumn() string                 { return "shared_with_agent_discord_ids" }
func (Contact) FieldRegistry() filters.FieldRegistry { return filters.ContactsRegistry() }

// ContactRepo is the concrete Repository[Contact] implementation. Bulk lands
// in slice 3 once the bulk dispatcher has real actions wired into it.
type ContactRepo struct {
	pool *sql.DB
}

// NewContactRepo binds a repo to a connection pool.
func NewContactRepo(pool *sql.DB) *ContactRepo {
	return &ContactRepo{pool: pool}
}

// contactColumns is the canonical column list for every SELECT. Order must
// match scanContact.
const contactColumns = `contacts.id, contacts.source_type, contacts.source_id,
	contacts.owner_agent_id, contacts.first_name, contacts.last_name, contacts.full_name,
	contacts.email, contacts.phone, contacts.phone_normalized, contacts.dob,
	contacts.lifecycle_stage, contacts.status,
	contacts.do_not_sms, contacts.do_not_email, contacts.do_not_call,
	contacts.custom_fields, contacts.shared_with_agent_discord_ids,
	contacts.created_at, contacts.updated_at, contacts.last_activity_at`

// scanner matches both *sql.Row and *sql.Rows.
type scanner interface {
	Scan(dest ...any) error
}

func scanContact(s scanner) (Contact, error) {
	var (
		c            Contact
		sourceID     sql.NullString
		ownerAgent   sql.NullString
		firstName    sql.NullString
		lastName     sql.NullString
		email        sql.NullString
		phone        sql.NullString
		phoneNorm    sql.NullString
		dob          sql.NullString
		customFields []byte
		shared       pq.StringArray
		lastAct      sql.NullTime
	)
	if err := s.Scan(
		&c.ID, &c.SourceType, &sourceID,
		&ownerAgent, &firstName, &lastName, &c.FullName,
		&email, &phone, &phoneNorm, &dob,
		&c.LifecycleStage, &c.Status,
		&c.DoNotSMS, &c.DoNotEmail, &c.DoNotCall,
		&customFields, &shared,
		&c.CreatedAt, &c.UpdatedAt, &lastAct,
	); err != nil {
		return Contact{}, err
	}
	if sourceID.Valid {
		c.SourceID = &sourceID.String
	}
	if ownerAgent.Valid {
		c.OwnerAgentDiscordID = &ownerAgent.String
	}
	if firstName.Valid {
		c.FirstName = &firstName.String
	}
	if lastName.Valid {
		c.LastName = &lastName.String
	}
	if email.Valid {
		c.Email = &email.String
	}
	if phone.Valid {
		c.Phone = &phone.String
	}
	if phoneNorm.Valid {
		c.PhoneNormalized = &phoneNorm.String
	}
	if dob.Valid {
		c.DOB = &dob.String
	}
	if lastAct.Valid {
		c.LastActivityAt = &lastAct.Time
	}
	c.SharedWithAgentDiscordIDs = []string(shared)
	c.CustomFields = map[string]any{}
	if len(customFields) > 0 {
		_ = json.Unmarshal(customFields, &c.CustomFields)
	}
	return c, nil
}

// Get returns a single contact visible to the scope, or ErrNotFound. Archived
// rows ARE returned to the actor who archived them — otherwise the
// contact-detail drawer would 404 immediately after a soft-delete. Admin
// bypass still applies.
func (r *ContactRepo) Get(ctx context.Context, id string, scope ActorScope) (Contact, error) {
	filt := &filters.Rule{Field: "id", Op: string(filters.OpEq), Value: id}
	where, args, joins, err := BuildWhere(Contact{}, filt, scope, true /* include archived */)
	if err != nil {
		return Contact{}, err
	}
	query := "SELECT " + contactColumns + " FROM contacts " + strings.Join(joins, " ") + " " + where
	row := r.pool.QueryRowContext(ctx, query, args...)
	c, err := scanContact(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Contact{}, ErrNotFound
	}
	if err != nil {
		return Contact{}, fmt.Errorf("contacts: get: %w", err)
	}
	tags, err := loadContactTags(ctx, r.pool, c.ID)
	if err != nil {
		return Contact{}, fmt.Errorf("contacts: load tags: %w", err)
	}
	c.Tags = tags
	return c, nil
}

// List returns a visibility-scoped page. Sort fields must be in the
// FieldRegistry; pagination is cursor-based on the primary key + updated_at
// tiebreaker for determinism.
func (r *ContactRepo) List(ctx context.Context, q ListQuery) (Page[Contact], error) {
	where, args, joins, err := BuildWhere(Contact{}, q.Filter, q.Scope, false)
	if err != nil {
		return Page[Contact]{}, err
	}

	orderBy := "ORDER BY contacts.updated_at DESC, contacts.id DESC"
	if len(q.Sort) > 0 {
		reg := Contact{}.FieldRegistry()
		clauses := make([]string, 0, len(q.Sort)+1)
		for _, s := range q.Sort {
			spec, err := reg.Resolve(Contact{}.TableName(), s.Field)
			if err != nil {
				return Page[Contact]{}, err
			}
			dir := "ASC"
			if strings.EqualFold(s.Dir, "desc") {
				dir = "DESC"
			}
			clauses = append(clauses, spec.Column+" "+dir)
		}
		clauses = append(clauses, "contacts.id DESC")
		orderBy = "ORDER BY " + strings.Join(clauses, ", ")
	}

	limit := q.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := "SELECT " + contactColumns + " FROM contacts " +
		strings.Join(joins, " ") + " " + where + " " + orderBy +
		fmt.Sprintf(" LIMIT %d", limit+1)

	rows, err := r.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return Page[Contact]{}, fmt.Errorf("contacts: list: %w", err)
	}
	defer rows.Close()

	items := make([]Contact, 0, limit)
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return Page[Contact]{}, fmt.Errorf("contacts: scan: %w", err)
		}
		items = append(items, c)
	}
	if err := rows.Err(); err != nil {
		return Page[Contact]{}, err
	}

	page := Page[Contact]{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		page.NextCursor = items[limit-1].ID
	}
	return page, nil
}

// Create inserts a contact. Caller may pre-set the ID (ULID); blank IDs are
// generated here. Defaults applied: lifecycle=lead, status=active,
// sourceType=manual. Create does NOT enforce scope — handlers call this
// only after they've decided the actor may create on the entity.
func (r *ContactRepo) Create(ctx context.Context, c Contact) (Contact, error) {
	if c.ID == "" {
		c.ID = ulid.Make().String()
	}
	if c.LifecycleStage == "" {
		c.LifecycleStage = "lead"
	}
	if c.Status == "" {
		c.Status = "active"
	}
	if c.SourceType == "" {
		c.SourceType = "manual"
	}
	if c.CustomFields == nil {
		c.CustomFields = map[string]any{}
	}
	if c.FullName == "" {
		c.FullName = strings.TrimSpace(deref(c.FirstName) + " " + deref(c.LastName))
	}
	customJSON, err := json.Marshal(c.CustomFields)
	if err != nil {
		return Contact{}, fmt.Errorf("contacts: marshal custom: %w", err)
	}

	const q = `INSERT INTO contacts (
		id, source_type, source_id, owner_agent_id,
		first_name, last_name, full_name,
		email, phone, phone_normalized, dob,
		lifecycle_stage, status,
		do_not_sms, do_not_email, do_not_call,
		custom_fields, shared_with_agent_discord_ids
	) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
	RETURNING created_at, updated_at`
	err = r.pool.QueryRowContext(ctx, q,
		c.ID, c.SourceType, c.SourceID, c.OwnerAgentDiscordID,
		c.FirstName, c.LastName, c.FullName,
		c.Email, c.Phone, c.PhoneNormalized, c.DOB,
		c.LifecycleStage, c.Status,
		c.DoNotSMS, c.DoNotEmail, c.DoNotCall,
		customJSON, pq.Array(c.SharedWithAgentDiscordIDs),
	).Scan(&c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return Contact{}, fmt.Errorf("contacts: insert: %w", err)
	}
	return c, nil
}

// updatableColumns is the whitelist of columns Update may touch. Nothing
// outside this set can be patched — id/source_type/source_id/created_at are
// immutable; owner flip-flop goes through a dedicated bulk action; tags go
// through the tag repo; shared_with is a dedicated bulk action too.
var updatableColumns = map[string]string{
	"firstName":           "first_name",
	"lastName":            "last_name",
	"fullName":            "full_name",
	"email":               "email",
	"phone":               "phone",
	"phoneNormalized":     "phone_normalized",
	"dob":                 "dob",
	"lifecycleStage":      "lifecycle_stage",
	"status":              "status",
	"doNotSms":            "do_not_sms",
	"doNotEmail":          "do_not_email",
	"doNotCall":           "do_not_call",
	"customFields":        "custom_fields",
	"ownerAgentDiscordId": "owner_agent_id",
	"lastActivityAt":      "last_activity_at",
}

// Update patches a visible contact. Keys not in updatableColumns are rejected.
// Returns ErrNotFound when the target row exists but is not visible
// (indistinguishable by design — never leak row existence).
func (r *ContactRepo) Update(ctx context.Context, id string, patch map[string]any, scope ActorScope) (Contact, error) {
	if len(patch) == 0 {
		return r.Get(ctx, id, scope)
	}

	setParts := make([]string, 0, len(patch))
	args := make([]any, 0, len(patch)+3)
	i := 1
	for k, v := range patch {
		col, ok := updatableColumns[k]
		if !ok {
			return Contact{}, fmt.Errorf("contacts: column %q is not patchable", k)
		}
		if col == "custom_fields" {
			b, err := json.Marshal(v)
			if err != nil {
				return Contact{}, fmt.Errorf("contacts: marshal custom_fields: %w", err)
			}
			v = b
		}
		setParts = append(setParts, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, v)
		i++
	}
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now())
	i++

	// Tail: id match + visibility predicate.
	args = append(args, id)
	idPlaceholder := fmt.Sprintf("$%d", i)
	i++

	visSQL, visArgs := visibilityTail(Contact{}, scope, i)
	args = append(args, visArgs...)

	q := fmt.Sprintf(`UPDATE contacts SET %s WHERE id = %s%s
		RETURNING %s`,
		strings.Join(setParts, ", "),
		idPlaceholder,
		visSQL,
		contactColumns,
	)
	row := r.pool.QueryRowContext(ctx, q, args...)
	c, err := scanContact(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Contact{}, ErrNotFound
	}
	if err != nil {
		return Contact{}, fmt.Errorf("contacts: update: %w", err)
	}
	return c, nil
}

// Archive soft-deletes the given visible ids (status='archived'). Returns the
// number of rows actually archived — rows already archived or invisible to
// the scope are counted as zero.
func (r *ContactRepo) Archive(ctx context.Context, ids []string, scope ActorScope) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	visSQL, visArgs := visibilityTail(Contact{}, scope, 2)
	q := fmt.Sprintf(`UPDATE contacts SET status = 'archived', updated_at = NOW()
		WHERE id = ANY($1) AND status <> 'archived'%s`, visSQL)
	args := append([]any{pq.Array(ids)}, visArgs...)
	res, err := r.pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("contacts: archive: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// Restore is admin-only (handler enforces). Reverts 'archived' back to
// 'active'. Passing a non-archived id is a no-op.
func (r *ContactRepo) Restore(ctx context.Context, ids []string, scope ActorScope) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	visSQL, visArgs := visibilityTail(Contact{}, scope, 2)
	q := fmt.Sprintf(`UPDATE contacts SET status = 'active', updated_at = NOW()
		WHERE id = ANY($1) AND status = 'archived'%s`, visSQL)
	args := append([]any{pq.Array(ids)}, visArgs...)
	res, err := r.pool.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("contacts: restore: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// Bulk is a thin delegation to DispatchBulk. Kept on the repo so callers who
// already hold a *ContactRepo can stay in one dependency rather than reach
// into the package-level function directly.
func (r *ContactRepo) Bulk(ctx context.Context, req BulkRequest) (int, error) {
	return DispatchBulk(ctx, r.pool, req)
}

// loadContactTags reads tags for a single contact. Kept as a helper on the
// pool (not the tx) so Get can compose it without opening a transaction.
func loadContactTags(ctx context.Context, pool *sql.DB, contactID string) ([]string, error) {
	rows, err := pool.QueryContext(ctx,
		`SELECT tag FROM contact_tags WHERE contact_id = $1 ORDER BY tag`, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// visibilityTail returns an " AND (...)" fragment and args for the actor
// scope, or ("", nil) for admins. Numbering starts at startArg so the caller
// can append directly to an already-parameterised UPDATE/DELETE.
func visibilityTail(e Entity, scope ActorScope, startArg int) (string, []any) {
	if scope.IsAdmin {
		return "", nil
	}
	ownerCol := e.OwnerColumn()
	if ownerCol == "" {
		return "", nil
	}
	actor := fmt.Sprintf("$%d", startArg)
	parts := []string{fmt.Sprintf("%s = %s", ownerCol, actor)}
	if shared := e.SharedColumn(); shared != "" {
		parts = append(parts, fmt.Sprintf("%s = ANY(%s)", actor, shared))
	}
	return " AND (" + strings.Join(parts, " OR ") + ")", []any{scope.ActorDiscordID}
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
