package filters

import (
	"errors"
	"strings"
)

// FieldType is the declared data type of a filterable field. Combined with
// Op it determines whether a Rule is semantically valid and which SQL
// expression compile to.
type FieldType string

const (
	FieldText FieldType = "text"
	FieldInt  FieldType = "int"
	FieldDate FieldType = "date"
	FieldBool FieldType = "bool"
	FieldJSON FieldType = "jsonb"
	FieldArr  FieldType = "array"
)

// IndexKind is the database index required to serve a field's allowed ops.
// CI verifies presence of the underlying index when RequiresIndex != "".
type IndexKind string

const (
	IndexNone    IndexKind = ""
	IndexBTree   IndexKind = "btree"
	IndexGIN     IndexKind = "gin"
	IndexTrigram IndexKind = "trigram"
)

// FieldSpec describes a single filterable field.
type FieldSpec struct {
	// Name is the client-facing field identifier, e.g. "firstName" or
	// "recruit.courseProgress".
	Name string

	// Column is the fully-qualified SQL expression used in the WHERE clause,
	// e.g. "contacts.first_name" or "cr.course_progress".
	Column string

	// Type drives operator selection and value coercion.
	Type FieldType

	// JoinAlias + JoinSQL register a subtype-view join with CompileCtx. Leave
	// blank for columns on the primary table.
	JoinAlias string
	JoinSQL   string

	// AllowedOps, when non-empty, restricts the op set below what the field
	// type would otherwise permit. Unknown ops are rejected regardless.
	AllowedOps []Op

	// RequiresIndex is the index kind the field's allowed ops need to run
	// acceptably on production data.
	RequiresIndex IndexKind
}

// OpAllowed reports whether op is usable against this field: op must be
// globally known, allowed by the field's type, and (if AllowedOps is
// populated) present in the narrower allowlist.
func (f FieldSpec) OpAllowed(op Op) bool {
	if !IsKnown(op) {
		return false
	}
	if !opAllowedForType(f.Type, op) {
		return false
	}
	if len(f.AllowedOps) == 0 {
		return true
	}
	for _, a := range f.AllowedOps {
		if a == op {
			return true
		}
	}
	return false
}

// FieldRegistry maps (entity, field) → FieldSpec.
type FieldRegistry interface {
	Resolve(entity, field string) (FieldSpec, error)
	List(entity string) []string
}

// mapRegistry is a FieldRegistry backed by a static map. Entities register
// their field set at init by calling NewMapRegistry or composing one via a
// constructor like ContactsRegistry.
type mapRegistry struct {
	// entity → field name → spec. Custom-field prefixes are stored in
	// customPrefixes (e.g. "customFields.") so Resolve can match
	// "customFields.partner_id" without enumerating keys at boot.
	fields         map[string]map[string]FieldSpec
	customPrefixes map[string][]customPrefix
}

// customPrefix describes a dynamic family of fields — any name starting with
// Prefix resolves to a spec where Column is built by templating the suffix
// into ColumnTemplate. Used by customFields.* on the contacts entity.
type customPrefix struct {
	Prefix         string
	ColumnTemplate string // e.g. "contacts.custom_fields->>'%s'"
	Type           FieldType
}

// NewMapRegistry returns an empty in-memory registry.
func NewMapRegistry() *mapRegistry {
	return &mapRegistry{
		fields:         map[string]map[string]FieldSpec{},
		customPrefixes: map[string][]customPrefix{},
	}
}

// Register adds specs for a specific entity.
func (r *mapRegistry) Register(entity string, specs ...FieldSpec) {
	if r.fields[entity] == nil {
		r.fields[entity] = map[string]FieldSpec{}
	}
	for _, s := range specs {
		r.fields[entity][s.Name] = s
	}
}

// RegisterCustomPrefix wires a dynamic-field family onto an entity.
func (r *mapRegistry) RegisterCustomPrefix(entity string, p customPrefix) {
	r.customPrefixes[entity] = append(r.customPrefixes[entity], p)
}

// Resolve returns the FieldSpec for (entity, field), matching a static field
// first then any registered custom prefix.
func (r *mapRegistry) Resolve(entity, field string) (FieldSpec, error) {
	if byName, ok := r.fields[entity]; ok {
		if spec, ok := byName[field]; ok {
			return spec, nil
		}
	}
	for _, p := range r.customPrefixes[entity] {
		if strings.HasPrefix(field, p.Prefix) {
			suffix := strings.TrimPrefix(field, p.Prefix)
			if suffix == "" || strings.ContainsAny(suffix, "'\";\\") {
				return FieldSpec{}, errors.New("filters: invalid custom field suffix: " + field)
			}
			return FieldSpec{
				Name:   field,
				Column: strings.Replace(p.ColumnTemplate, "%s", suffix, 1),
				Type:   p.Type,
			}, nil
		}
	}
	return FieldSpec{}, errors.New("filters: unknown field for entity " + entity + ": " + field)
}

// List returns the sorted field names registered for the entity. Dynamic
// prefixes are rendered as "customFields.*".
func (r *mapRegistry) List(entity string) []string {
	out := make([]string, 0)
	if byName, ok := r.fields[entity]; ok {
		for name := range byName {
			out = append(out, name)
		}
	}
	for _, p := range r.customPrefixes[entity] {
		out = append(out, p.Prefix+"*")
	}
	return out
}

// ContactsEntity is the entity key for the contacts supertype.
const ContactsEntity = "contacts"

// Subtype-view join SQL. Aliases are stable so CompileCtx dedup works.
const (
	joinRecruit   = "LEFT JOIN contact_recruit_profile cr   ON cr.contact_id   = contacts.id"
	joinSale      = "LEFT JOIN contact_sale_profile sl      ON sl.contact_id   = contacts.id"
	joinAgentLead = "LEFT JOIN contact_agent_lead_profile al ON al.contact_id   = contacts.id"
)

// ContactsRegistry returns the FieldRegistry used by POST /crm/contacts/search
// and smart-list filters. Every field on this registry has a corresponding
// index in M0/M1 migrations — adding a new field without its index is a
// CI failure.
func ContactsRegistry() FieldRegistry {
	r := NewMapRegistry()

	r.Register(ContactsEntity,
		// ── Primary columns ──────────────────────────────────
		FieldSpec{Name: "id", Column: "contacts.id", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin}, RequiresIndex: IndexBTree},
		FieldSpec{Name: "firstName", Column: "contacts.first_name", Type: FieldText},
		FieldSpec{Name: "lastName", Column: "contacts.last_name", Type: FieldText},
		FieldSpec{Name: "fullName", Column: "contacts.full_name", Type: FieldText,
			RequiresIndex: IndexTrigram},
		FieldSpec{Name: "email", Column: "contacts.email", Type: FieldText,
			AllowedOps:    []Op{OpEq, OpNeq, OpIn, OpNin, OpContains, OpStartsWith, OpEndsWith, OpExists},
			RequiresIndex: IndexTrigram},
		FieldSpec{Name: "phone", Column: "contacts.phone", Type: FieldText},
		FieldSpec{Name: "phoneNormalized", Column: "contacts.phone_normalized", Type: FieldText,
			RequiresIndex: IndexBTree},
		FieldSpec{Name: "dob", Column: "contacts.dob", Type: FieldText},
		FieldSpec{Name: "lifecycleStage", Column: "contacts.lifecycle_stage", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin}, RequiresIndex: IndexBTree},
		FieldSpec{Name: "status", Column: "contacts.status", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin}},
		FieldSpec{Name: "sourceType", Column: "contacts.source_type", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin}, RequiresIndex: IndexBTree},
		// owner_agent_id on the DB holds the owning agent's discord ID. Plan
		// spec calls this field ownerAgentDiscordId; the column name is a
		// historical artefact of M0.
		FieldSpec{Name: "ownerAgentDiscordId", Column: "contacts.owner_agent_id", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin, OpExists}, RequiresIndex: IndexBTree},
		FieldSpec{Name: "createdAt", Column: "contacts.created_at", Type: FieldDate},
		FieldSpec{Name: "updatedAt", Column: "contacts.updated_at", Type: FieldDate,
			RequiresIndex: IndexBTree},
		FieldSpec{Name: "lastActivityAt", Column: "contacts.last_activity_at", Type: FieldDate},

		// ── Tags (EXISTS semi-join on contact_tags) ──────────
		FieldSpec{Name: "tags", Column: "contacts.id", Type: FieldArr,
			AllowedOps: []Op{OpHasTag, OpLacksTag}, RequiresIndex: IndexBTree},

		// ── Address (EXISTS on addresses) ────────────────────
		FieldSpec{Name: "address.state", Column: "contacts.id", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin}, RequiresIndex: IndexBTree},
		FieldSpec{Name: "address.city", Column: "contacts.id", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin, OpContains, OpStartsWith}},
		FieldSpec{Name: "address.postalCode", Column: "contacts.id", Type: FieldText,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin, OpStartsWith}},

		// ── Recruit subtype (LEFT JOIN contact_recruit_profile) ──
		FieldSpec{Name: "recruit.courseProgress", Column: "cr.course_progress", Type: FieldInt,
			JoinAlias: "cr", JoinSQL: joinRecruit},

		// ── Sale subtype (LEFT JOIN contact_sale_profile) ────
		FieldSpec{Name: "sale.premium", Column: "sl.premium", Type: FieldInt,
			JoinAlias: "sl", JoinSQL: joinSale},
		FieldSpec{Name: "sale.carrier", Column: "sl.carrier", Type: FieldText,
			JoinAlias: "sl", JoinSQL: joinSale},

		// ── Agent-lead subtype (LEFT JOIN contact_agent_lead_profile) ──
		FieldSpec{Name: "agent_lead.pipelineStage", Column: "al.pipeline_stage", Type: FieldText,
			JoinAlias: "al", JoinSQL: joinAgentLead,
			AllowedOps: []Op{OpEq, OpNeq, OpIn, OpNin}},
	)

	// customFields.KEY → contacts.custom_fields->>'KEY' (text access by default).
	// KEY is whitelisted char-set in Resolve to block injection.
	r.RegisterCustomPrefix(ContactsEntity, customPrefix{
		Prefix:         "customFields.",
		ColumnTemplate: "contacts.custom_fields->>'%s'",
		Type:           FieldText,
	})

	return r
}
