package api

import (
	"log"
	"net/http"
	"strconv"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleListAuditEntries(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0

	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}
	if offsetStr != "" {
		if v, err := strconv.Atoi(offsetStr); err == nil && v >= 0 {
			offset = v
		}
	}

	entries, err := s.db.ListAuditEntries(r.Context(), limit, offset)
	if err != nil {
		log.Printf("API: failed to list audit entries: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if entries == nil {
		entries = []db.AuditEntry{}
	}
	jsonOK(w, entries)
}
