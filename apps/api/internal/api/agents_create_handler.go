package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// RegisterNoDiscordRoutes mounts fallbacks for routes that the Discord package
// normally provides. Call it only when Discord is not configured, otherwise the
// Discord-backed handlers own these paths.
func (s *Server) RegisterNoDiscordRoutes() {
	auth := s.AuthMiddleware()
	s.Mux().HandleFunc("POST /api/v1/agents", auth(s.handleCreateAgentNoDiscord))
}

// handleCreateAgentNoDiscord creates a new agent from the dashboard without
// validating the id against a Discord guild.
//
// The agent's primary key is a numeric id (historically a Discord user id, the
// column is still named discord_id). The caller supplies the id together with
// the agent's name.
func (s *Server) handleCreateAgentNoDiscord(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var req struct {
		AgentID   string `json:"agentId"`
		DiscordID string `json:"discordId"` // legacy field name accepted for compatibility
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		State     string `json:"state"`
		Agency    string `json:"agency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	id := req.AgentID
	if id == "" {
		id = req.DiscordID
	}
	if id == "" || req.FirstName == "" || req.LastName == "" {
		jsonError(w, "agentId, firstName, and lastName are required", http.StatusBadRequest)
		return
	}
	agentID, err := strconv.ParseInt(id, 10, 64)
	if err != nil || agentID <= 0 {
		jsonError(w, "agentId must be a positive integer", http.StatusBadRequest)
		return
	}
	orgID := s.cfg.GuildIDInt()

	existing, _ := s.db.GetAgent(ctx, agentID)
	if existing != nil {
		jsonError(w, "agent already exists", http.StatusConflict)
		return
	}

	stage := db.StageWelcome
	update := db.AgentUpdate{
		FirstName:    &req.FirstName,
		LastName:     &req.LastName,
		CurrentStage: &stage,
	}
	if req.State != "" {
		update.State = &req.State
	}
	if req.Agency != "" {
		update.Agency = &req.Agency
	}

	if err := s.db.UpsertAgent(ctx, agentID, orgID, update); err != nil {
		log.Printf("API: failed to create agent %s: %v", id, err)
		jsonError(w, "failed to create agent", http.StatusInternalServerError)
		return
	}
	_, _ = s.db.GetOrCreateProfile(ctx, id)

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventAgentCreated, websocket.AgentCreatedData{
			DiscordID:   id,
			DisplayName: req.FirstName + " " + req.LastName,
			Stage:       stage,
			CreatedBy:   "admin_portal",
		}))
	}

	agent, err := s.db.GetAgent(ctx, agentID)
	if err != nil || agent == nil {
		jsonError(w, "agent created but could not fetch", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(agent)
}
