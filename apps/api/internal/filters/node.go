// Package filters implements the CRM filter DSL as a composite pattern.
//
// A FilterNode is either a Group (and/or combinator of children) or a Rule
// (single field/op/value predicate). Both expose Compile (parameterised SQL
// against a FieldRegistry whitelist) and Evaluate (pure in-memory against a
// subject map). The same grammar powers smart-list queries and — in a later
// milestone — automation if_condition steps.
package filters

// FilterNode is the composite interface implemented by Group and Rule.
type FilterNode interface {
	// Compile accumulates parameterised SQL and args into ctx and returns the
	// WHERE fragment (without the leading "WHERE"). Implementations MUST bind
	// every value via ctx.NextArg — never concatenate user input.
	Compile(ctx *CompileCtx) (sql string, err error)

	// Evaluate runs the filter in-memory against a subject map. Used by
	// future automation if_condition steps (M5).
	Evaluate(subject map[string]any) (bool, error)

	// Validate checks that every field/op referenced by this node is
	// registered in the given FieldRegistry. Called once before Compile.
	Validate(reg FieldRegistry) error
}

// Group is an and/or combinator of child FilterNodes.
type Group struct {
	Combinator string // "and" | "or"
	Children   []FilterNode
}

// Rule is a single field/op/value predicate.
type Rule struct {
	Field string
	Op    string
	Value any
}

// CompileCtx carries the per-query state shared by every Group/Rule in a
// single Compile traversal: the bound-argument accumulator, the field
// registry, and the deduplicated join clauses required by subtype views.
type CompileCtx struct {
	Entity   string
	Registry FieldRegistry
	args     []any
	joins    map[string]string // alias → JOIN SQL (dedup)
}

// NewCompileCtx returns a CompileCtx ready for a fresh traversal.
func NewCompileCtx(entity string, reg FieldRegistry) *CompileCtx {
	return &CompileCtx{
		Entity:   entity,
		Registry: reg,
		joins:    map[string]string{},
	}
}

// NextArg binds v as the next $N parameter and returns its placeholder.
func (c *CompileCtx) NextArg(v any) string {
	c.args = append(c.args, v)
	return sqlPlaceholder(len(c.args))
}

// Args returns the accumulated bound arguments in $N order.
func (c *CompileCtx) Args() []any { return c.args }

// AddJoin registers a JOIN clause once per alias.
func (c *CompileCtx) AddJoin(alias, joinSQL string) {
	if _, ok := c.joins[alias]; !ok {
		c.joins[alias] = joinSQL
	}
}

// Joins returns the deduplicated JOIN clauses in insertion order.
func (c *CompileCtx) Joins() []string {
	out := make([]string, 0, len(c.joins))
	for _, j := range c.joins {
		out = append(out, j)
	}
	return out
}
