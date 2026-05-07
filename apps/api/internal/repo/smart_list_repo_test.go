package repo

import (
	"encoding/json"
	"testing"
)

func TestSmartList_ImplementsEntity(t *testing.T) {
	var _ Entity = SmartList{}
	sl := SmartList{}
	if sl.TableName() != "smart_lists" {
		t.Fatalf("TableName: %s", sl.TableName())
	}
	if col, val := sl.SoftDeleteColumn(); col != "" || val != "" {
		t.Fatalf("smart_lists is hard-delete, SoftDeleteColumn should be zero-values; got %q/%q", col, val)
	}
	if sl.OwnerColumn() != "owner_agent_discord_id" {
		t.Fatalf("OwnerColumn: %s", sl.OwnerColumn())
	}
	if sl.SharedColumn() != "shared_with_agent_ids" {
		t.Fatalf("SharedColumn: %s", sl.SharedColumn())
	}
}

func TestSmartListUpdatable_IsClosedWhitelist(t *testing.T) {
	// Owner, id, createdAt, filter_json column names via raw SQL must NEVER
	// be patchable through the map route. (filter is keyed as "filter" in
	// the map, which is fine; that's a known client-facing alias.)
	forbidden := []string{"id", "owner", "ownerAgentDiscordId", "createdAt", "updatedAt", "filter_json"}
	for _, f := range forbidden {
		if _, ok := smartListUpdatable[f]; ok {
			t.Fatalf("column %q must NOT be in smartListUpdatable", f)
		}
	}
	mustHave := []string{"name", "description", "sharedWithAgentIds", "isPinned", "filter"}
	for _, f := range mustHave {
		if _, ok := smartListUpdatable[f]; !ok {
			t.Fatalf("column %q expected in smartListUpdatable", f)
		}
	}
}

func TestCoerceJSONBytes_ValidShapes(t *testing.T) {
	cases := []any{
		[]byte(`{"a":1}`),
		`{"a":1}`,
		map[string]any{"a": 1},
	}
	for _, c := range cases {
		b, err := coerceJSONBytes(c)
		if err != nil {
			t.Fatalf("coerceJSONBytes(%v) err: %v", c, err)
		}
		if !json.Valid(b) {
			t.Fatalf("coerceJSONBytes(%v) returned invalid JSON: %s", c, b)
		}
	}
}

func TestCoerceJSONBytes_InvalidShapes(t *testing.T) {
	if _, err := coerceJSONBytes([]byte("not json")); err == nil {
		t.Fatal("expected invalid JSON bytes to be rejected")
	}
	if _, err := coerceJSONBytes("also not json"); err == nil {
		t.Fatal("expected invalid JSON string to be rejected")
	}
}

func TestCoerceStringArray(t *testing.T) {
	arr, err := coerceStringArray([]any{"a", "b"})
	if err != nil || len(arr) != 2 || arr[0] != "a" || arr[1] != "b" {
		t.Fatalf("coerceStringArray([]any): %v / %v", arr, err)
	}
	arr, err = coerceStringArray([]string{"x", "y"})
	if err != nil || len(arr) != 2 || arr[0] != "x" || arr[1] != "y" {
		t.Fatalf("coerceStringArray([]string): %v / %v", arr, err)
	}
	if _, err := coerceStringArray([]any{"a", 2}); err == nil {
		t.Fatal("expected mixed-type array to be rejected")
	}
	if _, err := coerceStringArray("not an array"); err == nil {
		t.Fatal("expected string scalar to be rejected")
	}
}
