package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/developerluch/phantomcrm/apps/api/internal/channels"
	"github.com/developerluch/phantomcrm/apps/api/internal/repo"
)

func TestWriteChannelError_Mapping(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"template required → 422", channels.ErrTemplateRequired, 422},
		{"opted out → 409", channels.ErrOptedOut, 409},
		{"invalid recipient → 400", channels.ErrInvalidRecipient, 400},
		{"unsupported → 501", channels.ErrUnsupported, 501},
		{"rate limit → 429", channels.ErrRateLimit, 429},
		{"provider down → 502", channels.ErrProviderDown, 502},
		{"permanent → 422", channels.ErrPermanent, 422},
		{"transient → 503", channels.ErrTransient, 503},
		{"unwrapped (random) → 500", errors.New("kaboom"), 500},
		{"wrapped opted-out → 409", fmt.Errorf("send: %w", channels.ErrOptedOut), 409},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeChannelError(rec, tc.err)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d", rec.Code, tc.want)
			}
			// Body must be a JSON {error: ...} blob, never raw text.
			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if !strings.Contains(strings.ToLower(body["error"]), "channels:") &&
				!strings.Contains(strings.ToLower(body["error"]), "kaboom") {
				t.Fatalf("error body should reflect channel error or wrapped message, got %q", body["error"])
			}
		})
	}
}

func TestWriteRepoError_Mapping(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"not found → 404", repo.ErrNotFound, 404},
		{"scoped → 403", repo.ErrScoped, 403},
		{"invalid payload → 400", repo.ErrInvalidPayload, 400},
		{"random → 500", errors.New("boom"), 500},
		{"wrapped not-found → 404", fmt.Errorf("get conv: %w", repo.ErrNotFound), 404},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeRepoError(rec, tc.err)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d", rec.Code, tc.want)
			}
		})
	}
}

func TestNullStringValue(t *testing.T) {
	if nullStringValue("") != nil {
		t.Fatalf("empty must return nil")
	}
	if nullStringValue("   ") != nil {
		t.Fatalf("whitespace must return nil")
	}
	got := nullStringValue("abc")
	if got == nil || *got != "abc" {
		t.Fatalf("nullStringValue(abc) = %v, want *abc", got)
	}
}

func TestStringPtr_FirstNonEmpty(t *testing.T) {
	if stringPtr("", "") != nil {
		t.Fatalf("all empty must return nil")
	}
	got := stringPtr("", "+15551234567", "fallback@example.com")
	if got == nil || *got != "+15551234567" {
		t.Fatalf("stringPtr should pick the first non-empty, got %v", got)
	}
}
