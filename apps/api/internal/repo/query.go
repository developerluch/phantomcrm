package repo

import "phantomcrm-api/internal/filters"

// ActorScope captures the identity + privilege of the caller. Populated by
// handlers from auth context; consumed by Repository[T] to enforce row-level
// visibility without handlers needing to write WHERE clauses.
type ActorScope struct {
	ActorDiscordID string
	IsAdmin        bool
}

// SortField is one component of an ORDER BY clause.
type SortField struct {
	Field string
	Dir   string // "asc" | "desc"
}

// ListQuery is the input to Repository.List.
type ListQuery struct {
	Filter filters.FilterNode
	Sort   []SortField
	Cursor string
	Limit  int
	Scope  ActorScope
}

// Page is the paginated result of Repository.List.
type Page[T any] struct {
	Items      []T
	NextCursor string
	Total      int
}

// BulkOp identifies a registered BulkAction by name.
type BulkOp string

// BulkResult is returned from Repository.Bulk.
type BulkResult struct {
	Affected int
	Skipped  int
	Errors   []string
}
