package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/developerluch/phantomcrm/apps/api/internal/config"
)

func TestOriginPolicyAllowsConfiguredAndNativeOrigins(t *testing.T) {
	s := &Server{cfg: &config.Config{AllowedOrigins: []string{"http://localhost:5173", "https://app.example.com"}}}

	cases := []struct {
		name   string
		origin string
		want   bool
	}{
		{name: "configured localhost", origin: "http://localhost:5173", want: true},
		{name: "configured production", origin: "https://app.example.com", want: true},
		{name: "empty native request", origin: "", want: true},
		{name: "null native request", origin: "null", want: true},
		{name: "file packaged electron", origin: "file://", want: true},
		{name: "disallowed browser", origin: "https://evil.example.com", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := s.isAllowedOrigin(tc.origin); got != tc.want {
				t.Fatalf("isAllowedOrigin(%q) = %v, want %v", tc.origin, got, tc.want)
			}
		})
	}
}

func TestCORSMiddlewareEchoesAllowedOrigin(t *testing.T) {
	s := &Server{cfg: &config.Config{AllowedOrigins: []string{"http://localhost:5173"}}}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()

	s.corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want configured origin", got)
	}
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("Vary = %q, want Origin", got)
	}
}

func TestCORSMiddlewareRejectsDisallowedOrigin(t *testing.T) {
	s := &Server{cfg: &config.Config{AllowedOrigins: []string{"http://localhost:5173"}}}
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()

	s.corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next handler should not run for disallowed origin")
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}
