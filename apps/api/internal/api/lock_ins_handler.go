package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"phantomcrm-api/internal/api/websocket"
	"phantomcrm-api/internal/db"
)

// ── Lock-In CRUD ────────────────────────────────────────────────────────────

func (s *Server) handleCreateLockIn(w http.ResponseWriter, r *http.Request) {
	var input db.LockIn
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if input.Name == "" || input.StartDate == "" || input.EndDate == "" || input.City == "" || input.State == "" {
		http.Error(w, "name, startDate, endDate, city, and state are required", http.StatusBadRequest)
		return
	}
	if input.Status == "" {
		input.Status = "planning"
	}
	li, err := s.db.CreateLockIn(r.Context(), input)
	if err != nil {
		log.Printf("CreateLockIn error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.hub.Publish(websocket.NewEvent(websocket.EventLockInCreated, li))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(li)
}

func (s *Server) handleListLockIns(w http.ResponseWriter, r *http.Request) {
	var orgID int64
	fmt.Sscanf(r.URL.Query().Get("org_id"), "%d", &orgID)
	lockIns, err := s.db.ListLockIns(r.Context(), orgID)
	if err != nil {
		log.Printf("ListLockIns error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if lockIns == nil {
		lockIns = []db.LockIn{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lockIns)
}

func (s *Server) handleGetLockIn(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	li, err := s.db.GetLockIn(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(li)
}

func (s *Server) handleUpdateLockIn(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if err := s.db.UpdateLockIn(r.Context(), id, updates); err != nil {
		log.Printf("UpdateLockIn error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.hub.Publish(websocket.NewEvent(websocket.EventLockInUpdated, map[string]string{"id": id}))
	li, _ := s.db.GetLockIn(r.Context(), id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(li)
}

func (s *Server) handleDeleteLockIn(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	if err := s.db.DeleteLockIn(r.Context(), id); err != nil {
		log.Printf("DeleteLockIn error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
}

// ── Partners ────────────────────────────────────────────────────────────────

func (s *Server) handleInvitePartner(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var input struct {
		OrgID   int64  `json:"orgId"`
		OrgName string `json:"orgName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.OrgName == "" {
		http.Error(w, "orgName required", http.StatusBadRequest)
		return
	}
	user := GetAuthUser(r)
	var invitedBy int64
	if user != nil {
		fmt.Sscanf(user.UserID, "%d", &invitedBy)
	}
	partner, err := s.db.InvitePartner(r.Context(), lockInID, input.OrgID, input.OrgName, invitedBy)
	if err != nil {
		log.Printf("InvitePartner error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.hub.Publish(websocket.NewEvent(websocket.EventLockInPartnerInvite, partner))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(partner)
}

func (s *Server) handleRespondPartnerInvite(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	partnerID := r.PathValue("partnerID")
	if lockInID == "" || partnerID == "" {
		http.Error(w, "missing id or partnerID", http.StatusBadRequest)
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Status == "" {
		http.Error(w, "status required", http.StatusBadRequest)
		return
	}
	user := GetAuthUser(r)
	var approvedBy int64
	if user != nil {
		fmt.Sscanf(user.UserID, "%d", &approvedBy)
	}
	if err := s.db.RespondPartnerInvite(r.Context(), partnerID, input.Status, approvedBy); err != nil {
		log.Printf("RespondPartnerInvite error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.hub.Publish(websocket.NewEvent(websocket.EventLockInPartnerResponse, map[string]string{"lockInId": lockInID, "partnerId": partnerID, "status": input.Status}))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": input.Status})
}

// ── Agents ──────────────────────────────────────────────────────────────────

func (s *Server) handleListLockInAgents(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	agents, err := s.db.ListLockInAgents(r.Context(), lockInID)
	if err != nil {
		log.Printf("ListLockInAgents error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if agents == nil {
		agents = []db.LockInAgent{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(agents)
}

func (s *Server) handleAddLockInAgent(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var agent db.LockInAgent
	if err := json.NewDecoder(r.Body).Decode(&agent); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	agent.LockInID = lockInID
	if agent.Status == "" {
		agent.Status = "invited"
	}
	result, err := s.db.AddLockInAgent(r.Context(), agent)
	if err != nil {
		log.Printf("AddLockInAgent error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleUpdateLockInAgent(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("agentID")
	if agentID == "" {
		http.Error(w, "missing agentID", http.StatusBadRequest)
		return
	}
	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if err := s.db.UpdateLockInAgent(r.Context(), agentID, updates); err != nil {
		log.Printf("UpdateLockInAgent error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"updated": true})
}

// ── Budget ──────────────────────────────────────────────────────────────────

func (s *Server) handleGetLockInBudget(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	items, err := s.db.ListBudgetItems(r.Context(), lockInID)
	if err != nil {
		log.Printf("ListBudgetItems error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []db.LockInBudgetItem{}
	}
	summary, _ := s.db.GetBudgetSummary(r.Context(), lockInID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"items":   items,
		"summary": summary,
	})
}

func (s *Server) handleAddBudgetItem(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var item db.LockInBudgetItem
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	item.LockInID = lockInID
	if item.SplitType == "" {
		item.SplitType = "even"
	}
	result, err := s.db.AddBudgetItem(r.Context(), item)
	if err != nil {
		log.Printf("AddBudgetItem error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ── Itinerary ───────────────────────────────────────────────────────────────

func (s *Server) handleGetLockInItinerary(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	items, err := s.db.ListItinerary(r.Context(), lockInID)
	if err != nil {
		log.Printf("ListItinerary error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []db.LockInItineraryItem{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (s *Server) handleAddItineraryItem(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var item db.LockInItineraryItem
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	item.LockInID = lockInID
	if item.Category == "" {
		item.Category = "general"
	}
	result, err := s.db.AddItineraryItem(r.Context(), item)
	if err != nil {
		log.Printf("AddItineraryItem error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ── Lock-In Chat ────────────────────────────────────────────────────────────

func (s *Server) handleLockInChat(w http.ResponseWriter, r *http.Request) {
	lockInID := r.PathValue("id")
	if lockInID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		http.Error(w, "message required", http.StatusBadRequest)
		return
	}

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		http.Error(w, "AI chat not configured", http.StatusServiceUnavailable)
		return
	}

	// Get lock-in context for system prompt
	li, err := s.db.GetLockIn(r.Context(), lockInID)
	if err != nil {
		http.Error(w, "lock-in not found", http.StatusNotFound)
		return
	}

	systemPrompt := fmt.Sprintf(`You are an AI assistant for the lock-in event "%s" in %s, %s (%s to %s).
Estimated headcount: %d. Budget target: $%.2f. Sales goal: $%.2f.
Help plan logistics, calculate budgets, manage itineraries, and coordinate between partner agencies.
You have tools to query lock-in data. Be concise and helpful.`,
		li.Name, li.City, li.State, li.StartDate, li.EndDate,
		li.EstimatedHeadcount, li.BudgetTarget, li.SalesGoal)

	messages := []any{
		map[string]any{"role": "user", "content": req.Message},
	}

	tools := []map[string]any{
		{
			"name":         "get_lock_in_details",
			"description":  "Get the full details of this lock-in event including partners, agent count, and budget total",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":         "get_budget_summary",
			"description":  "Get budget summary with totals by category, per-org split, and per-agent cost",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":         "get_itinerary",
			"description":  "Get the full itinerary for this lock-in event organized by day",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":        "calculate_budget_split",
			"description": "Calculate how the budget should be split among partner orgs based on their headcount",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
	}

	// Tool use loop
	const maxToolIter = 5
	var responseText string

	for iter := 0; iter < maxToolIter; iter++ {
		claudeResp, err := s.callClaudeAPI(r.Context(), apiKey, systemPrompt, messages, tools)
		if err != nil {
			log.Printf("Lock-in Claude API error (iter %d): %v", iter, err)
			http.Error(w, "AI service unavailable", http.StatusServiceUnavailable)
			return
		}

		if claudeResp.StopReason != "tool_use" {
			for _, block := range claudeResp.Content {
				if block.Type == "text" {
					responseText = block.Text
					break
				}
			}
			break
		}

		messages = append(messages, map[string]any{
			"role":    "assistant",
			"content": claudeResp.Content,
		})

		var toolResults []any
		for _, block := range claudeResp.Content {
			if block.Type == "tool_use" {
				result := s.executeLockInToolCall(r, lockInID, block.Name, block.Input)
				resultJSON, _ := json.Marshal(result)
				toolResults = append(toolResults, map[string]any{
					"type":        "tool_result",
					"tool_use_id": block.ID,
					"content":     string(resultJSON),
				})
			}
		}

		messages = append(messages, map[string]any{
			"role":    "user",
			"content": toolResults,
		})
	}

	if responseText == "" {
		responseText = "I processed your request. Is there anything else you'd like to know about this lock-in?"
	}

	// Save to lock-in chat messages
	var userID int64
	fmt.Sscanf(user.UserID, "%d", &userID)
	s.db.AddLockInChatMessage(r.Context(), db.LockInChatMessage{
		LockInID:   lockInID,
		UserID:     userID,
		UserName:   user.UserID,
		Message:    req.Message,
		AIResponse: responseText,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"message": responseText,
	})
}

// executeLockInToolCall runs a lock-in-scoped tool and returns its result.
func (s *Server) executeLockInToolCall(r *http.Request, lockInID, toolName string, input json.RawMessage) any {
	ctx := r.Context()
	switch toolName {
	case "get_lock_in_details":
		li, err := s.db.GetLockIn(ctx, lockInID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return li
	case "get_budget_summary":
		summary, err := s.db.GetBudgetSummary(ctx, lockInID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return summary
	case "get_itinerary":
		items, err := s.db.ListItinerary(ctx, lockInID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return items
	case "calculate_budget_split":
		summary, err := s.db.GetBudgetSummary(ctx, lockInID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		agents, _ := s.db.ListLockInAgents(ctx, lockInID)
		orgCounts := make(map[int64]int)
		for _, a := range agents {
			orgCounts[a.OrgID]++
		}
		splits := make(map[string]float64)
		totalAgents := len(agents)
		if totalAgents > 0 {
			for orgID, count := range orgCounts {
				splits[fmt.Sprintf("%d", orgID)] = summary.Total * float64(count) / float64(totalAgents)
			}
		}
		return map[string]any{
			"total":         summary.Total,
			"totalAgents":   totalAgents,
			"perAgentCost":  summary.PerAgentCost,
			"orgHeadcounts": orgCounts,
			"orgSplits":     splits,
		}
	default:
		return map[string]string{"error": "unknown tool"}
	}
}
