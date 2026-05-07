package filters

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Evaluate walks children and short-circuits. For OR: the first true wins.
// For AND: the first false wins. Empty groups are rejected up front — same
// shape as Compile's guard.
func (g *Group) Evaluate(subject map[string]any) (bool, error) {
	if len(g.Children) == 0 {
		return false, fmt.Errorf("filters: empty group")
	}
	switch strings.ToLower(g.Combinator) {
	case "and":
		for _, c := range g.Children {
			ok, err := c.Evaluate(subject)
			if err != nil {
				return false, err
			}
			if !ok {
				return false, nil
			}
		}
		return true, nil
	case "or":
		for _, c := range g.Children {
			ok, err := c.Evaluate(subject)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
		}
		return false, nil
	}
	return false, fmt.Errorf("filters: unknown combinator %q", g.Combinator)
}

// Evaluate runs the op in-memory against subject[Field]. Missing fields are
// treated as NULL: Exists-false matches, Exists-true and all value-compare
// ops fail. This matches SQL semantics for NULL comparisons.
func (r *Rule) Evaluate(subject map[string]any) (bool, error) {
	op := Op(r.Op)
	if !IsKnown(op) {
		return false, fmt.Errorf("filters: unknown op %s", r.Op)
	}
	// Tag/address evaluation in memory requires subject["tags"] as []string
	// and subject["address"] as a map — automations (M5) will populate these
	// when invoking the evaluator. Other fields read subject[r.Field]
	// directly.
	switch r.Field {
	case "tags":
		return evalTags(subject, op, r.Value)
	}

	raw, ok := subject[r.Field]
	if !ok || raw == nil {
		return op == OpExists && boolish(r.Value) == false, nil
	}
	return evalScalar(raw, op, r.Value)
}

func evalScalar(subject any, op Op, want any) (bool, error) {
	switch op {
	case OpEq:
		return fmt.Sprint(subject) == fmt.Sprint(want), nil
	case OpNeq:
		return fmt.Sprint(subject) != fmt.Sprint(want), nil
	case OpIn, OpNin:
		vs, ok := want.([]any)
		if !ok {
			return false, fmt.Errorf("filters: in/nin value must be a list")
		}
		hit := false
		s := fmt.Sprint(subject)
		for _, e := range vs {
			if s == fmt.Sprint(e) {
				hit = true
				break
			}
		}
		if op == OpIn {
			return hit, nil
		}
		return !hit, nil
	case OpContains:
		return strings.Contains(strings.ToLower(fmt.Sprint(subject)), strings.ToLower(fmt.Sprint(want))), nil
	case OpStartsWith:
		return strings.HasPrefix(strings.ToLower(fmt.Sprint(subject)), strings.ToLower(fmt.Sprint(want))), nil
	case OpEndsWith:
		return strings.HasSuffix(strings.ToLower(fmt.Sprint(subject)), strings.ToLower(fmt.Sprint(want))), nil
	case OpMatches:
		re, err := regexp.Compile("(?i)" + fmt.Sprint(want))
		if err != nil {
			return false, fmt.Errorf("filters: invalid regex %v: %w", want, err)
		}
		return re.MatchString(fmt.Sprint(subject)), nil
	case OpExists:
		return boolish(want), nil
	case OpGt, OpGte, OpLt, OpLte, OpBetween:
		return evalCompare(subject, op, want)
	}
	return false, fmt.Errorf("filters: op %s not supported in-memory", op)
}

func evalCompare(subject any, op Op, want any) (bool, error) {
	// Compare numerics as float64, dates as time.Time, strings
	// lexicographically. The subject's type is assumed to match the schema.
	switch s := subject.(type) {
	case float64, int, int64:
		sf := asFloat(s)
		switch op {
		case OpBetween:
			lohi, ok := want.([]any)
			if !ok || len(lohi) != 2 {
				return false, fmt.Errorf("filters: between value must be [lo, hi]")
			}
			return sf >= asFloat(lohi[0]) && sf <= asFloat(lohi[1]), nil
		}
		return compareFloat(sf, op, asFloat(want)), nil
	case string:
		if st, err := time.Parse(time.RFC3339, s); err == nil {
			return compareTime(st, op, want)
		}
		switch op {
		case OpBetween:
			lohi, ok := want.([]any)
			if !ok || len(lohi) != 2 {
				return false, fmt.Errorf("filters: between value must be [lo, hi]")
			}
			return s >= fmt.Sprint(lohi[0]) && s <= fmt.Sprint(lohi[1]), nil
		}
		return compareString(s, op, fmt.Sprint(want)), nil
	case time.Time:
		return compareTime(s, op, want)
	}
	return false, fmt.Errorf("filters: compare on unsupported type %T", subject)
}

func compareFloat(a float64, op Op, b float64) bool {
	switch op {
	case OpGt:
		return a > b
	case OpGte:
		return a >= b
	case OpLt:
		return a < b
	case OpLte:
		return a <= b
	}
	return false
}

func compareString(a string, op Op, b string) bool {
	switch op {
	case OpGt:
		return a > b
	case OpGte:
		return a >= b
	case OpLt:
		return a < b
	case OpLte:
		return a <= b
	}
	return false
}

func compareTime(a time.Time, op Op, want any) (bool, error) {
	if op == OpBetween {
		lohi, ok := want.([]any)
		if !ok || len(lohi) != 2 {
			return false, fmt.Errorf("filters: between value must be [lo, hi]")
		}
		lo, err1 := asTime(lohi[0])
		hi, err2 := asTime(lohi[1])
		if err1 != nil {
			return false, err1
		}
		if err2 != nil {
			return false, err2
		}
		return !a.Before(lo) && !a.After(hi), nil
	}
	bt, err := asTime(want)
	if err != nil {
		return false, err
	}
	switch op {
	case OpGt:
		return a.After(bt), nil
	case OpGte:
		return !a.Before(bt), nil
	case OpLt:
		return a.Before(bt), nil
	case OpLte:
		return !a.After(bt), nil
	}
	return false, fmt.Errorf("filters: unsupported time op %s", op)
}

func asFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int:
		return float64(x)
	case int32:
		return float64(x)
	case int64:
		return float64(x)
	}
	return 0
}

func asTime(v any) (time.Time, error) {
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
	}
	return time.Time{}, fmt.Errorf("filters: not a time: %v", v)
}

func boolish(v any) bool {
	switch x := v.(type) {
	case bool:
		return x
	case string:
		return x == "true" || x == "1"
	}
	return false
}

// evalTags reads subject["tags"] as []string and evaluates hasTag / lacksTag
// against it. Other tag ops are rejected up front by Validate via the
// FieldSpec's AllowedOps, so this switch is covered.
func evalTags(subject map[string]any, op Op, want any) (bool, error) {
	raw, ok := subject["tags"]
	if !ok {
		return op == OpLacksTag, nil
	}
	list, ok := raw.([]string)
	if !ok {
		anys, ok := raw.([]any)
		if !ok {
			return false, fmt.Errorf("filters: subject[tags] must be []string")
		}
		list = make([]string, 0, len(anys))
		for _, a := range anys {
			list = append(list, fmt.Sprint(a))
		}
	}
	tag := fmt.Sprint(want)
	hit := false
	for _, t := range list {
		if t == tag {
			hit = true
			break
		}
	}
	switch op {
	case OpHasTag:
		return hit, nil
	case OpLacksTag:
		return !hit, nil
	}
	return false, fmt.Errorf("filters: tags does not support op %s in-memory", op)
}
