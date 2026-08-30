package api

import (
	"encoding/json"
	"testing"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func TestAIToolMetadataClassifiesReadOnlyAndMutationTools(t *testing.T) {
	cases := []struct {
		name     string
		tool     string
		input    json.RawMessage
		category string
		mutates  bool
	}{
		{name: "analytics read only", tool: "get_dashboard_summary", category: "analytics", mutates: false},
		{name: "expense mutation", tool: "manage_expense", input: json.RawMessage(`{"action":"create"}`), category: "expenses", mutates: true},
		{name: "sales mutation", tool: "create_sale", category: "sales", mutates: true},
		{name: "document list stays read only", tool: "manage_documents", input: json.RawMessage(`{"action":"list"}`), category: "documents", mutates: false},
		{name: "document create mutates", tool: "manage_documents", input: json.RawMessage(`{"action":"create"}`), category: "documents", mutates: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := aiToolMetadata(tc.tool, tc.input)
			if got.Category != tc.category {
				t.Fatalf("category = %q, want %q", got.Category, tc.category)
			}
			if got.Mutates != tc.mutates {
				t.Fatalf("mutates = %v, want %v", got.Mutates, tc.mutates)
			}
		})
	}
}

func TestAICategoryEnabledRequiresExplicitEnabledCategory(t *testing.T) {
	settings := &db.AISettings{
		FullTrustMode: false,
		Categories: map[string]bool{
			"analytics": true,
			"sales":     false,
		},
	}

	if !aiCategoryEnabled(settings, "analytics") {
		t.Fatal("analytics should be enabled")
	}
	if aiCategoryEnabled(settings, "sales") {
		t.Fatal("sales should be disabled")
	}
	if aiCategoryEnabled(settings, "unknown") {
		t.Fatal("unknown category should be disabled")
	}
	if aiCategoryEnabled(nil, "analytics") {
		t.Fatal("nil settings should disable all categories")
	}
}

func TestToolResultErrorExtractsStructuredErrors(t *testing.T) {
	if got := toolResultError(map[string]string{"error": "bad input"}); got != "bad input" {
		t.Fatalf("string map error = %q", got)
	}
	if got := toolResultError(map[string]any{"error": "failed"}); got != "failed" {
		t.Fatalf("any map error = %q", got)
	}
	if got := toolResultError(map[string]any{"ok": true}); got != "" {
		t.Fatalf("non-error result = %q, want empty", got)
	}
}
