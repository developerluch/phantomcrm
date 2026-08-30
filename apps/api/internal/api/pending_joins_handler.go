package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// handleListPendingJoins returns pending join requests filtered by guild_id query param.
func (s *Server) handleListPendingJoins(w http.ResponseWriter, r *http.Request) {
	guildIDStr := r.URL.Query().Get("guild_id")
	var guildID int64
	if guildIDStr != "" {
		fmt.Sscanf(guildIDStr, "%d", &guildID)
	}
	joins, err := s.db.ListPendingJoins(r.Context(), guildID)
	if err != nil {
		log.Printf("ListPendingJoins error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if joins == nil {
		joins = []db.PendingJoin{}
	}
	count, _ := s.db.CountPendingJoins(r.Context(), guildID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"pendingJoins": joins,
		"totalPending": count,
	})
}

// handleApprovePendingJoin approves a pending join and queues agent creation + role assignment.
func (s *Server) handleApprovePendingJoin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	user := GetAuthUser(r)
	reviewedBy := ""
	if user != nil {
		reviewedBy = user.Email
		if reviewedBy == "" {
			reviewedBy = user.UserID
		}
	}
	pj, err := s.db.ApprovePendingJoin(r.Context(), id, reviewedBy)
	if err != nil {
		log.Printf("ApprovePendingJoin error: %v", err)
		http.Error(w, "not found or already reviewed", http.StatusNotFound)
		return
	}

	// Create agent record
	s.db.UpsertAgent(r.Context(), pj.DiscordID, pj.GuildID, db.AgentUpdate{})

	// Queue role assignment via pending_actions
	s.db.CreatePendingAction(r.Context(), "role", pj.DiscordID, map[string]string{"action": "add"})

	// Broadcast WebSocket event
	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent("pending_join_approved", pj))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pj)
}

// handleRejectPendingJoin rejects a pending join and optionally queues a kick.
func (s *Server) handleRejectPendingJoin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	user := GetAuthUser(r)
	reviewedBy := ""
	if user != nil {
		reviewedBy = user.Email
		if reviewedBy == "" {
			reviewedBy = user.UserID
		}
	}

	var body struct {
		Kick bool `json:"kick"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	pj, err := s.db.RejectPendingJoin(r.Context(), id, reviewedBy)
	if err != nil {
		log.Printf("RejectPendingJoin error: %v", err)
		http.Error(w, "not found or already reviewed", http.StatusNotFound)
		return
	}

	// Optionally kick from Discord
	if body.Kick {
		s.db.CreatePendingAction(r.Context(), "kick", pj.DiscordID, map[string]string{"reason": "join_rejected"})
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent("pending_join_rejected", pj))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pj)
}

// handleBulkPendingJoins handles bulk approve/reject operations.
func (s *Server) handleBulkPendingJoins(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs    []string `json:"ids"`
		Action string   `json:"action"` // "approve" or "reject"
		Kick   bool     `json:"kick"`   // only for reject
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if len(body.IDs) == 0 || (body.Action != "approve" && body.Action != "reject") {
		http.Error(w, "ids required, action must be 'approve' or 'reject'", http.StatusBadRequest)
		return
	}

	user := GetAuthUser(r)
	reviewedBy := ""
	if user != nil {
		reviewedBy = user.Email
		if reviewedBy == "" {
			reviewedBy = user.UserID
		}
	}

	status := "approved"
	if body.Action == "reject" {
		status = "rejected"
	}

	results, err := s.db.BulkUpdatePendingJoins(r.Context(), body.IDs, status, reviewedBy)
	if err != nil {
		log.Printf("BulkUpdatePendingJoins error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	for _, pj := range results {
		if body.Action == "approve" {
			s.db.UpsertAgent(r.Context(), pj.DiscordID, pj.GuildID, db.AgentUpdate{})
			s.db.CreatePendingAction(r.Context(), "role", pj.DiscordID, map[string]string{"action": "add"})
		} else if body.Kick {
			s.db.CreatePendingAction(r.Context(), "kick", pj.DiscordID, map[string]string{"reason": "join_rejected"})
		}
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent("pending_joins_bulk_"+body.Action, results))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"updated": results,
		"count":   len(results),
	})
}
