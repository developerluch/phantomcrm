package filters

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Validate checks every child against the registry.
func (g *Group) Validate(reg FieldRegistry) error {
	if g.Combinator != "and" && g.Combinator != "or" {
		return errors.New("filters: group combinator must be 'and' or 'or'")
	}
	if len(g.Children) == 0 {
		return errors.New("filters: group must have at least one child")
	}
	for _, c := range g.Children {
		if err := c.Validate(reg); err != nil {
			return err
		}
	}
	return nil
}

// Validate resolves the field on the contacts entity and checks the op.
//
// Validate cannot know the entity at the node level without a CompileCtx
// (this is a cost of the composite contract). It does only the
// op-is-globally-known check here; entity-scoped field/op compatibility is
// re-verified inside Compile via CompileCtx.Entity.
func (r *Rule) Validate(reg FieldRegistry) error {
	if !IsKnown(Op(r.Op)) {
		return errors.New("filters: unknown op: " + r.Op)
	}
	return nil
}

// Compile walks children, joining their SQL with AND / OR, and wraps in parens.
// Empty children after compilation (defensive — none of the primitive Rule
// compilations return empty) are skipped so a group with a pruned branch
// doesn't emit dangling operators.
func (g *Group) Compile(ctx *CompileCtx) (string, error) {
	if len(g.Children) == 0 {
		return "", errors.New("filters: empty group")
	}
	op := strings.ToUpper(g.Combinator)
	if op != "AND" && op != "OR" {
		return "", errors.New("filters: group combinator must be 'and' or 'or'")
	}
	parts := make([]string, 0, len(g.Children))
	for _, c := range g.Children {
		sql, err := c.Compile(ctx)
		if err != nil {
			return "", err
		}
		if sql == "" {
			continue
		}
		parts = append(parts, sql)
	}
	if len(parts) == 0 {
		return "", errors.New("filters: group compiled to empty")
	}
	if len(parts) == 1 {
		return parts[0], nil
	}
	return "(" + strings.Join(parts, " "+op+" ") + ")", nil
}

// Compile resolves the field on the current entity and emits parameterised
// SQL for the op. Every value goes through ctx.NextArg — no interpolation.
func (r *Rule) Compile(ctx *CompileCtx) (string, error) {
	spec, err := ctx.Registry.Resolve(ctx.Entity, r.Field)
	if err != nil {
		return "", err
	}
	if !spec.OpAllowed(Op(r.Op)) {
		return "", fmt.Errorf("filters: op %s not allowed on field %s (type=%s)", r.Op, r.Field, spec.Type)
	}
	if spec.JoinAlias != "" && spec.JoinSQL != "" {
		ctx.AddJoin(spec.JoinAlias, spec.JoinSQL)
	}

	// EXISTS-semi-joined virtual fields (tags, address.*) are dispatched by
	// name before falling into the generic op handlers, because their SQL
	// shape is a subquery, not a simple column op.
	switch r.Field {
	case "tags":
		return compileTags(ctx, Op(r.Op), r.Value)
	case "address.state", "address.city", "address.postalCode":
		return compileAddress(ctx, r.Field, Op(r.Op), r.Value)
	}

	return compileScalar(ctx, spec, Op(r.Op), r.Value)
}

// compileScalar handles the primitive op set on a single column.
func compileScalar(ctx *CompileCtx, spec FieldSpec, op Op, value any) (string, error) {
	col := spec.Column
	switch op {
	case OpEq, OpNeq, OpGt, OpGte, OpLt, OpLte:
		coerced, err := coerce(value, spec.Type)
		if err != nil {
			return "", fmt.Errorf("filters: coerce %s for %s: %w", op, spec.Name, err)
		}
		return col + " " + sqlOp(op) + " " + ctx.NextArg(coerced), nil

	case OpIn, OpNin:
		vs, err := coerceSlice(value, spec.Type)
		if err != nil {
			return "", fmt.Errorf("filters: coerce %s for %s: %w", op, spec.Name, err)
		}
		if len(vs) == 0 {
			// Empty IN — refuse rather than silently return "false" or
			// overly-broad semantics. Clients must send >=1 value.
			return "", fmt.Errorf("filters: %s requires non-empty value list", op)
		}
		placeholders := make([]string, len(vs))
		for i, v := range vs {
			placeholders[i] = ctx.NextArg(v)
		}
		kw := "IN"
		if op == OpNin {
			kw = "NOT IN"
		}
		return col + " " + kw + " (" + strings.Join(placeholders, ",") + ")", nil

	case OpContains:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " ILIKE " + ctx.NextArg("%"+escapeLike(s)+"%"), nil

	case OpStartsWith:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " ILIKE " + ctx.NextArg(escapeLike(s)+"%"), nil

	case OpEndsWith:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " ILIKE " + ctx.NextArg("%"+escapeLike(s)), nil

	case OpMatches:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " ~* " + ctx.NextArg(s), nil

	case OpExists:
		truthy, err := coerceBool(value)
		if err != nil {
			return "", err
		}
		if truthy {
			return col + " IS NOT NULL", nil
		}
		return col + " IS NULL", nil

	case OpBetween:
		lo, hi, err := coerceRange(value, spec.Type)
		if err != nil {
			return "", fmt.Errorf("filters: coerce between for %s: %w", spec.Name, err)
		}
		return col + " BETWEEN " + ctx.NextArg(lo) + " AND " + ctx.NextArg(hi), nil
	}
	return "", fmt.Errorf("filters: op %s has no scalar compile impl", op)
}

// compileTags renders hasTag / lacksTag as an EXISTS / NOT EXISTS semi-join
// against contact_tags. Value is a single tag string.
func compileTags(ctx *CompileCtx, op Op, value any) (string, error) {
	tag, err := coerceString(value)
	if err != nil {
		return "", err
	}
	sub := "(SELECT 1 FROM contact_tags t WHERE t.contact_id = contacts.id AND t.tag = " + ctx.NextArg(tag) + ")"
	switch op {
	case OpHasTag:
		return "EXISTS " + sub, nil
	case OpLacksTag:
		return "NOT EXISTS " + sub, nil
	}
	return "", fmt.Errorf("filters: tags does not support op %s", op)
}

// compileAddress renders address.* predicates as EXISTS on the addresses
// table. Only the primary address participates — this matches what the
// Contacts page surfaces as "the" address.
func compileAddress(ctx *CompileCtx, field string, op Op, value any) (string, error) {
	var col string
	switch field {
	case "address.state":
		col = "a.state"
	case "address.city":
		col = "a.city"
	case "address.postalCode":
		col = "a.postal_code"
	default:
		return "", fmt.Errorf("filters: unknown address field %s", field)
	}
	inner, err := compileAddressOp(ctx, col, op, value)
	if err != nil {
		return "", err
	}
	return "EXISTS (SELECT 1 FROM addresses a WHERE a.contact_id = contacts.id AND a.is_primary = true AND " + inner + ")", nil
}

func compileAddressOp(ctx *CompileCtx, col string, op Op, value any) (string, error) {
	switch op {
	case OpEq, OpNeq:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " " + sqlOp(op) + " " + ctx.NextArg(s), nil
	case OpIn, OpNin:
		vs, err := coerceSlice(value, FieldText)
		if err != nil {
			return "", err
		}
		if len(vs) == 0 {
			return "", fmt.Errorf("filters: %s requires non-empty value list", op)
		}
		placeholders := make([]string, len(vs))
		for i, v := range vs {
			placeholders[i] = ctx.NextArg(v)
		}
		kw := "IN"
		if op == OpNin {
			kw = "NOT IN"
		}
		return col + " " + kw + " (" + strings.Join(placeholders, ",") + ")", nil
	case OpContains:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " ILIKE " + ctx.NextArg("%"+escapeLike(s)+"%"), nil
	case OpStartsWith:
		s, err := coerceString(value)
		if err != nil {
			return "", err
		}
		return col + " ILIKE " + ctx.NextArg(escapeLike(s)+"%"), nil
	}
	return "", fmt.Errorf("filters: address field does not support op %s", op)
}

func sqlOp(op Op) string {
	switch op {
	case OpEq:
		return "="
	case OpNeq:
		return "<>"
	case OpGt:
		return ">"
	case OpGte:
		return ">="
	case OpLt:
		return "<"
	case OpLte:
		return "<="
	}
	return ""
}

// escapeLike escapes %, _ and \ so they don't act as LIKE wildcards inside a
// user-supplied value.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

// ───────────────────────── coercion ─────────────────────────────────────

func coerceString(v any) (string, error) {
	switch x := v.(type) {
	case string:
		return x, nil
	case fmt.Stringer:
		return x.String(), nil
	case bool:
		if x {
			return "true", nil
		}
		return "false", nil
	}
	return "", fmt.Errorf("filters: value %v is not a string", v)
}

func coerceBool(v any) (bool, error) {
	switch x := v.(type) {
	case bool:
		return x, nil
	case string:
		b, err := strconv.ParseBool(x)
		if err != nil {
			return false, fmt.Errorf("filters: value %q is not a bool", x)
		}
		return b, nil
	}
	return false, fmt.Errorf("filters: value %v is not a bool", v)
}

// coerce maps a JSON value to the native Go type the SQL driver accepts for
// the given FieldType. Numbers arrive as float64 from encoding/json.
func coerce(v any, t FieldType) (any, error) {
	switch t {
	case FieldText, FieldJSON:
		return coerceString(v)
	case FieldInt:
		switch x := v.(type) {
		case int, int32, int64:
			return x, nil
		case float64:
			if x != float64(int64(x)) {
				return nil, fmt.Errorf("filters: value %v is not an integer", v)
			}
			return int64(x), nil
		case string:
			i, err := strconv.ParseInt(x, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("filters: value %q is not an integer", x)
			}
			return i, nil
		}
		return nil, fmt.Errorf("filters: value %v is not an integer", v)
	case FieldBool:
		return coerceBool(v)
	case FieldDate:
		return coerceDate(v)
	}
	return nil, fmt.Errorf("filters: unknown field type %s", t)
}

// coerceDate accepts RFC3339 strings (the shape the frontend sends) or
// time.Time values. The driver will handle the rest.
func coerceDate(v any) (any, error) {
	switch x := v.(type) {
	case time.Time:
		return x, nil
	case string:
		if t, err := time.Parse(time.RFC3339, x); err == nil {
			return t, nil
		}
		if t, err := time.Parse("2006-01-02", x); err == nil {
			return t, nil
		}
		return nil, fmt.Errorf("filters: value %q is not an RFC3339 or YYYY-MM-DD date", x)
	}
	return nil, fmt.Errorf("filters: value %v is not a date", v)
}

func coerceSlice(v any, t FieldType) ([]any, error) {
	raw, ok := v.([]any)
	if !ok {
		return nil, fmt.Errorf("filters: value %v is not a list", v)
	}
	out := make([]any, 0, len(raw))
	for _, e := range raw {
		c, err := coerce(e, t)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// coerceRange expects [lo, hi] — a two-element list.
func coerceRange(v any, t FieldType) (any, any, error) {
	raw, ok := v.([]any)
	if !ok || len(raw) != 2 {
		return nil, nil, errors.New("filters: between value must be a [lo, hi] list")
	}
	lo, err := coerce(raw[0], t)
	if err != nil {
		return nil, nil, err
	}
	hi, err := coerce(raw[1], t)
	if err != nil {
		return nil, nil, err
	}
	return lo, hi, nil
}

// sqlPlaceholder returns the $N placeholder for the Nth bound arg.
func sqlPlaceholder(n int) string {
	return "$" + strconv.Itoa(n)
}
