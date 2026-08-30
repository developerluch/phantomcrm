package repo

import (
	"context"
	"errors"
	"testing"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

// Filter used across bulk tests — any valid filter will do; the tests below
// exercise validation that fires BEFORE BuildWhere runs.
func okFilter() filters.FilterNode {
	return &filters.Rule{Field: "lifecycleStage", Op: string(filters.OpEq), Value: "lead"}
}

func TestDispatchBulk_NilFilter_Rejected(t *testing.T) {
	req := BulkRequest{Action: BulkArchive, Filter: nil, Scope: ActorScope{IsAdmin: true}}
	_, err := DispatchBulk(context.Background(), nil, req)
	if !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("expected ErrInvalidPayload for nil filter, got %v", err)
	}
}

func TestValidateLifecycle_AcceptsEnumOnly(t *testing.T) {
	for _, ok := range []string{"lead", "prospect", "customer", "agent", "churned"} {
		if _, err := validateLifecycle(map[string]any{"lifecycleStage": ok}); err != nil {
			t.Fatalf("valid stage %q rejected: %v", ok, err)
		}
	}
	for _, bad := range []string{"", "invalid", "LEAD", "' OR 1=1"} {
		_, err := validateLifecycle(map[string]any{"lifecycleStage": bad})
		if !errors.Is(err, ErrInvalidPayload) {
			t.Fatalf("invalid stage %q should be ErrInvalidPayload, got %v", bad, err)
		}
	}
}

func TestValidateLifecycle_MissingKey(t *testing.T) {
	_, err := validateLifecycle(map[string]any{})
	if !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("missing key should be ErrInvalidPayload: %v", err)
	}
}

func TestValidateLifecycle_WrongType(t *testing.T) {
	_, err := validateLifecycle(map[string]any{"lifecycleStage": 42})
	if !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("non-string should be ErrInvalidPayload: %v", err)
	}
}

func TestValidateOwner_EmptyRejected(t *testing.T) {
	_, err := validateOwner(map[string]any{"ownerAgentDiscordId": ""})
	if !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("empty owner should be ErrInvalidPayload: %v", err)
	}
}

func TestValidateOwner_NonStringRejected(t *testing.T) {
	_, err := validateOwner(map[string]any{"ownerAgentDiscordId": 123})
	if !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("non-string owner should be ErrInvalidPayload: %v", err)
	}
}

func TestValidateTag_LengthCapped(t *testing.T) {
	// 65 chars — one over the 64 limit.
	long := ""
	for i := 0; i < 65; i++ {
		long += "a"
	}
	_, err := validateTag(map[string]any{"tag": long})
	if !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("over-length tag should be ErrInvalidPayload: %v", err)
	}
}

func TestValidateTag_BlankRejected(t *testing.T) {
	for _, bad := range []any{"", "   ", 42, nil} {
		_, err := validateTag(map[string]any{"tag": bad})
		if !errors.Is(err, ErrInvalidPayload) {
			t.Fatalf("invalid tag %v should be ErrInvalidPayload: %v", bad, err)
		}
	}
}

func TestValidateTag_Trimmed(t *testing.T) {
	out, err := validateTag(map[string]any{"tag": "   vip   "})
	if err != nil {
		t.Fatal(err)
	}
	if out != "vip" {
		t.Fatalf("expected trimmed tag, got %q", out)
	}
}

// ─── Injection via payload ──────────────────────────────────────────────

func TestDispatchBulk_SQLInjectionInPayload_BoundNotConcatenated(t *testing.T) {
	// The attempt is that an attacker sets lifecycleStage to a SQL fragment.
	// validateLifecycle enforces an enum before any SQL runs, so we never
	// reach the driver with this value. This test asserts that rejection
	// path — the enum whitelist is the defence.
	attempts := []string{
		"' OR 1=1 --",
		"lead'; DROP TABLE contacts; --",
		"lead\\",
		"lead\u0000",
	}
	for _, a := range attempts {
		_, err := validateLifecycle(map[string]any{"lifecycleStage": a})
		if !errors.Is(err, ErrInvalidPayload) {
			t.Fatalf("injection-shape %q should be rejected at validate, got %v", a, err)
		}
	}
}

// ─── Cap constant sanity ────────────────────────────────────────────────

func TestMaxBulkAffected_IsFiveHundred(t *testing.T) {
	// Locked at 500 per plan hard rule. Regression guard.
	if MaxBulkAffected != 500 {
		t.Fatalf("MaxBulkAffected drifted: got %d want 500", MaxBulkAffected)
	}
}
