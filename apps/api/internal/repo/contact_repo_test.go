package repo

import (
	"strings"
	"testing"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

func TestContact_ImplementsEntity(t *testing.T) {
	var _ Entity = Contact{}
	c := Contact{}
	if c.TableName() != "contacts" {
		t.Fatalf("TableName: %s", c.TableName())
	}
	if col, val := c.SoftDeleteColumn(); col != "status" || val != "archived" {
		t.Fatalf("SoftDeleteColumn: %s/%s", col, val)
	}
	if c.OwnerColumn() != "owner_agent_id" {
		t.Fatalf("OwnerColumn: %s", c.OwnerColumn())
	}
	if c.SharedColumn() != "shared_with_agent_discord_ids" {
		t.Fatalf("SharedColumn: %s", c.SharedColumn())
	}
}

func TestBuildWhere_AdminBypassesVisibility(t *testing.T) {
	scope := ActorScope{ActorDiscordID: "AGENT123", IsAdmin: true}
	where, args, _, err := BuildWhere(Contact{}, nil, scope, false)
	if err != nil {
		t.Fatal(err)
	}
	// Admin: only the soft-delete exclusion should appear.
	if !strings.Contains(where, "status <> $1") {
		t.Fatalf("admin WHERE should exclude archived: %q", where)
	}
	if strings.Contains(where, "owner_agent_id") {
		t.Fatalf("admin WHERE should NOT include visibility predicate: %q", where)
	}
	if len(args) != 1 || args[0] != "archived" {
		t.Fatalf("admin args wrong: %v", args)
	}
}

func TestBuildWhere_NonAdminAppliesVisibility(t *testing.T) {
	scope := ActorScope{ActorDiscordID: "AGENT123", IsAdmin: false}
	where, args, _, err := BuildWhere(Contact{}, nil, scope, false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(where, "contacts.owner_agent_id = $2") {
		t.Fatalf("non-admin WHERE missing owner match: %q", where)
	}
	if !strings.Contains(where, "$2 = ANY(contacts.shared_with_agent_discord_ids)") {
		t.Fatalf("non-admin WHERE missing shared-array match: %q", where)
	}
	if len(args) != 2 || args[0] != "archived" || args[1] != "AGENT123" {
		t.Fatalf("non-admin args wrong: %v", args)
	}
}

func TestBuildWhere_IncludeArchivedSkipsSoftDelete(t *testing.T) {
	scope := ActorScope{ActorDiscordID: "AGENT1", IsAdmin: false}
	where, args, _, err := BuildWhere(Contact{}, nil, scope, true)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(where, "status <>") {
		t.Fatalf("includeArchived=true should skip soft-delete: %q", where)
	}
	// Still has visibility.
	if !strings.Contains(where, "owner_agent_id = $1") {
		t.Fatalf("visibility missing: %q", where)
	}
	if len(args) != 1 || args[0] != "AGENT1" {
		t.Fatalf("args wrong: %v", args)
	}
}

func TestBuildWhere_FilterThenSoftDeleteThenVisibility_ArgOrder(t *testing.T) {
	// Ensure filter args come first, then soft-delete value, then scope.
	// This matters because changing order silently shifts $N bindings.
	filt := &filters.Rule{Field: "firstName", Op: string(filters.OpEq), Value: "John"}
	scope := ActorScope{ActorDiscordID: "AGENT9", IsAdmin: false}
	where, args, _, err := BuildWhere(Contact{}, filt, scope, false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(where, "contacts.first_name = $1") {
		t.Fatalf("filter arg not $1: %q", where)
	}
	if !strings.Contains(where, "status <> $2") {
		t.Fatalf("soft-delete arg not $2: %q", where)
	}
	if !strings.Contains(where, "owner_agent_id = $3") {
		t.Fatalf("scope owner arg not $3: %q", where)
	}
	if got := []any{"John", "archived", "AGENT9"}; !equalArgs(args, got) {
		t.Fatalf("args: got %v want %v", args, got)
	}
}

func TestBuildWhere_PropagatesFilterValidationError(t *testing.T) {
	bad := &filters.Rule{Field: "no_such_field", Op: string(filters.OpEq), Value: "x"}
	scope := ActorScope{ActorDiscordID: "A", IsAdmin: false}
	_, _, _, err := BuildWhere(Contact{}, bad, scope, false)
	if err == nil {
		t.Fatal("expected error for unknown field")
	}
}

func TestBuildWhere_SubtypeFilterIncludesJoin(t *testing.T) {
	// sale.carrier lives on contact_sale_profile; BuildWhere must surface the
	// LEFT JOIN so the caller splices it into the query.
	filt := &filters.Rule{Field: "sale.carrier", Op: string(filters.OpEq), Value: "Aetna"}
	_, _, joins, err := BuildWhere(Contact{}, filt, ActorScope{IsAdmin: true}, false)
	if err != nil {
		t.Fatal(err)
	}
	ok := false
	for _, j := range joins {
		if strings.Contains(j, "contact_sale_profile") {
			ok = true
			break
		}
	}
	if !ok {
		t.Fatalf("expected sale-profile JOIN to be returned, got %v", joins)
	}
}

func TestContact_UpdatableColumnsIsClosedWhitelist(t *testing.T) {
	// Guards against accidental "let handlers patch anything" regressions.
	// id must NEVER be updatable.
	forbidden := []string{"id", "sourceType", "sourceId", "createdAt", "tags", "sharedWithAgentDiscordIds"}
	for _, f := range forbidden {
		if _, ok := updatableColumns[f]; ok {
			t.Fatalf("column %q must NOT be in updatableColumns", f)
		}
	}
	// Smoke check: expected ones are there.
	mustHave := []string{"firstName", "email", "lifecycleStage", "doNotSms", "ownerAgentDiscordId"}
	for _, f := range mustHave {
		if _, ok := updatableColumns[f]; !ok {
			t.Fatalf("column %q expected in updatableColumns", f)
		}
	}
}

func equalArgs(a, b []any) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
