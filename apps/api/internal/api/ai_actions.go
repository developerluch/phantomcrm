package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

type aiToolMeta struct {
	Category string
	Mutates  bool
}

type chatActionSummary struct {
	ID                   string          `json:"id"`
	Type                 string          `json:"type"`
	ActionType           string          `json:"actionType"`
	Category             string          `json:"category"`
	Status               string          `json:"status"`
	Data                 json.RawMessage `json:"data,omitempty"`
	InputJSON            json.RawMessage `json:"inputJson,omitempty"`
	ResultJSON           json.RawMessage `json:"resultJson,omitempty"`
	Error                string          `json:"error,omitempty"`
	RequiresConfirmation bool            `json:"requiresConfirmation"`
	CreatedAt            time.Time       `json:"createdAt"`
	ConfirmedAt          *time.Time      `json:"confirmedAt,omitempty"`
	ExecutedAt           *time.Time      `json:"executedAt,omitempty"`
}

func (s *Server) handleGetAISettings(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	settings, err := s.db.GetAISettings(r.Context(), user.UserID)
	if err != nil {
		log.Printf("GetAISettings error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, settings)
}

func (s *Server) handleUpdateAISettings(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req db.AISettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid settings", http.StatusBadRequest)
		return
	}
	settings, err := s.db.UpdateAISettings(r.Context(), user.UserID, req)
	if err != nil {
		log.Printf("UpdateAISettings error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, settings)
}

func (s *Server) handleListChatActions(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	actions, err := s.db.ListAIActionRequests(r.Context(), user.UserID, r.URL.Query().Get("conversationId"))
	if err != nil {
		log.Printf("ListAIActionRequests error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	summaries := make([]chatActionSummary, 0, len(actions))
	for _, action := range actions {
		summaries = append(summaries, chatActionSummaryFromDB(action))
	}
	jsonOK(w, map[string]any{"actions": summaries})
}

func (s *Server) handleConfirmChatAction(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	action, err := s.db.GetAIActionRequest(r.Context(), r.PathValue("actionID"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			jsonError(w, "action not found", http.StatusNotFound)
			return
		}
		log.Printf("GetAIActionRequest error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if action.UserID != user.UserID {
		jsonError(w, "action not found", http.StatusNotFound)
		return
	}
	if action.Status != db.AIActionStatusPending {
		jsonError(w, "action is not pending", http.StatusConflict)
		return
	}
	settings, err := s.db.GetAISettings(r.Context(), user.UserID)
	if err != nil {
		log.Printf("GetAISettings error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if !aiCategoryEnabled(settings, action.Category) {
		jsonOK(w, map[string]any{
			"action": chatActionSummaryFromDB(*action),
			"error": map[string]string{
				"code":     "ai_category_disabled",
				"category": action.Category,
				"message":  "AI access is disabled for this category.",
			},
		})
		return
	}

	executing, err := s.db.MarkAIActionExecuting(r.Context(), action.ID, true)
	if err != nil {
		log.Printf("MarkAIActionExecuting error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	executed, result := s.executeAIActionRequest(r, executing)
	jsonOK(w, map[string]any{"action": chatActionSummaryFromDB(*executed), "result": result})
}

func (s *Server) handleDismissChatAction(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	action, err := s.db.GetAIActionRequest(r.Context(), r.PathValue("actionID"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			jsonError(w, "action not found", http.StatusNotFound)
			return
		}
		log.Printf("GetAIActionRequest error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if action.UserID != user.UserID {
		jsonError(w, "action not found", http.StatusNotFound)
		return
	}
	if action.Status != db.AIActionStatusPending {
		jsonError(w, "action is not pending", http.StatusConflict)
		return
	}
	dismissed, err := s.db.DismissAIAction(r.Context(), action.ID)
	if err != nil {
		log.Printf("DismissAIAction error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"action": chatActionSummaryFromDB(*dismissed)})
}

func (s *Server) processChatToolUse(r *http.Request, user *AuthUser, conversationID string, settings *db.AISettings, toolName string, input json.RawMessage) (any, *db.AIActionRequest) {
	meta := aiToolMetadata(toolName, input)
	if !aiCategoryEnabled(settings, meta.Category) {
		return map[string]any{
			"error":    "AI access is disabled for this category.",
			"code":     "ai_category_disabled",
			"category": meta.Category,
			"tool":     toolName,
		}, nil
	}
	if !meta.Mutates {
		return s.executeToolCall(r, toolName, input), nil
	}

	actionStatus := db.AIActionStatusPending
	requiresConfirmation := true
	if settings.FullTrustMode {
		actionStatus = db.AIActionStatusExecuting
		requiresConfirmation = false
	}
	action, err := s.db.CreateAIActionRequest(r.Context(), &db.AIActionRequest{
		UserID:               user.UserID,
		ConversationID:       conversationID,
		ActionType:           toolName,
		Category:             meta.Category,
		InputJSON:            input,
		Status:               actionStatus,
		RequiresConfirmation: requiresConfirmation,
	})
	if err != nil {
		log.Printf("CreateAIActionRequest error: %v", err)
		return map[string]string{"error": "failed to create AI action request"}, nil
	}

	if !settings.FullTrustMode {
		return map[string]any{
			"status":   "pending_confirmation",
			"actionId": action.ID,
			"tool":     toolName,
			"category": meta.Category,
			"message":  "Action prepared and waiting for user confirmation.",
		}, action
	}

	executed, result := s.executeAIActionRequest(r, action)
	return result, executed
}

func (s *Server) executeAIActionRequest(r *http.Request, action *db.AIActionRequest) (*db.AIActionRequest, any) {
	result := s.executeToolCall(r, action.ActionType, action.InputJSON)
	resultJSON, _ := json.Marshal(result)
	if errorMessage := toolResultError(result); errorMessage != "" {
		failed, err := s.db.MarkAIActionFailed(r.Context(), action.ID, errorMessage, resultJSON)
		if err != nil {
			log.Printf("MarkAIActionFailed error: %v", err)
			return action, result
		}
		return failed, result
	}
	succeeded, err := s.db.MarkAIActionSucceeded(r.Context(), action.ID, resultJSON)
	if err != nil {
		log.Printf("MarkAIActionSucceeded error: %v", err)
		return action, result
	}
	return succeeded, result
}

func chatActionSummaryFromDB(action db.AIActionRequest) chatActionSummary {
	return chatActionSummary{
		ID:                   action.ID,
		Type:                 action.ActionType,
		ActionType:           action.ActionType,
		Category:             action.Category,
		Status:               action.Status,
		Data:                 action.InputJSON,
		InputJSON:            action.InputJSON,
		ResultJSON:           action.ResultJSON,
		Error:                action.Error,
		RequiresConfirmation: action.RequiresConfirmation,
		CreatedAt:            action.CreatedAt,
		ConfirmedAt:          action.ConfirmedAt,
		ExecutedAt:           action.ExecutedAt,
	}
}

func chatActionSummariesJSON(actions []*db.AIActionRequest) json.RawMessage {
	if len(actions) == 0 {
		return nil
	}
	summaries := make([]chatActionSummary, 0, len(actions))
	for _, action := range actions {
		if action != nil {
			summaries = append(summaries, chatActionSummaryFromDB(*action))
		}
	}
	if len(summaries) == 0 {
		return nil
	}
	raw, _ := json.Marshal(summaries)
	return raw
}

func chatActionSummaries(actions []*db.AIActionRequest) []chatActionSummary {
	if len(actions) == 0 {
		return []chatActionSummary{}
	}
	summaries := make([]chatActionSummary, 0, len(actions))
	for _, action := range actions {
		if action != nil {
			summaries = append(summaries, chatActionSummaryFromDB(*action))
		}
	}
	return summaries
}

func aiCategoryEnabled(settings *db.AISettings, category string) bool {
	if settings == nil {
		return false
	}
	enabled, ok := settings.Categories[category]
	return ok && enabled
}

func toolResultError(result any) string {
	if result == nil {
		return ""
	}
	if value, ok := result.(map[string]string); ok {
		return value["error"]
	}
	if value, ok := result.(map[string]any); ok {
		if errorMessage, ok := value["error"].(string); ok {
			return errorMessage
		}
	}
	return ""
}

func aiToolMetadata(toolName string, input json.RawMessage) aiToolMeta {
	meta := map[string]aiToolMeta{
		"get_dashboard_summary":      {Category: "analytics"},
		"get_dashboard_stats":        {Category: "analytics"},
		"get_analytics":              {Category: "analytics"},
		"get_wavv_stats":             {Category: "analytics"},
		"get_activity_log":           {Category: "analytics"},
		"get_purge_status":           {Category: "analytics"},
		"get_agent_list":             {Category: "agents"},
		"get_at_risk_agents":         {Category: "agents"},
		"get_agent_detail":           {Category: "agents"},
		"agent_action":               {Category: "agents", Mutates: true},
		"manage_team":                {Category: "agents", Mutates: true},
		"get_org_chart":              {Category: "agents"},
		"get_comp_tiers":             {Category: "agents"},
		"get_recruit_pipeline":       {Category: "recruits"},
		"get_recruit_detail":         {Category: "recruits"},
		"create_recruit":             {Category: "recruits", Mutates: true},
		"update_recruit":             {Category: "recruits", Mutates: true},
		"delete_recruit":             {Category: "recruits", Mutates: true},
		"schedule_recruit_interview": {Category: "recruits", Mutates: true},
		"get_sales":                  {Category: "sales"},
		"get_sales_stats":            {Category: "sales"},
		"create_sale":                {Category: "sales", Mutates: true},
		"update_sale":                {Category: "sales", Mutates: true},
		"delete_sale":                {Category: "sales", Mutates: true},
		"get_appointments":           {Category: "appointments"},
		"create_appointment":         {Category: "appointments", Mutates: true},
		"update_appointment":         {Category: "appointments", Mutates: true},
		"delete_appointment":         {Category: "appointments", Mutates: true},
		"get_finance":                {Category: "analytics"},
		"manage_expense":             {Category: "expenses", Mutates: true},
		"get_licenses":               {Category: "licenses"},
		"manage_license":             {Category: "licenses", Mutates: true},
		"send_message":               {Category: "messaging", Mutates: true},
		"get_lock_ins":               {Category: "lockIns"},
		"manage_lock_in":             {Category: "lockIns", Mutates: true},
		"get_drip_campaigns":         {Category: "messaging"},
		"manage_drip_campaign":       {Category: "messaging", Mutates: true},
		"get_notifications":          {Category: "notifications"},
		"mark_notifications_read":    {Category: "notifications", Mutates: true},
		"manage_documents":           {Category: "documents", Mutates: true},
		"get_pending_joins":          {Category: "agents"},
		"manage_pending_join":        {Category: "agents", Mutates: true},
	}
	if value, ok := meta[toolName]; ok {
		if toolName == "manage_documents" && aiToolAction(input) == "list" {
			value.Mutates = false
		}
		return value
	}
	return aiToolMeta{Category: "analytics"}
}

func aiToolAction(input json.RawMessage) string {
	var params struct {
		Action string `json:"action"`
	}
	_ = json.Unmarshal(input, &params)
	return params.Action
}
