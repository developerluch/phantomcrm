package filters

// Op is a filter operator identifier.
type Op string

const (
	OpEq         Op = "eq"
	OpNeq        Op = "neq"
	OpIn         Op = "in"
	OpNin        Op = "nin"
	OpContains   Op = "contains"
	OpStartsWith Op = "startsWith"
	OpEndsWith   Op = "endsWith"
	OpMatches    Op = "matches"
	OpExists     Op = "exists"
	OpGt         Op = "gt"
	OpGte        Op = "gte"
	OpLt         Op = "lt"
	OpLte        Op = "lte"
	OpBetween    Op = "between"
	OpHasTag     Op = "hasTag"
	OpLacksTag   Op = "lacksTag"
)

// KnownOps is the set of operators the DSL accepts. Any Rule with an Op not
// in this set is rejected at Validate time with a 400.
var KnownOps = map[Op]struct{}{
	OpEq: {}, OpNeq: {}, OpIn: {}, OpNin: {},
	OpContains: {}, OpStartsWith: {}, OpEndsWith: {}, OpMatches: {},
	OpExists: {}, OpGt: {}, OpGte: {}, OpLt: {}, OpLte: {}, OpBetween: {},
	OpHasTag: {}, OpLacksTag: {},
}

// IsKnown reports whether op is a recognised operator.
func IsKnown(op Op) bool {
	_, ok := KnownOps[op]
	return ok
}

// AllowedOpsByType is the default per-FieldType operator allowlist. A
// FieldSpec may narrow this further via FieldSpec.AllowedOps; it may not
// widen it. Unknown ops are rejected regardless.
var AllowedOpsByType = map[FieldType]map[Op]struct{}{
	FieldText: {
		OpEq: {}, OpNeq: {}, OpIn: {}, OpNin: {},
		OpContains: {}, OpStartsWith: {}, OpEndsWith: {},
		OpExists: {},
	},
	FieldInt: {
		OpEq: {}, OpNeq: {}, OpIn: {}, OpNin: {},
		OpGt: {}, OpGte: {}, OpLt: {}, OpLte: {}, OpBetween: {},
		OpExists: {},
	},
	FieldDate: {
		OpEq: {}, OpNeq: {},
		OpGt: {}, OpGte: {}, OpLt: {}, OpLte: {}, OpBetween: {},
		OpExists: {},
	},
	FieldBool: {
		OpEq: {}, OpNeq: {}, OpExists: {},
	},
	FieldJSON: {
		OpEq: {}, OpNeq: {}, OpContains: {}, OpExists: {},
	},
	FieldArr: {
		OpHasTag: {}, OpLacksTag: {}, OpExists: {},
	},
}

// opAllowedForType reports whether op is allowed against the given type under
// the default type policy. Returns false for unknown types/ops.
func opAllowedForType(t FieldType, op Op) bool {
	bucket, ok := AllowedOpsByType[t]
	if !ok {
		return false
	}
	_, ok = bucket[op]
	return ok
}
