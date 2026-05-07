// Package repo provides a generic Repository[T] with built-in visibility
// scoping, soft-delete handling, and bulk-op dispatch. Concrete entities
// implement the Entity interface to describe their table + columns; the
// generic Repository does the rest.
package repo

import "phantomcrm-api/internal/filters"

// Entity describes a persistable type enough for the generic Repository to
// build CRUD SQL and enforce visibility without handler-level boilerplate.
type Entity interface {
	// TableName is the physical table, e.g. "contacts".
	TableName() string

	// PrimaryKey is the PK column name, e.g. "id".
	PrimaryKey() string

	// SoftDeleteColumn returns the column + archived-value pair used to
	// implement soft delete. Return ("", "") if the entity has no soft
	// delete.
	SoftDeleteColumn() (column, archivedValue string)

	// OwnerColumn returns the column that holds the owning agent's discord
	// ID, or "" for globally-visible entities.
	OwnerColumn() string

	// SharedColumn returns a TEXT[] column holding additional discord IDs
	// that may read the row, or "" if no sharing is supported.
	SharedColumn() string

	// FieldRegistry exposes which fields the filter DSL may reference on
	// this entity.
	FieldRegistry() filters.FieldRegistry
}
