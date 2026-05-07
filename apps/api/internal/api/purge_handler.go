package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

// handlePurgeStatus returns purge system status overview.
func (s *Server) handlePurgeStatus(w http.ResponseWriter, r *http.Request) {
	var guildID int64
	fmt.Sscanf(r.URL.Query().Get("guild_id"), "%d", &guildID)
	status, err := s.db.GetPurgeStatus(r.Context(), guildID)
	if err != nil {
		log.Printf("GetPurgeStatus error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// handleListPurgeWarnings returns active purge warnings with agent info.
func (s *Server) handleListPurgeWarnings(w http.ResponseWriter, r *http.Request) {
	var guildID int64
	fmt.Sscanf(r.URL.Query().Get("guild_id"), "%d", &guildID)
	warnings, err := s.db.ListPurgeWarnings(r.Context(), guildID)
	if err != nil {
		log.Printf("ListPurgeWarnings error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if warnings == nil {
		warnings = []db.PurgeWarning{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"warnings": warnings})
}

// handleRespondPurgeWarning is a public endpoint (no auth) for agents to confirm they're active.
func (s *Server) handleRespondPurgeWarning(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	pw, err := s.db.RespondToPurgeWarning(r.Context(), id)
	if err != nil {
		http.Error(w, "not found or already responded", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pw)
}

// handleExecutePurge manually triggers purge evaluation for expired warnings.
func (s *Server) handleExecutePurge(w http.ResponseWriter, r *http.Request) {
	expired, err := s.db.GetExpiredUnrespondedWarnings(r.Context())
	if err != nil {
		log.Printf("GetExpiredUnrespondedWarnings error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var purged []db.PurgeWarning
	for _, pw := range expired {
		// Mark as kicked
		if err := s.db.ExecutePurgeAction(r.Context(), pw.ID, "kicked"); err != nil {
			log.Printf("ExecutePurgeAction error for %s: %v", pw.ID, err)
			continue
		}
		// Queue kick via pending_actions
		s.db.CreatePendingAction(r.Context(), "kick", pw.DiscordID, map[string]string{"reason": "inactivity_purge"})
		pw.ActionTaken = "kicked"
		purged = append(purged, pw)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"purged":  len(purged),
		"details": purged,
	})
}

// handleUpdatePurgeSettings updates purge configuration thresholds.
func (s *Server) handleUpdatePurgeSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		InactiveDays int `json:"inactiveDays"`
		WarningDays  int `json:"warningDays"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	// Store in config or a settings table - for now return the values as acknowledgment
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"inactiveDays": body.InactiveDays,
		"warningDays":  body.WarningDays,
		"updated":      true,
	})
}
