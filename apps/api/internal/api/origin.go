package api

import (
	"net/http"
	"strings"
)

func (s *Server) isAllowedOrigin(origin string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" || origin == "null" || strings.HasPrefix(origin, "file://") {
		return true
	}
	for _, allowed := range s.cfg.AllowedOrigins {
		allowed = strings.TrimSpace(allowed)
		if allowed == "*" || allowed == origin {
			return true
		}
	}
	return false
}

func (s *Server) requestOriginAllowed(r *http.Request) (string, bool) {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" || origin == "null" || strings.HasPrefix(origin, "file://") {
		return "", true
	}
	return origin, s.isAllowedOrigin(origin)
}
