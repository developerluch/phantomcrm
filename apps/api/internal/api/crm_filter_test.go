package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

func TestFilterJSONGuard_EmptyAllowed(t *testing.T) {
	if err := filterJSONGuard(nil); err != nil {
		t.Fatalf("nil body should be allowed, got %v", err)
	}
	if err := filterJSONGuard([]byte{}); err != nil {
		t.Fatalf("empty body should be allowed, got %v", err)
	}
}

func TestFilterJSONGuard_Malformed(t *testing.T) {
	if err := filterJSONGuard([]byte(`{"not valid`)); !errors.Is(err, errFilterMalformed) {
		t.Fatalf("malformed JSON should be errFilterMalformed: %v", err)
	}
}

func TestFilterJSONGuard_HappyPath(t *testing.T) {
	good := []byte(`{"combinator":"and","children":[
		{"field":"firstName","op":"eq","value":"John"},
		{"combinator":"or","children":[
			{"field":"email","op":"contains","value":"acme"}
		]}
	]}`)
	if err := filterJSONGuard(good); err != nil {
		t.Fatalf("valid filter rejected: %v", err)
	}
}

func TestFilterJSONGuard_DepthCap(t *testing.T) {
	// Build a group nested 7 deep — should exceed depth 6.
	build := func(depth int) []byte {
		s := `{"field":"firstName","op":"eq","value":"x"}`
		for i := 0; i < depth; i++ {
			s = `{"combinator":"and","children":[` + s + `]}`
		}
		return []byte(s)
	}
	if err := filterJSONGuard(build(5)); err != nil {
		t.Fatalf("depth 6 should pass (rule at depth 7? actually 5 groups + 1 rule = 6): %v", err)
	}
	if err := filterJSONGuard(build(6)); !errors.Is(err, errFilterTooDeep) {
		t.Fatalf("depth 7 should be errFilterTooDeep: %v", err)
	}
}

func TestFilterJSONGuard_WidthCap(t *testing.T) {
	// 51 sibling rules in one group → over cap.
	rules := make([]string, 51)
	for i := 0; i < 51; i++ {
		rules[i] = fmt.Sprintf(`{"field":"firstName","op":"eq","value":"x%d"}`, i)
	}
	body := []byte(`{"combinator":"and","children":[` + strings.Join(rules, ",") + `]}`)
	if err := filterJSONGuard(body); !errors.Is(err, errFilterTooWide) {
		t.Fatalf("width 51 should be errFilterTooWide: %v", err)
	}
}

func TestFilterJSONGuard_UnknownKey(t *testing.T) {
	body := []byte(`{"combinator":"and","children":[],"extra":"x"}`)
	if err := filterJSONGuard(body); !errors.Is(err, errUnknownFilterKey) {
		t.Fatalf("unknown key should be errUnknownFilterKey: %v", err)
	}
	rule := []byte(`{"field":"firstName","op":"eq","value":"x","extra":"y"}`)
	if err := filterJSONGuard(rule); !errors.Is(err, errUnknownFilterKey) {
		t.Fatalf("unknown key in rule should be errUnknownFilterKey: %v", err)
	}
}

func TestFilterJSONGuard_GroupMissingChildren(t *testing.T) {
	body := []byte(`{"combinator":"and"}`)
	if err := filterJSONGuard(body); !errors.Is(err, errFilterMalformed) {
		t.Fatalf("group without children should be malformed: %v", err)
	}
}

// ─── parseFilterNode ────────────────────────────────────────────────────

func TestParseFilterNode_Empty(t *testing.T) {
	n, err := parseFilterNode(nil)
	if err != nil || n != nil {
		t.Fatalf("empty should parse to (nil, nil), got (%v, %v)", n, err)
	}
}

func TestParseFilterNode_SingleRule(t *testing.T) {
	n, err := parseFilterNode([]byte(`{"field":"firstName","op":"eq","value":"John"}`))
	if err != nil {
		t.Fatal(err)
	}
	rule, ok := n.(*filters.Rule)
	if !ok {
		t.Fatalf("expected *filters.Rule, got %T", n)
	}
	if rule.Field != "firstName" || rule.Op != "eq" || rule.Value.(string) != "John" {
		t.Fatalf("unexpected rule: %+v", rule)
	}
}

func TestParseFilterNode_NestedGroup(t *testing.T) {
	raw := []byte(`{"combinator":"and","children":[
		{"field":"firstName","op":"eq","value":"John"},
		{"field":"email","op":"contains","value":"acme"}
	]}`)
	n, err := parseFilterNode(raw)
	if err != nil {
		t.Fatal(err)
	}
	g, ok := n.(*filters.Group)
	if !ok {
		t.Fatalf("expected *filters.Group, got %T", n)
	}
	if g.Combinator != "and" || len(g.Children) != 2 {
		t.Fatalf("unexpected group: %+v", g)
	}
}

func TestParseFilterNode_ValueTypesPreserved(t *testing.T) {
	// IN value is a JSON array — parser must surface it as []any.
	raw := []byte(`{"field":"lifecycleStage","op":"in","value":["lead","customer"]}`)
	n, err := parseFilterNode(raw)
	if err != nil {
		t.Fatal(err)
	}
	rule := n.(*filters.Rule)
	vs, ok := rule.Value.([]any)
	if !ok || len(vs) != 2 {
		t.Fatalf("value shape wrong: %T %v", rule.Value, rule.Value)
	}
}

// ─── decodeBase64Filter ─────────────────────────────────────────────────

func TestDecodeBase64Filter_Standard(t *testing.T) {
	raw := `{"field":"firstName","op":"eq","value":"x"}`
	encoded := base64.StdEncoding.EncodeToString([]byte(raw))
	out, err := decodeBase64Filter(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != raw {
		t.Fatalf("round-trip mismatch: %s", out)
	}
}

func TestDecodeBase64Filter_URLSafe(t *testing.T) {
	raw := `{"field":"email","op":"contains","value":"a+b/c=d"}`
	encoded := base64.URLEncoding.EncodeToString([]byte(raw))
	out, err := decodeBase64Filter(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != raw {
		t.Fatalf("URL-safe round-trip mismatch: %s", out)
	}
}

func TestDecodeBase64Filter_Empty(t *testing.T) {
	if _, err := decodeBase64Filter(""); !errors.Is(err, errFilterEmptyBase64) {
		t.Fatalf("empty input should be errFilterEmptyBase64: %v", err)
	}
}

func TestDecodeBase64Filter_Garbage(t *testing.T) {
	if _, err := decodeBase64Filter("!!!not base64!!!"); !errors.Is(err, errFilterMalformed) {
		t.Fatalf("garbage should be errFilterMalformed: %v", err)
	}
}

// ─── parseSortParam ─────────────────────────────────────────────────────

func TestParseSortParam_Empty(t *testing.T) {
	out, err := parseSortParam("")
	if err != nil || out != nil {
		t.Fatalf("empty should produce (nil, nil), got (%v, %v)", out, err)
	}
}

func TestParseSortParam_Single(t *testing.T) {
	out, err := parseSortParam("firstName:asc")
	if err != nil || len(out) != 1 || out[0].Field != "firstName" || out[0].Dir != "asc" {
		t.Fatalf("unexpected parse: %v / %v", out, err)
	}
}

func TestParseSortParam_MultiWithoutDir(t *testing.T) {
	out, err := parseSortParam("firstName,lastName:desc")
	if err != nil || len(out) != 2 {
		t.Fatalf("parse failed: %v / %v", out, err)
	}
	if out[0].Field != "firstName" || out[0].Dir != "" {
		t.Fatalf("first segment: %+v", out[0])
	}
	if out[1].Field != "lastName" || out[1].Dir != "desc" {
		t.Fatalf("second segment: %+v", out[1])
	}
}

func TestParseSortParam_EmptyField(t *testing.T) {
	_, err := parseSortParam(":desc")
	if err == nil {
		t.Fatal("empty field name should be rejected")
	}
}

// ─── decodeJSONBody ─────────────────────────────────────────────────────

func TestDecodeJSONBody_RejectsUnknownFields(t *testing.T) {
	type body struct {
		Name string `json:"name"`
	}
	var dst body
	if err := decodeJSONBody(synthReq(`{"name":"x","extra":"y"}`), &dst); err == nil {
		t.Fatal("unknown field should be rejected")
	}
}

func TestDecodeJSONBody_RejectsOversized(t *testing.T) {
	var buf strings.Builder
	buf.WriteString(`{"name":"`)
	for i := 0; i <= maxRequestBody; i++ {
		buf.WriteByte('x')
	}
	buf.WriteString(`"}`)
	var dst map[string]any
	if err := decodeJSONBody(synthReq(buf.String()), &dst); err == nil {
		t.Fatal("oversized body should be rejected")
	}
}

func TestDecodeJSONBody_RejectsEmpty(t *testing.T) {
	var dst map[string]any
	if err := decodeJSONBody(synthReq(""), &dst); err == nil {
		t.Fatal("empty body should be rejected")
	}
}

func TestDecodeJSONBody_HappyPath(t *testing.T) {
	var dst map[string]any
	if err := decodeJSONBody(synthReq(`{"name":"x","count":3}`), &dst); err != nil {
		t.Fatal(err)
	}
	if dst["name"] != "x" {
		t.Fatalf("unexpected dst: %v", dst)
	}
}

func synthReq(body string) *http.Request {
	return httptest.NewRequest("POST", "/", strings.NewReader(body))
}

var _ = json.Marshal
