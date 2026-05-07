package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
	"phantomcrm-api/internal/events"
)

// Contact is the supertype row for any person or business tracked in the CRM.
// LSP: every field is safe to read on any subtype-specific contact (recruit,
// sale_client, agent_lead, manual, import). Subtype-specific state lives in
// the corresponding contact_*_profile view, not here.
type Contact struct {
	ID             string         `json:"id"`
	SourceType     string         `json:"sourceType"`
	SourceID       *string        `json:"sourceId,omitempty"`
	OwnerAgentID   *string        `json:"ownerAgentId,omitempty"`
	FirstName      *string        `json:"firstName,omitempty"`
	LastName       *string        `json:"lastName,omitempty"`
	FullName       string         `json:"fullName"`
	Email          *string        `json:"email,omitempty"`
	Phone          *string        `json:"phone,omitempty"`
	PhoneNorm      *string        `json:"phoneNormalized,omitempty"`
	DOB            *string        `json:"dob,omitempty"`
	LifecycleStage string         `json:"lifecycleStage"`
	Status         string         `json:"status"`
	DoNotSMS       bool           `json:"doNotSms"`
	DoNotEmail     bool           `json:"doNotEmail"`
	DoNotCall      bool           `json:"doNotCall"`
	CustomFields   map[string]any `json:"customFields"`
	Tags           []string       `json:"tags"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	LastActivityAt *time.Time     `json:"lastActivityAt,omitempty"`
}

// ContactSubtype is the polymorphic supertype interface for any subtype profile
// (RecruitProfile, SaleProfile, AgentLeadProfile). Read-only in M0.
//
// LSP invariants that every implementation MUST preserve:
//   - ContactID() returns the non-empty ULID of the underlying contacts row.
//   - Kind() returns one of {"recruit","sale","agent_lead"}.
//   - SubtypeFields() returns a non-nil map. Fields that do not apply to the
//     subtype are omitted, not emitted with zero/nil values — the consumer
//     should not have to distinguish "not applicable" from "unknown."
//   - No method panics. Substitutability means any subtype plugs into a
//     function that accepts ContactSubtype without defensive checks.
type ContactSubtype interface {
	ContactID() string
	Kind() string
	SubtypeFields() map[string]any
}

// SourceRow is the input to UpsertContactFromSource: the subset of fields from
// a recruit/sale/agent_lead row that seeds or merges into the contact supertype.
// Empty strings are treated as "unknown" and MUST NOT overwrite a non-null
// value on an existing contact.
type SourceRow struct {
	Kind      string // "recruit" | "sale" | "agent_lead" | "manual" | "import"
	SourceID  string
	FirstName string
	LastName  string
	Email     string
	Phone     string

	// Optional — only applied on insert or as a first-write on update.
	OwnerAgentID   string
	LifecycleStage string
	DOB            string

	// Optional physical mailing address — if any line/city/state present on
	// insert, a primary address is synthesized in the addresses table.
	AddressLine1 string
	AddressLine2 string
	City         string
	State        string
	PostalCode   string
	Country      string
}

// normalizePhone strips everything except digits. An empty input returns "".
// The returned value is what we match on and store in phone_normalized.
func normalizePhone(in string) string {
	var b strings.Builder
	for _, r := range in {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func derefOr(p *string, fallback string) string {
	if p == nil {
		return fallback
	}
	return *p
}

func buildFullName(first, last string) string {
	return strings.TrimSpace(strings.TrimSpace(first) + " " + strings.TrimSpace(last))
}

// UpsertContactFromSource merges a source row into the contacts supertype.
//
// Match priority (first match wins):
//  1. phone_normalized (if non-empty on input)
//  2. lower(email)     (if non-empty on input)
//  3. (source_type, source_id)
//
// Merge semantics: a non-null field on the existing contact is never
// overwritten by a null/empty field on the incoming source. Use
// COALESCE(NULLIF($n, ''), column) for every mergeable column.
//
// On insert, emits contact.created. On update (with at least one changed
// column), emits contact.updated with a payload listing the changed fields.
//
// The function runs inside its own transaction so the contact write and the
// event write are atomic. Callers that want to run inside an existing
// transaction should use UpsertContactFromSourceTx.
func (d *DB) UpsertContactFromSource(ctx context.Context, src SourceRow) (string, error) {
	tx, err := d.pool.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("contacts: begin: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	id, err := d.UpsertContactFromSourceTx(ctx, tx, src)
	if err != nil {
		_ = tx.Rollback()
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("contacts: commit: %w", err)
	}
	return id, nil
}

// UpsertContactFromSourceTx is UpsertContactFromSource bound to an existing tx.
// The caller owns commit/rollback. The same merge and event semantics apply.
func (d *DB) UpsertContactFromSourceTx(ctx context.Context, tx *sql.Tx, src SourceRow) (string, error) {
	phoneNorm := normalizePhone(src.Phone)
	emailLower := strings.ToLower(strings.TrimSpace(src.Email))

	// Match priority: phone_normalized → lower(email) → (source_type, source_id)
	var existingID string
	found := false

	if phoneNorm != "" {
		err := tx.QueryRowContext(ctx,
			`SELECT id FROM contacts WHERE phone_normalized = $1 AND phone_normalized != '' LIMIT 1`,
			phoneNorm,
		).Scan(&existingID)
		if err == nil {
			found = true
		} else if err != sql.ErrNoRows {
			return "", fmt.Errorf("contacts: match phone: %w", err)
		}
	}
	if !found && emailLower != "" {
		err := tx.QueryRowContext(ctx,
			`SELECT id FROM contacts WHERE lower(email) = $1 AND email IS NOT NULL AND email != '' LIMIT 1`,
			emailLower,
		).Scan(&existingID)
		if err == nil {
			found = true
		} else if err != sql.ErrNoRows {
			return "", fmt.Errorf("contacts: match email: %w", err)
		}
	}
	if !found {
		err := tx.QueryRowContext(ctx,
			`SELECT id FROM contacts WHERE source_type = $1 AND source_id = $2 LIMIT 1`,
			src.Kind, src.SourceID,
		).Scan(&existingID)
		if err == nil {
			found = true
		} else if err != sql.ErrNoRows {
			return "", fmt.Errorf("contacts: match source: %w", err)
		}
	}

	pub := events.NewPgPublisher(tx)

	if !found {
		return d.insertContactTx(ctx, tx, pub, src, phoneNorm)
	}
	return existingID, d.updateContactTx(ctx, tx, pub, existingID, src, phoneNorm)
}

func (d *DB) insertContactTx(ctx context.Context, tx *sql.Tx, pub events.Publisher, src SourceRow, phoneNorm string) (string, error) {
	id := ulid.Make().String()
	lifecycle := src.LifecycleStage
	if lifecycle == "" {
		lifecycle = "lead"
	}
	fullName := buildFullName(src.FirstName, src.LastName)

	_, err := tx.ExecContext(ctx,
		`INSERT INTO contacts
		 (id, source_type, source_id, owner_agent_id, first_name, last_name, full_name,
		  email, phone, phone_normalized, dob, lifecycle_stage, status,
		  do_not_sms, do_not_email, do_not_call, custom_fields)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',false,false,false,'{}'::jsonb)`,
		id,
		src.Kind,
		nullIfEmpty(src.SourceID),
		nullIfEmpty(src.OwnerAgentID),
		nullIfEmpty(src.FirstName),
		nullIfEmpty(src.LastName),
		fullName,
		nullIfEmpty(src.Email),
		nullIfEmpty(src.Phone),
		nullIfEmpty(phoneNorm),
		nullIfEmpty(src.DOB),
		lifecycle,
	)
	if err != nil {
		return "", fmt.Errorf("contacts: insert: %w", err)
	}

	// Synthesize a primary address if the source provided any physical address
	// field. Failure here is logged but does not abort the contact write —
	// contact creation is the authoritative operation.
	if hasAddress(src) {
		if err := d.insertAddressFromSourceTx(ctx, tx, pub, id, src); err != nil {
			log.Printf("[contact_sync] synth address failed (contact=%s): %v", id, err)
		}
	}

	payload := map[string]any{
		"sourceType":     src.Kind,
		"sourceId":       src.SourceID,
		"firstName":      src.FirstName,
		"lastName":       src.LastName,
		"email":          src.Email,
		"phone":          src.Phone,
		"lifecycleStage": lifecycle,
	}
	if err := pub.Publish(ctx, events.Event{
		Type:        events.TypeContactCreated,
		ContactID:   &id,
		SubjectType: "contact",
		SubjectID:   id,
		Payload:     payload,
	}); err != nil {
		return "", fmt.Errorf("contacts: publish created: %w", err)
	}
	return id, nil
}

func (d *DB) updateContactTx(ctx context.Context, tx *sql.Tx, pub events.Publisher, existingID string, src SourceRow, phoneNorm string) error {
	// Load the before snapshot of the mergeable columns so we can compute the
	// diff for the contact.updated payload.
	var before Contact
	var firstName, lastName, email, phone, phoneNormCol sql.NullString
	err := tx.QueryRowContext(ctx,
		`SELECT first_name, last_name, email, phone, phone_normalized FROM contacts WHERE id = $1`,
		existingID,
	).Scan(&firstName, &lastName, &email, &phone, &phoneNormCol)
	if err != nil {
		return fmt.Errorf("contacts: load before: %w", err)
	}
	if firstName.Valid {
		before.FirstName = &firstName.String
	}
	if lastName.Valid {
		before.LastName = &lastName.String
	}
	if email.Valid {
		before.Email = &email.String
	}
	if phone.Valid {
		before.Phone = &phone.String
	}
	if phoneNormCol.Valid {
		before.PhoneNorm = &phoneNormCol.String
	}

	// Build COALESCE-merged UPDATE. Empty strings on the source are treated as
	// "unknown" and never overwrite a non-null existing value.
	_, err = tx.ExecContext(ctx,
		`UPDATE contacts SET
			first_name       = COALESCE(NULLIF($1, ''), first_name),
			last_name        = COALESCE(NULLIF($2, ''), last_name),
			email            = COALESCE(NULLIF($3, ''), email),
			phone            = COALESCE(NULLIF($4, ''), phone),
			phone_normalized = COALESCE(NULLIF($5, ''), phone_normalized),
			full_name        = NULLIF(TRIM(COALESCE($1, first_name, '') || ' ' || COALESCE($2, last_name, '')), ''),
			updated_at       = NOW()
		 WHERE id = $6`,
		src.FirstName, src.LastName, src.Email, src.Phone, phoneNorm, existingID,
	)
	if err != nil {
		return fmt.Errorf("contacts: update: %w", err)
	}

	// Compute changed fields for the diff payload.
	changes := map[string]any{}
	addChange := func(key, newVal string, old *string) {
		if newVal == "" {
			return
		}
		if old == nil || *old != newVal {
			changes[key] = map[string]any{"from": derefOr(old, ""), "to": newVal}
		}
	}
	addChange("firstName", src.FirstName, before.FirstName)
	addChange("lastName", src.LastName, before.LastName)
	addChange("email", src.Email, before.Email)
	addChange("phone", src.Phone, before.Phone)
	addChange("phoneNormalized", phoneNorm, before.PhoneNorm)

	if len(changes) == 0 {
		return nil
	}

	if err := pub.Publish(ctx, events.Event{
		Type:        events.TypeContactUpdated,
		ContactID:   &existingID,
		SubjectType: "contact",
		SubjectID:   existingID,
		Payload:     map[string]any{"changes": changes},
	}); err != nil {
		return fmt.Errorf("contacts: publish updated: %w", err)
	}
	return nil
}

func hasAddress(src SourceRow) bool {
	return src.AddressLine1 != "" || src.AddressLine2 != "" || src.City != "" || src.State != "" || src.PostalCode != ""
}

// SyncSourceToContactSafe upserts the contact from a source row and returns
// the resulting contact ID. Used by the admin backfill endpoint and tests
// where the caller wants the contact ID back without the contact_id column
// update (see crmSyncAfterCreate for the full post-commit flow used by
// Create*).
//
// MUST NOT fail the caller — any error is logged and ("", false) is returned.
// Uses context.Background() so request cancellation does not abort the sync.
func (d *DB) SyncSourceToContactSafe(src SourceRow) (string, bool) {
	defer func() {
		if p := recover(); p != nil {
			log.Printf("[contact_sync] recovered panic (kind=%s source=%s): %v", src.Kind, src.SourceID, p)
		}
	}()

	id, err := d.UpsertContactFromSource(context.Background(), src)
	if err != nil {
		log.Printf("[contact_sync] upsert failed (kind=%s source=%s): %v", src.Kind, src.SourceID, err)
		return "", false
	}
	return id, true
}

// crmSyncAfterCreate is the post-commit CRM hook called from CreateRecruit,
// CreateSale, CreateAgentLead. It:
//  1. Upserts a contact from the source row.
//  2. Updates the source table's contact_id column with the resulting ULID.
//
// sourceTable MUST be one of the whitelisted names below — never user input.
// Errors are logged; the function NEVER panics and NEVER fails the caller.
// Uses context.Background() so request cancellation does not abort the sync
// after the primary write has already committed.
func (d *DB) crmSyncAfterCreate(sourceTable, sourceID string, src SourceRow) {
	defer func() {
		if p := recover(); p != nil {
			log.Printf("[crm_sync] recovered panic (table=%s id=%s): %v", sourceTable, sourceID, p)
		}
	}()

	ctx := context.Background()

	contactID, err := d.UpsertContactFromSource(ctx, src)
	if err != nil {
		log.Printf("[crm_sync] upsert failed (table=%s id=%s): %v", sourceTable, sourceID, err)
		return
	}

	var q string
	switch sourceTable {
	case "recruits":
		q = `UPDATE recruits   SET contact_id = $1 WHERE id = $2::UUID`
	case "sales":
		q = `UPDATE sales      SET contact_id = $1 WHERE id = $2::UUID`
	case "agent_leads":
		q = `UPDATE agent_leads SET contact_id = $1 WHERE id = $2::UUID`
	default:
		log.Printf("[crm_sync] unknown source table: %s", sourceTable)
		return
	}

	if _, err := d.pool.ExecContext(ctx, q, contactID, sourceID); err != nil {
		log.Printf("[crm_sync] update contact_id failed (table=%s id=%s): %v", sourceTable, sourceID, err)
	}
}

// SplitClientName breaks "John Q Smith" into ("John", "Q Smith"). Used by
// Sale → Contact sync where the sales table stores a single client_name.
func SplitClientName(name string) (first, last string) {
	parts := strings.Fields(strings.TrimSpace(name))
	switch len(parts) {
	case 0:
		return "", ""
	case 1:
		return parts[0], ""
	default:
		return parts[0], strings.Join(parts[1:], " ")
	}
}

// GetContact is a minimal lookup used by backfill and the admin endpoint.
// Full CRUD lands in M1.
func (d *DB) GetContact(ctx context.Context, id string) (*Contact, error) {
	var c Contact
	var sourceID, ownerAgent, firstName, lastName, email, phone, phoneNorm, dob sql.NullString
	var lastActivity sql.NullTime
	var customFieldsBytes []byte

	err := d.pool.QueryRowContext(ctx,
		`SELECT id, source_type, source_id, owner_agent_id, first_name, last_name, full_name,
		        email, phone, phone_normalized, dob, lifecycle_stage, status,
		        do_not_sms, do_not_email, do_not_call, custom_fields,
		        created_at, updated_at, last_activity_at
		 FROM contacts WHERE id = $1`, id,
	).Scan(&c.ID, &c.SourceType, &sourceID, &ownerAgent, &firstName, &lastName, &c.FullName,
		&email, &phone, &phoneNorm, &dob, &c.LifecycleStage, &c.Status,
		&c.DoNotSMS, &c.DoNotEmail, &c.DoNotCall, &customFieldsBytes,
		&c.CreatedAt, &c.UpdatedAt, &lastActivity)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("contacts: get: %w", err)
	}

	if sourceID.Valid {
		c.SourceID = &sourceID.String
	}
	if ownerAgent.Valid {
		c.OwnerAgentID = &ownerAgent.String
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
		c.PhoneNorm = &phoneNorm.String
	}
	if dob.Valid {
		c.DOB = &dob.String
	}
	if lastActivity.Valid {
		c.LastActivityAt = &lastActivity.Time
	}
	if len(customFieldsBytes) > 0 {
		_ = json.Unmarshal(customFieldsBytes, &c.CustomFields)
	}
	if c.CustomFields == nil {
		c.CustomFields = map[string]any{}
	}

	return &c, nil
}
