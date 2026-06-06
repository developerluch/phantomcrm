package api

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
)

// contextKey is a private type for context keys in this package.
type contextKey string

const authUserKey contextKey = "authUser"

// GetAuthUser extracts the AuthUser from the request context, or nil if absent.
func GetAuthUser(r *http.Request) *AuthUser {
	v, _ := r.Context().Value(authUserKey).(*AuthUser)
	return v
}

// authMiddleware wraps a handler with Bearer token authentication.
// It supports two modes:
//  1. Legacy API_TOKEN: constant-time compare; injects a synthetic super_admin AuthUser.
//  2. JWT: parses HS256 token; injects the embedded AuthUser.
//
// Diagnostic logging (added 2026-05-12 during backend-split triage) prints
// the rejection reason and token length to make 401 debugging tractable when
// frontend says "I'm sending a Bearer header but still getting 401." Logs
// never contain the token itself.
func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" {
			log.Printf("auth: 401 %s %s — missing Authorization header", r.Method, r.URL.Path)
			jsonError(w, `unauthorized`, http.StatusUnauthorized)
			return
		}
		if !strings.HasPrefix(auth, "Bearer ") {
			log.Printf("auth: 401 %s %s — Authorization header not Bearer scheme (got %q)", r.Method, r.URL.Path, firstWord(auth))
			jsonError(w, `unauthorized`, http.StatusUnauthorized)
			return
		}

		provided := strings.TrimPrefix(auth, "Bearer ")

		// Mode 1: Legacy API token
		if s.cfg.APIToken != "" && subtle.ConstantTimeCompare([]byte(provided), []byte(s.cfg.APIToken)) == 1 {
			superAdmin := &AuthUser{
				UserID:      "system",
				Email:       "system@internal",
				Permissions: []string{"*"},
			}
			ctx := context.WithValue(r.Context(), authUserKey, superAdmin)
			next(w, r.WithContext(ctx))
			return
		}

		// Mode 2: JWT
		if s.cfg.JWTSecret == "" {
			log.Printf("auth: 401 %s %s — JWTSecret is empty in config; cannot validate JWTs", r.Method, r.URL.Path)
			jsonError(w, `unauthorized`, http.StatusUnauthorized)
			return
		}

		user, err := ValidateAccessToken(s.cfg.JWTSecret, provided)
		if err != nil {
			log.Printf("auth: 401 %s %s — JWT validation failed (tokenLen=%d): %v", r.Method, r.URL.Path, len(provided), err)
			jsonError(w, `unauthorized`, http.StatusUnauthorized)
			return
		}
		if user == nil {
			log.Printf("auth: 401 %s %s — ValidateAccessToken returned nil user with nil error", r.Method, r.URL.Path)
			jsonError(w, `unauthorized`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), authUserKey, user)
		next(w, r.WithContext(ctx))
	}
}

// firstWord returns the prefix of s up to (but not including) the first space.
// Used for diagnostic logging — never logs the full Authorization value.
func firstWord(s string) string {
	if i := strings.IndexByte(s, ' '); i >= 0 {
		return s[:i]
	}
	if len(s) > 16 {
		return s[:16] + "…"
	}
	return s
}

// requirePermission returns middleware that checks if the AuthUser has the given permission.
// A wildcard "*" in the user's permissions grants all access.
func requirePermission(perm string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			au := GetAuthUser(r)
			if au == nil {
				jsonError(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			for _, p := range au.Permissions {
				if p == "*" || p == perm {
					next(w, r)
					return
				}
			}

			jsonError(w, "forbidden: missing permission "+perm, http.StatusForbidden)
		}
	}
}

// corsMiddleware adds CORS headers.
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin, allowed := s.requestOriginAllowed(r)
		w.Header().Add("Vary", "Origin")
		if !allowed {
			jsonError(w, "origin not allowed", http.StatusForbidden)
			return
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
