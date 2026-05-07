package filters

import (
	"strings"
	"testing"
)

func newCtx() *CompileCtx {
	return NewCompileCtx(ContactsEntity, ContactsRegistry())
}

func TestRule_UnknownField_Rejected(t *testing.T) {
	r := &Rule{Field: "made_up_field", Op: string(OpEq), Value: "x"}
	_, err := r.Compile(newCtx())
	if err == nil {
		t.Fatal("expected unknown field to be rejected")
	}
	if !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("error should mention unknown field: %v", err)
	}
}

func TestRule_UnknownOp_Rejected(t *testing.T) {
	r := &Rule{Field: "firstName", Op: "explode", Value: "x"}
	if err := r.Validate(ContactsRegistry()); err == nil {
		t.Fatal("expected unknown op to be rejected at Validate")
	}
}

func TestRule_OpNotAllowedForType_Rejected(t *testing.T) {
	// lifecycleStage's AllowedOps restricts to eq/neq/in/nin — contains should fail.
	r := &Rule{Field: "lifecycleStage", Op: string(OpContains), Value: "lead"}
	_, err := r.Compile(newCtx())
	if err == nil {
		t.Fatal("expected contains on enum field to be rejected")
	}
}

func TestRule_Eq_TextField(t *testing.T) {
	r := &Rule{Field: "firstName", Op: string(OpEq), Value: "John"}
	ctx := newCtx()
	sql, err := r.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if sql != "contacts.first_name = $1" {
		t.Fatalf("unexpected SQL: %q", sql)
	}
	if args := ctx.Args(); len(args) != 1 || args[0] != "John" {
		t.Fatalf("unexpected args: %v", args)
	}
}

func TestRule_Contains_EscapesLikeWildcards(t *testing.T) {
	r := &Rule{Field: "firstName", Op: string(OpContains), Value: "50%_off"}
	ctx := newCtx()
	_, err := r.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	arg := ctx.Args()[0].(string)
	if !strings.Contains(arg, `\%`) || !strings.Contains(arg, `\_`) {
		t.Fatalf("LIKE metachars not escaped: %q", arg)
	}
}

func TestRule_In_RequiresNonEmptyList(t *testing.T) {
	r := &Rule{Field: "lifecycleStage", Op: string(OpIn), Value: []any{}}
	_, err := r.Compile(newCtx())
	if err == nil {
		t.Fatal("expected empty IN list to be rejected")
	}
}

func TestRule_In_EmitsPlaceholders(t *testing.T) {
	r := &Rule{Field: "lifecycleStage", Op: string(OpIn), Value: []any{"lead", "customer"}}
	ctx := newCtx()
	sql, err := r.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if sql != "contacts.lifecycle_stage IN ($1,$2)" {
		t.Fatalf("unexpected SQL: %q", sql)
	}
	if args := ctx.Args(); len(args) != 2 || args[0] != "lead" || args[1] != "customer" {
		t.Fatalf("unexpected args: %v", args)
	}
}

func TestRule_Exists_TrueFalse(t *testing.T) {
	ctx := newCtx()
	sql, err := (&Rule{Field: "email", Op: string(OpExists), Value: true}).Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if sql != "contacts.email IS NOT NULL" {
		t.Fatalf("unexpected SQL: %q", sql)
	}
	sql, err = (&Rule{Field: "email", Op: string(OpExists), Value: false}).Compile(newCtx())
	if err != nil {
		t.Fatal(err)
	}
	if sql != "contacts.email IS NULL" {
		t.Fatalf("unexpected SQL: %q", sql)
	}
}

func TestRule_Tags_EmitsSemiJoin(t *testing.T) {
	r := &Rule{Field: "tags", Op: string(OpHasTag), Value: "vip"}
	ctx := newCtx()
	sql, err := r.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(sql, "EXISTS (SELECT 1 FROM contact_tags") {
		t.Fatalf("expected EXISTS semi-join: %q", sql)
	}
	if ctx.Args()[0] != "vip" {
		t.Fatalf("tag value not bound: %v", ctx.Args())
	}
}

func TestRule_Address_EmitsExistsOnAddresses(t *testing.T) {
	r := &Rule{Field: "address.state", Op: string(OpEq), Value: "CA"}
	ctx := newCtx()
	sql, err := r.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(sql, "EXISTS (SELECT 1 FROM addresses a") {
		t.Fatalf("expected EXISTS on addresses: %q", sql)
	}
	if !strings.Contains(sql, "a.is_primary = true") {
		t.Fatalf("address EXISTS should filter on is_primary: %q", sql)
	}
}

func TestRule_SubtypeField_RegistersJoinOnce(t *testing.T) {
	// Two rules referencing the same subtype should register its JOIN only once.
	g := &Group{Combinator: "and", Children: []FilterNode{
		&Rule{Field: "sale.carrier", Op: string(OpEq), Value: "Aetna"},
		&Rule{Field: "sale.premium", Op: string(OpGte), Value: float64(100)},
	}}
	ctx := newCtx()
	if _, err := g.Compile(ctx); err != nil {
		t.Fatal(err)
	}
	joins := ctx.Joins()
	count := 0
	for _, j := range joins {
		if strings.Contains(j, "contact_sale_profile") {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected contact_sale_profile JOIN deduped to 1, got %d — joins: %v", count, joins)
	}
}

func TestRule_CustomField_ResolvesDynamic(t *testing.T) {
	r := &Rule{Field: "customFields.partner_id", Op: string(OpEq), Value: "X-9"}
	ctx := newCtx()
	sql, err := r.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(sql, "contacts.custom_fields->>'partner_id'") {
		t.Fatalf("custom field SQL wrong: %q", sql)
	}
}

func TestRule_CustomField_RejectsSQLInjection(t *testing.T) {
	r := &Rule{Field: "customFields.foo'; DROP TABLE", Op: string(OpEq), Value: "x"}
	_, err := r.Compile(newCtx())
	if err == nil {
		t.Fatal("expected injection attempt in custom field suffix to be rejected")
	}
}

func TestGroup_And(t *testing.T) {
	g := &Group{Combinator: "and", Children: []FilterNode{
		&Rule{Field: "lifecycleStage", Op: string(OpEq), Value: "lead"},
		&Rule{Field: "firstName", Op: string(OpEq), Value: "John"},
	}}
	ctx := newCtx()
	sql, err := g.Compile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if sql != "(contacts.lifecycle_stage = $1 AND contacts.first_name = $2)" {
		t.Fatalf("unexpected AND SQL: %q", sql)
	}
}

func TestGroup_EmptyRejected(t *testing.T) {
	g := &Group{Combinator: "and"}
	if _, err := g.Compile(newCtx()); err == nil {
		t.Fatal("expected empty group to be rejected")
	}
}

func TestGroup_BadCombinator(t *testing.T) {
	g := &Group{Combinator: "xor", Children: []FilterNode{
		&Rule{Field: "firstName", Op: string(OpEq), Value: "X"},
	}}
	if err := g.Validate(ContactsRegistry()); err == nil {
		t.Fatal("expected invalid combinator to be rejected")
	}
}

// ─── Evaluator ──────────────────────────────────────────────────────────

func TestEvaluator_And_ShortCircuits(t *testing.T) {
	g := &Group{Combinator: "and", Children: []FilterNode{
		&Rule{Field: "lifecycleStage", Op: string(OpEq), Value: "lead"},
		&Rule{Field: "firstName", Op: string(OpEq), Value: "John"},
	}}
	subj := map[string]any{"lifecycleStage": "lead", "firstName": "John"}
	ok, err := g.Evaluate(subj)
	if err != nil || !ok {
		t.Fatalf("expected match, got %v / %v", ok, err)
	}
	subj["firstName"] = "Jane"
	ok, _ = g.Evaluate(subj)
	if ok {
		t.Fatal("expected non-match after firstName change")
	}
}

func TestEvaluator_Contains_CaseInsensitive(t *testing.T) {
	r := &Rule{Field: "email", Op: string(OpContains), Value: "EXAMPLE"}
	ok, err := r.Evaluate(map[string]any{"email": "jane@example.com"})
	if err != nil || !ok {
		t.Fatalf("expected case-insensitive contains match: %v / %v", ok, err)
	}
}

func TestEvaluator_Tags_HasAndLacks(t *testing.T) {
	subj := map[string]any{"tags": []string{"vip", "2024"}}
	r := &Rule{Field: "tags", Op: string(OpHasTag), Value: "vip"}
	ok, _ := r.Evaluate(subj)
	if !ok {
		t.Fatal("expected hasTag vip to match")
	}
	r = &Rule{Field: "tags", Op: string(OpLacksTag), Value: "churned"}
	ok, _ = r.Evaluate(subj)
	if !ok {
		t.Fatal("expected lacksTag churned to match")
	}
}

func TestEvaluator_MissingField_ExistsSemantics(t *testing.T) {
	subj := map[string]any{}
	// exists=false on a missing field → true
	r := &Rule{Field: "email", Op: string(OpExists), Value: false}
	ok, _ := r.Evaluate(subj)
	if !ok {
		t.Fatal("expected exists=false on missing field to match")
	}
	// any comparison on a missing field → false
	r = &Rule{Field: "email", Op: string(OpEq), Value: "x"}
	ok, _ = r.Evaluate(subj)
	if ok {
		t.Fatal("expected eq on missing field to be false")
	}
}
