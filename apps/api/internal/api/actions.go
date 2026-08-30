package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// --- Request bodies ---

type kickRequest struct {
	Reason string `json:"reason"`
}

type nudgeRequest struct {
	Message string `json:"message"`
}

type roleRequest struct {
	RoleID string `json:"role_id"`
	Action string `json:"action"` // "assign" or "remove"
}

type messageRequest struct {
	Message string `json:"message"`
}

type stageRequest struct {
	Stage int `json:"stage"`
}

type approvalActionRequest struct {
	Action string `json:"action"` // "approve" or "deny"
	Reason string `json:"reason,omitempty"`
}

// --- Handlers (queue Discord actions via pending_actions table) ---

// handleKickAgent queues a kick action for the bot to execute.
func (s *Server) handleKickAgent(w http.ResponseWriter, r *http.Request) {
	discordID := r.PathValue("discordID")
	if discordID == "" {
		jsonError(w, "missing discordID", http.StatusBadRequest)
		return
	}

	var req kickRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	reason := req.Reason
	if reason == "" {
		reason = "Kicked via admin portal"
	}

	discordIDInt, _ := strconv.ParseInt(discordID, 10, 64)

	actionID, err := s.db.CreatePendingAction(r.Context(), "kick", discordIDInt, map[string]string{
		"reason": reason,
	})
	if err != nil {
		log.Printf("API: failed to queue kick for %s: %v", discordID, err)
		jsonError(w, "failed to queue kick action", http.StatusInternalServerError)
		return
	}

	// Log activity
	if discordIDInt != 0 {
		s.db.LogActivity(context.Background(), discordIDInt, "kick_queued", "Kick queued via admin portal: "+reason)
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventAgentKicked, websocket.AgentKickedData{
			DiscordID: discordID,
			Reason:    reason,
			KickedBy:  "admin_portal",
		}))
	}

	jsonOK(w, map[string]interface{}{"status": "queued", "action_id": actionID, "discord_id": discordID})
}

// handleNudgeAgent queues a DM nudge for the bot to send.
func (s *Server) handleNudgeAgent(w http.ResponseWriter, r *http.Request) {
	discordID := r.PathValue("discordID")
	if discordID == "" {
		jsonError(w, "missing discordID", http.StatusBadRequest)
		return
	}

	var req nudgeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		jsonError(w, "message is required", http.StatusBadRequest)
		return
	}

	discordIDInt, _ := strconv.ParseInt(discordID, 10, 64)

	actionID, err := s.db.CreatePendingAction(r.Context(), "nudge", discordIDInt, map[string]string{
		"message": req.Message,
	})
	if err != nil {
		log.Printf("API: failed to queue nudge for %s: %v", discordID, err)
		jsonError(w, "failed to queue nudge action", http.StatusInternalServerError)
		return
	}

	if discordIDInt != 0 {
		s.db.LogActivity(context.Background(), discordIDInt, "nudge_queued", "Nudge queued via admin portal")
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventAgentNudged, websocket.AgentNudgedData{
			DiscordID: discordID,
			Message:   req.Message,
			NudgedBy:  "admin_portal",
		}))
	}

	jsonOK(w, map[string]interface{}{"status": "queued", "action_id": actionID, "discord_id": discordID})
}

// handleRoleAgent queues a role assign/remove for the bot to execute.
func (s *Server) handleRoleAgent(w http.ResponseWriter, r *http.Request) {
	discordID := r.PathValue("discordID")
	if discordID == "" {
		jsonError(w, "missing discordID", http.StatusBadRequest)
		return
	}

	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RoleID == "" || (req.Action != "assign" && req.Action != "remove") {
		jsonError(w, "role_id and action (assign/remove) required", http.StatusBadRequest)
		return
	}

	discordIDInt, _ := strconv.ParseInt(discordID, 10, 64)

	actionID, err := s.db.CreatePendingAction(r.Context(), "role", discordIDInt, map[string]string{
		"role_id": req.RoleID,
		"action":  req.Action,
	})
	if err != nil {
		log.Printf("API: failed to queue role action for %s: %v", discordID, err)
		jsonError(w, "failed to queue role action", http.StatusInternalServerError)
		return
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventRoleAssigned, websocket.RoleAssignedData{
			DiscordID:  discordID,
			RoleID:     req.RoleID,
			Action:     req.Action,
			AssignedBy: "admin_portal",
		}))
	}

	jsonOK(w, map[string]interface{}{"status": "queued", "action_id": actionID, "discord_id": discordID, "role_id": req.RoleID})
}

// handleMessageAgent queues a DM for the bot to send.
func (s *Server) handleMessageAgent(w http.ResponseWriter, r *http.Request) {
	discordID := r.PathValue("discordID")
	if discordID == "" {
		jsonError(w, "missing discordID", http.StatusBadRequest)
		return
	}

	var req messageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		jsonError(w, "message is required", http.StatusBadRequest)
		return
	}

	discordIDInt, _ := strconv.ParseInt(discordID, 10, 64)

	actionID, err := s.db.CreatePendingAction(r.Context(), "message", discordIDInt, map[string]string{
		"message": req.Message,
	})
	if err != nil {
		log.Printf("API: failed to queue message for %s: %v", discordID, err)
		jsonError(w, "failed to queue message action", http.StatusInternalServerError)
		return
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventMessageSent, websocket.MessageSentData{
			DiscordID: discordID,
			Message:   req.Message,
			SentBy:    "admin_portal",
		}))
	}

	jsonOK(w, map[string]interface{}{"status": "queued", "action_id": actionID, "discord_id": discordID})
}

// handleStageAgent manually sets an agent's pipeline stage (pure DB, no Discord needed).
func (s *Server) handleStageAgent(w http.ResponseWriter, r *http.Request) {
	discordID := r.PathValue("discordID")
	if discordID == "" {
		jsonError(w, "missing discordID", http.StatusBadRequest)
		return
	}

	var req stageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Stage < 1 || req.Stage > 8 {
		jsonError(w, "stage must be 1-8", http.StatusBadRequest)
		return
	}

	discordIDInt, err := strconv.ParseInt(discordID, 10, 64)
	if err != nil {
		jsonError(w, "invalid discordID", http.StatusBadRequest)
		return
	}

	// Use 0 for guildID since standalone API doesn't track guild
	s.db.UpsertAgent(context.Background(), discordIDInt, 0, db.AgentUpdate{
		CurrentStage: &req.Stage,
	})
	s.db.LogActivity(context.Background(), discordIDInt, "stage_changed_api", "Stage set to "+strconv.Itoa(req.Stage)+" via admin portal")

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventStageChanged, websocket.StageChangedData{
			DiscordID: discordID,
			NewStage:  req.Stage,
			ChangedBy: "admin_portal",
		}))
	}

	jsonOK(w, map[string]string{"status": "updated", "discord_id": discordID, "stage": strconv.Itoa(req.Stage)})
}

// handleApprovalAction approves or denies an approval request (pure DB, no Discord needed).
func (s *Server) handleApprovalAction(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		jsonError(w, "invalid approval id", http.StatusBadRequest)
		return
	}

	var req approvalActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Action != "approve" && req.Action != "deny") {
		jsonError(w, "action must be 'approve' or 'deny'", http.StatusBadRequest)
		return
	}

	var dbErr error
	status := "approved"
	if req.Action == "approve" {
		dbErr = s.db.ApproveAgent(context.Background(), id)
	} else {
		status = "denied"
		dbErr = s.db.DenyAgent(context.Background(), id, req.Reason)
	}
	if dbErr != nil {
		jsonError(w, "failed to update approval: "+dbErr.Error(), http.StatusInternalServerError)
		return
	}

	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent(websocket.EventApprovalUpdated, websocket.ApprovalUpdatedData{
			ApprovalID: id,
			Action:     status,
			ActionBy:   "admin_portal",
		}))
	}

	jsonOK(w, map[string]string{"status": status, "approval_id": idStr})
}

// --- Internal endpoints (bot polls these) ---

// handleGetPendingActions returns all unprocessed actions for the bot to execute.
func (s *Server) handleGetPendingActions(w http.ResponseWriter, r *http.Request) {
	actions, err := s.db.GetPendingActions(r.Context())
	if err != nil {
		log.Printf("API: failed to get pending actions: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if actions == nil {
		actions = []db.PendingAction{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(actions)
}

// handleCompleteAction marks a pending action as completed or failed.
func (s *Server) handleCompleteAction(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		jsonError(w, "invalid action id", http.StatusBadRequest)
		return
	}

	var body struct {
		Error string `json:"error,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if err := s.db.CompletePendingAction(r.Context(), id, body.Error); err != nil {
		log.Printf("API: failed to complete action %d: %v", id, err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "completed", "action_id": idStr})
}

// --- Helpers ---

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
