package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

// Filter JSON shape accepted by every CRM endpoint that takes a filter:
//
//	Group: {"combinator": "and"|"or", "children": [<Group|Rule>, ...]}
//	Rule:  {"field": "<name>", "op": "<op>", "value": <any>}
//
// Detection: presence of "field" ⇒ Rule; otherwise ⇒ Group. Unknown top-
// level keys are rejected with ErrUnknownFilterKey.
const (
	maxFilterDepth     = 6
	maxFilterWidth     = 50
	maxSmartListFilter = 32 * 1024 // 32 KiB persisted filter cap
)

var (
	errFilterTooDeep     = errors.New("filter: exceeds max depth of 6")
	errFilterTooWide     = errors.New("filter: exceeds max width of 50 rules per group")
	errFilterMalformed   = errors.New("filter: malformed")
	errUnknownFilterKey  = errors.New("filter: unknown key")
	errFilterEmptyBase64 = errors.New("filter: empty base64 value")
)

// filterJSONGuard walks the raw JSON and enforces depth/width caps BEFORE
// passing it to the typed parser. This is an anti-DoS measure — a single
// attacker-controlled group-of-groups could otherwise stack recursively.
//
// Empty input is allowed and treated as "no filter" — caller handles that.
func filterJSONGuard(raw []byte) error {
	if len(raw) == 0 {
		return nil
	}
	var generic any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return fmt.Errorf("%w: %v", errFilterMalformed, err)
	}
	return walkFilterJSON(generic, 1)
}

func walkFilterJSON(node any, depth int) error {
	if depth > maxFilterDepth {
		return errFilterTooDeep
	}
	m, ok := node.(map[string]any)
	if !ok {
		return fmt.Errorf("%w: node is not an object", errFilterMalformed)
	}
	// Rule: has "field" — width applies to siblings in the parent group,
	// checked at the Group level.
	if _, isRule := m["field"]; isRule {
		for k := range m {
			if k != "field" && k != "op" && k != "value" {
				return fmt.Errorf("%w: %s", errUnknownFilterKey, k)
			}
		}
		return nil
	}
	// Group: must have "combinator" and "children".
	for k := range m {
		if k != "combinator" && k != "children" {
			return fmt.Errorf("%w: %s", errUnknownFilterKey, k)
		}
	}
	childrenRaw, ok := m["children"]
	if !ok {
		return fmt.Errorf("%w: group missing children", errFilterMalformed)
	}
	children, ok := childrenRaw.([]any)
	if !ok {
		return fmt.Errorf("%w: children is not an array", errFilterMalformed)
	}
	if len(children) > maxFilterWidth {
		return errFilterTooWide
	}
	for _, c := range children {
		if err := walkFilterJSON(c, depth+1); err != nil {
			return err
		}
	}
	return nil
}

// parseFilterNode converts JSON-verified bytes into a filters.FilterNode.
// Caller MUST call filterJSONGuard first — parseFilterNode does not re-check
// bounds. Empty input returns (nil, nil).
func parseFilterNode(raw []byte) (filters.FilterNode, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var generic any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil, fmt.Errorf("%w: %v", errFilterMalformed, err)
	}
	return buildNode(generic)
}

func buildNode(v any) (filters.FilterNode, error) {
	m, ok := v.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%w: node must be an object", errFilterMalformed)
	}
	if _, isRule := m["field"]; isRule {
		field, _ := m["field"].(string)
		op, _ := m["op"].(string)
		return &filters.Rule{Field: field, Op: op, Value: m["value"]}, nil
	}
	comb, _ := m["combinator"].(string)
	childrenRaw, _ := m["children"].([]any)
	g := &filters.Group{Combinator: comb, Children: make([]filters.FilterNode, 0, len(childrenRaw))}
	for _, c := range childrenRaw {
		child, err := buildNode(c)
		if err != nil {
			return nil, err
		}
		g.Children = append(g.Children, child)
	}
	return g, nil
}

// decodeBase64Filter unpacks a URL-safe base64 query param carrying the
// filter JSON. Accepts both standard and URL-safe encodings with or without
// padding — frontends vary.
func decodeBase64Filter(param string) ([]byte, error) {
	if param == "" {
		return nil, errFilterEmptyBase64
	}
	decoders := []*base64.Encoding{
		base64.StdEncoding,
		base64.URLEncoding,
		base64.RawStdEncoding,
		base64.RawURLEncoding,
	}
	for _, d := range decoders {
		if b, err := d.DecodeString(param); err == nil {
			return b, nil
		}
	}
	return nil, fmt.Errorf("%w: invalid base64", errFilterMalformed)
}
