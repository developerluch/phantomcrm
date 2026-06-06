package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"phantomcrm-api/internal/db"
)

// claudeContentBlock represents a content block in a Claude API response.
type claudeContentBlock struct {
	Type  string          `json:"type"`
	Text  string          `json:"text,omitempty"`
	ID    string          `json:"id,omitempty"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
}

// claudeResponse represents a Claude Messages API response.
type claudeResponse struct {
	Content    []claudeContentBlock `json:"content"`
	StopReason string               `json:"stop_reason"`
}

// callClaudeAPI sends a request to the Claude Messages API and returns the parsed response.
func (s *Server) callClaudeAPI(ctx context.Context, apiKey, systemPrompt string, messages []any, tools []map[string]any) (*claudeResponse, error) {
	body := map[string]any{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 2048,
		"system":     systemPrompt,
		"messages":   messages,
	}
	if len(tools) > 0 {
		body["tools"] = tools
	}

	bodyJSON, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claude API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result claudeResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func chatParseDiscordID(s string) int64 {
	id, _ := strconv.ParseInt(s, 10, 64)
	return id
}

func chatParseDate(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func chatParseDateOrDefault(s string, def time.Time) time.Time {
	if s == "" {
		return def
	}
	return chatParseDate(s)
}

func chatStrPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// handleChat processes a chat message, calls Claude API with tool use, and returns the response.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Message        string `json:"message"`
		ConversationID string `json:"conversationId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		http.Error(w, "message required", http.StatusBadRequest)
		return
	}

	log.Printf("chat: handleChat called by user=%s, convID=%s, msgLen=%d", user.UserID, req.ConversationID, len(req.Message))

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		log.Printf("chat: ANTHROPIC_API_KEY present=false (len=0)")
		http.Error(w, "AI chat not configured", http.StatusServiceUnavailable)
		return
	}
	log.Printf("chat: ANTHROPIC_API_KEY present=true (len=%d)", len(apiKey))

	// Get or create conversation
	convID := req.ConversationID
	if convID == "" {
		conv, err := s.db.CreateChatConversation(r.Context(), user.UserID, "")
		if err != nil {
			log.Printf("CreateChatConversation error: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		convID = conv.ID
	}

	// Save user message
	s.db.CreateChatMessage(r.Context(), convID, "user", req.Message, nil)

	aiSettings, err := s.db.GetAISettings(r.Context(), user.UserID)
	if err != nil {
		log.Printf("GetAISettings error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Build message history from DB (text-only for stored messages)
	history, _ := s.db.ListChatMessages(r.Context(), convID)
	messages := make([]any, 0)
	for _, msg := range history {
		if msg.Content == "I processed your request. Is there anything else you'd like to know?" ||
			msg.Content == "Hey! I'm here to help. Ask me about your agents, pipeline, metrics, or anything else about your recruiting operation." ||
			msg.Content == "" {
			continue
		}
		messages = append(messages, map[string]any{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}
	if len(messages) > 20 {
		messages = messages[len(messages)-20:]
	}
	// Safety: ensure at least the current user message is present
	if len(messages) == 0 {
		messages = append(messages, map[string]any{
			"role":    "user",
			"content": req.Message,
		})
	}

	// ── Tool definitions ─────────────────────────────────────────────────────
	tools := buildToolDefinitions()

	// ── System prompt ────────────────────────────────────────────────────────
	systemPrompt := `You are VIPA AI, the admin assistant for the VIPA insurance recruitment platform.
You are talking to Lucky (Luciano Cutaj), founder of Top Floor Closers (TFC).

You can help Lucky operate the platform. You can:
- View and manage all agents, recruits, and sales
- Create, update, and delete records across every feature
- Send SMS and WhatsApp messages to recruits
- Manage appointments and scheduling
- View financial data, expenses, and P&L
- Track WAVV dialer production stats
- Manage licenses and compliance
- Handle lock-in events and budgets
- Run drip campaigns
- View org chart and manage team structure
- Access analytics, reports, and activity logs
- Manage notifications

RULES:
- Be conversational. No markdown formatting. Keep responses to 2-3 sentences unless Lucky asks for detail.
- ALWAYS use the appropriate tool to fetch or modify data. Never make up data.
- Mutation tools create a pending action for Lucky to confirm unless server full-trust mode is enabled.
- When creating or updating records, explain the pending action or confirm what executed with key details.
- When listing data, summarize counts and highlight the most important items.
- If a tool returns an error, explain what went wrong in plain language.
- Remember what was said earlier in this conversation — do not say "I don't have context" if the user references something from earlier messages.
- If the user asks a follow-up like "who exactly?" or "which ones?", look at your previous tool results and answer from those.

CONTEXT:
- Agent stages: 1=Joined, 2=Form Started, 3=Sorted, 4=Student, 5=Licensed, 6=Contracting, 7=Setup, 8=Active
- Recruit stages: NEW_LEAD, CONTACTED, SCHEDULED, INTERVIEWED, OFFER, ONBOARDED, REJECTED
- Sale statuses: submitted, approved, issued, paid, cancelled
- Policy types: life, health, auto, home, medicare, final_expense, annuity`

	// Tool use loop — max 5 iterations to prevent runaway
	const maxToolIter = 5
	var responseText string
	var actionRequests []*db.AIActionRequest

	for iter := 0; iter < maxToolIter; iter++ {
		claudeResp, err := s.callClaudeAPI(r.Context(), apiKey, systemPrompt, messages, tools)
		if err != nil {
			log.Printf("Claude API error (iter %d): %v", iter, err)
			http.Error(w, "AI service unavailable", http.StatusServiceUnavailable)
			return
		}

		log.Printf("chat: Claude response (iter %d) — stop_reason=%s, content_blocks=%d", iter, claudeResp.StopReason, len(claudeResp.Content))
		for i, block := range claudeResp.Content {
			if block.Type == "text" {
				log.Printf("chat: block[%d] type=text len=%d", i, len(block.Text))
			} else if block.Type == "tool_use" {
				log.Printf("chat: block[%d] type=tool_use name=%s", i, block.Name)
			}
		}

		// If no tool use, extract text and break
		if claudeResp.StopReason != "tool_use" {
			for _, block := range claudeResp.Content {
				if block.Type == "text" {
					responseText = block.Text
					break
				}
			}
			break
		}

		// Tool use: append assistant message with full content blocks, then tool results
		var assistantBlocks []any
		for _, block := range claudeResp.Content {
			switch block.Type {
			case "text":
				assistantBlocks = append(assistantBlocks, map[string]any{
					"type": "text",
					"text": block.Text,
				})
			case "tool_use":
				assistantBlocks = append(assistantBlocks, map[string]any{
					"type":  "tool_use",
					"id":    block.ID,
					"name":  block.Name,
					"input": json.RawMessage(block.Input),
				})
			}
		}
		messages = append(messages, map[string]any{
			"role":    "assistant",
			"content": assistantBlocks,
		})

		// Build tool_result blocks for the user turn
		var toolResults []any
		for _, block := range claudeResp.Content {
			if block.Type == "tool_use" {
				result, actionRequest := s.processChatToolUse(r, user, convID, aiSettings, block.Name, block.Input)
				if actionRequest != nil {
					actionRequests = append(actionRequests, actionRequest)
				}
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
		// If we got no text after tool loop, make one more call without tools to get a natural response
		finalResp, err := s.callClaudeAPI(r.Context(), apiKey, systemPrompt, messages, nil)
		if err == nil {
			for _, block := range finalResp.Content {
				if block.Type == "text" {
					responseText = block.Text
					break
				}
			}
		}
		if responseText == "" {
			responseText = "Hey! I'm here to help. Ask me about your agents, pipeline, metrics, or anything else about your recruiting operation."
		}
	}

	log.Printf("chat: final response (convID=%s): %s", convID, responseText[:min(len(responseText), 100)])

	// Save assistant message
	toolCallsJSON := chatActionSummariesJSON(actionRequests)
	assistantMessage, err := s.db.CreateChatMessage(r.Context(), convID, "assistant", responseText, toolCallsJSON)
	if err != nil {
		log.Printf("CreateChatMessage assistant error: %v", err)
	} else if len(actionRequests) > 0 {
		for _, actionRequest := range actionRequests {
			if actionRequest == nil {
				continue
			}
			if err := s.db.AttachAIActionMessage(r.Context(), actionRequest.ID, assistantMessage.ID); err != nil {
				log.Printf("AttachAIActionMessage error: %v", err)
				continue
			}
			actionRequest.MessageID = &assistantMessage.ID
		}
		toolCallsJSON = chatActionSummariesJSON(actionRequests)
		if err := s.db.UpdateChatMessageToolCalls(r.Context(), assistantMessage.ID, toolCallsJSON); err != nil {
			log.Printf("UpdateChatMessageToolCalls error: %v", err)
		}
	}

	// Update conversation title from first message
	if req.ConversationID == "" && len(req.Message) > 0 {
		title := req.Message
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		s.db.UpdateConversationTitle(r.Context(), convID, title)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"conversationId": convID,
		"message":        responseText,
		"role":           "assistant",
		"actions":        chatActionSummaries(actionRequests),
	})
}

// handleListConversations returns the user's chat conversations.
func (s *Server) handleListConversations(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	convos, err := s.db.ListChatConversations(r.Context(), user.UserID)
	if err != nil {
		log.Printf("ListChatConversations error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if convos == nil {
		convos = []db.ChatConversation{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"conversations": convos})
}

// handleGetConversationMessages returns messages for a conversation.
func (s *Server) handleGetConversationMessages(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	convID := r.PathValue("conversationID")
	if convID == "" {
		http.Error(w, "missing conversationID", http.StatusBadRequest)
		return
	}
	// Verify ownership
	conv, err := s.db.GetChatConversation(r.Context(), convID)
	if err != nil || conv.UserID != user.UserID {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	msgs, err := s.db.ListChatMessages(r.Context(), convID)
	if err != nil {
		log.Printf("ListChatMessages error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if msgs == nil {
		msgs = []db.ChatMessage{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"messages": msgs})
}

// handleDeleteConversation deletes a conversation and all its messages.
func (s *Server) handleDeleteConversation(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	convID := r.PathValue("conversationID")
	conv, err := s.db.GetChatConversation(r.Context(), convID)
	if err != nil || conv.UserID != user.UserID {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	s.db.DeleteChatConversation(r.Context(), convID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"deleted": true})
}

// handleRenameConversation updates a conversation's title.
func (s *Server) handleRenameConversation(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	convID := r.PathValue("conversationID")
	conv, err := s.db.GetChatConversation(r.Context(), convID)
	if err != nil || conv.UserID != user.UserID {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var renameReq struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&renameReq); err != nil || renameReq.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}
	if err := s.db.UpdateConversationTitle(r.Context(), convID, renameReq.Title); err != nil {
		log.Printf("UpdateConversationTitle error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"updated": true})
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

func buildToolDefinitions() []map[string]any {
	return []map[string]any{
		// ── Dashboard & Analytics ─────────────────────────────────────────
		{
			"name":         "get_dashboard_summary",
			"description":  "Get dashboard summary with total agents, conversion rates, and key metrics",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":        "get_dashboard_stats",
			"description": "Get detailed dashboard statistics — leaderboard, funnel/tracker stats, or agency breakdown",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"section": map[string]any{"type": "string", "description": "Which section: 'leaderboard', 'funnel', 'agencies'. Defaults to 'leaderboard'."},
				},
			},
		},
		{
			"name":        "get_analytics",
			"description": "Get analytics data — conversion rates, lead sources, or stage duration analysis",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"type": map[string]any{"type": "string", "description": "Type of analytics: 'conversion', 'sources', 'stage_duration'"},
				},
				"required": []string{"type"},
			},
		},

		// ── Agents ────────────────────────────────────────────────────────
		{
			"name":        "get_agent_list",
			"description": "Get a list of all agents with their current stage, agency, and status",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"stage":  map[string]any{"type": "integer", "description": "Filter by stage number (1-9)"},
					"search": map[string]any{"type": "string", "description": "Search by name or email"},
				},
			},
		},
		{
			"name":         "get_at_risk_agents",
			"description":  "Get agents who are at risk of becoming inactive (no activity for 14+ days in stages 1-4)",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":        "get_agent_detail",
			"description": "Get comprehensive detail about a specific agent — profile, license status, stage, agency, recent sales. Search by name or Discord ID.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"search": map[string]any{"type": "string", "description": "Agent name or Discord ID to look up"},
				},
				"required": []string{"search"},
			},
		},
		{
			"name":        "agent_action",
			"description": "Perform an action on an agent — kick, nudge, send message, change stage, or change role. Use when Lucky says 'kick agent X', 'nudge Y', 'move Z to stage 5'.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"discordId": map[string]any{"type": "string", "description": "Agent's Discord ID"},
					"action":    map[string]any{"type": "string", "description": "Action: 'kick', 'nudge', 'message', 'stage', 'role'"},
					"value":     map[string]any{"type": "string", "description": "For 'message': the text. For 'stage': stage number 1-8. For 'role': the role name. For 'kick': optional reason."},
				},
				"required": []string{"discordId", "action"},
			},
		},

		// ── Recruits ─────────────────────────────────────────────────────
		{
			"name":        "get_recruit_pipeline",
			"description": "Get recruit pipeline data showing leads at each stage",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"stage": map[string]any{"type": "string", "description": "Filter by stage: NEW_LEAD, CONTACTED, SCHEDULED, INTERVIEWED, OFFER, ONBOARDED, REJECTED"},
				},
			},
		},
		{
			"name":        "get_recruit_detail",
			"description": "Get detailed info about a specific recruit — full profile, stage, messages, assigned manager. Search by name, phone, or email.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"search": map[string]any{"type": "string", "description": "Recruit name, phone number, or email"},
				},
				"required": []string{"search"},
			},
		},
		{
			"name":        "create_recruit",
			"description": "Create a new recruit/lead in the pipeline. Use when Lucky says 'add a new lead named John Doe, phone 555-1234'.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"firstName": map[string]any{"type": "string"},
					"lastName":  map[string]any{"type": "string"},
					"phone":     map[string]any{"type": "string"},
					"email":     map[string]any{"type": "string"},
					"source":    map[string]any{"type": "string", "description": "Lead source: WhatsApp, Website, Referral, LinkedIn, Indeed, etc."},
					"city":      map[string]any{"type": "string"},
					"notes":     map[string]any{"type": "string"},
				},
				"required": []string{"firstName", "lastName"},
			},
		},
		{
			"name":        "update_recruit",
			"description": "Update a recruit's information or move them to a new stage. Use when Lucky says 'move John to contacted' or 'update his phone number'.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"recruitId": map[string]any{"type": "string", "description": "The recruit's UUID"},
					"stage":     map[string]any{"type": "string", "description": "NEW_LEAD, CONTACTED, SCHEDULED, INTERVIEWED, OFFER, ONBOARDED, or REJECTED"},
					"firstName": map[string]any{"type": "string"},
					"lastName":  map[string]any{"type": "string"},
					"phone":     map[string]any{"type": "string"},
					"email":     map[string]any{"type": "string"},
					"source":    map[string]any{"type": "string"},
					"notes":     map[string]any{"type": "string"},
				},
				"required": []string{"recruitId"},
			},
		},
		{
			"name":        "delete_recruit",
			"description": "Delete a recruit from the pipeline. Use only when Lucky explicitly asks to remove a recruit.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"recruitId": map[string]any{"type": "string", "description": "The recruit's UUID"},
				},
				"required": []string{"recruitId"},
			},
		},
		{
			"name":        "schedule_recruit_interview",
			"description": "Schedule an interview for a recruit and move them to SCHEDULED stage.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"recruitId":     map[string]any{"type": "string"},
					"interviewType": map[string]any{"type": "string", "description": "Type of interview: phone, video, in_person"},
					"date":          map[string]any{"type": "string", "description": "Interview date/time in ISO format"},
				},
				"required": []string{"recruitId", "interviewType", "date"},
			},
		},

		// ── Sales ────────────────────────────────────────────────────────
		{
			"name":        "get_sales",
			"description": "Get sales data with optional filters. Returns sales with agent name, client name, carrier, premium, commission, status.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"agentId":    map[string]any{"type": "string", "description": "Filter by account Agent ID"},
					"status":     map[string]any{"type": "string", "description": "Filter: submitted, approved, issued, paid, cancelled"},
					"policyType": map[string]any{"type": "string", "description": "Filter: life, health, auto, home, medicare, final_expense, annuity"},
					"page":       map[string]any{"type": "integer", "description": "Page number, defaults to 1"},
				},
			},
		},
		{
			"name":        "get_sales_stats",
			"description": "Get sales statistics — total count, total premium, total commission, breakdown by status and policy type, this month vs last month.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"agentId": map[string]any{"type": "string", "description": "Optional: stats for a specific agent"},
				},
			},
		},
		{
			"name":        "create_sale",
			"description": "Record a new sale. Use when Lucky says 'log a sale for agent X — life policy with Nationwide, $200 premium'.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"agentId":      map[string]any{"type": "string", "description": "Optional account Agent ID. Defaults to the authenticated user's Agent ID."},
					"clientName":   map[string]any{"type": "string"},
					"policyType":   map[string]any{"type": "string", "description": "life, health, auto, home, medicare, final_expense, annuity"},
					"carrier":      map[string]any{"type": "string", "description": "Insurance carrier name"},
					"premium":      map[string]any{"type": "number"},
					"commission":   map[string]any{"type": "number"},
					"status":       map[string]any{"type": "string", "description": "Defaults to 'submitted'"},
					"policyNumber": map[string]any{"type": "string"},
					"notes":        map[string]any{"type": "string"},
				},
				"required": []string{"clientName", "policyType", "carrier", "premium"},
			},
		},
		{
			"name":        "update_sale",
			"description": "Update a sale record — change status, update premium, add policy number, etc.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"saleId":       map[string]any{"type": "string", "description": "Sale UUID"},
					"status":       map[string]any{"type": "string"},
					"premium":      map[string]any{"type": "number"},
					"commission":   map[string]any{"type": "number"},
					"policyNumber": map[string]any{"type": "string"},
					"carrier":      map[string]any{"type": "string"},
					"notes":        map[string]any{"type": "string"},
				},
				"required": []string{"saleId"},
			},
		},
		{
			"name":        "delete_sale",
			"description": "Delete a sale record. Only use when Lucky explicitly asks.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"saleId": map[string]any{"type": "string"},
				},
				"required": []string{"saleId"},
			},
		},

		// ── Appointments ─────────────────────────────────────────────────
		{
			"name":        "get_appointments",
			"description": "Get appointments — all appointments or upcoming ones in the next 7 days.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"upcoming": map[string]any{"type": "boolean", "description": "If true, only return upcoming appointments (next 7 days)"},
					"status":   map[string]any{"type": "string", "description": "Filter: scheduled, completed, cancelled, no_show"},
					"page":     map[string]any{"type": "integer"},
				},
			},
		},
		{
			"name":        "create_appointment",
			"description": "Create a new appointment/meeting. Use when Lucky says 'schedule a meeting with agent X tomorrow at 2pm'.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title":       map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
					"startTime":   map[string]any{"type": "string", "description": "ISO datetime"},
					"endTime":     map[string]any{"type": "string", "description": "ISO datetime"},
					"agentId":     map[string]any{"type": "string", "description": "Agent Discord ID"},
					"meetingLink": map[string]any{"type": "string"},
				},
				"required": []string{"title", "startTime", "endTime", "agentId"},
			},
		},
		{
			"name":        "update_appointment",
			"description": "Update an appointment's status — mark as completed, cancelled, or no-show.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"appointmentId": map[string]any{"type": "string"},
					"status":        map[string]any{"type": "string", "description": "scheduled, completed, cancelled, no_show"},
				},
				"required": []string{"appointmentId", "status"},
			},
		},
		{
			"name":        "delete_appointment",
			"description": "Delete an appointment.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"appointmentId": map[string]any{"type": "string"},
				},
				"required": []string{"appointmentId"},
			},
		},

		// ── Finance & Expenses ───────────────────────────────────────────
		{
			"name":        "get_finance",
			"description": "Get financial data — overall summary, agent P&L, lead ROI, or expense list.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"type":     map[string]any{"type": "string", "description": "'summary' for overall, 'agent_pl' for agent profit/loss, 'lead_roi' for lead ROI, 'expenses' for expense list"},
					"agentId":  map[string]any{"type": "string", "description": "Required for 'agent_pl'"},
					"dateFrom": map[string]any{"type": "string", "description": "Start date YYYY-MM-DD"},
					"dateTo":   map[string]any{"type": "string", "description": "End date YYYY-MM-DD"},
					"category": map[string]any{"type": "string", "description": "Filter expenses by category"},
				},
				"required": []string{"type"},
			},
		},
		{
			"name":        "manage_expense",
			"description": "Create, update, or delete an expense record.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action":      map[string]any{"type": "string", "description": "'create', 'update', or 'delete'"},
					"expenseId":   map[string]any{"type": "string", "description": "Required for update/delete"},
					"description": map[string]any{"type": "string"},
					"amount":      map[string]any{"type": "number"},
					"category":    map[string]any{"type": "string"},
					"agentId":     map[string]any{"type": "string"},
					"date":        map[string]any{"type": "string"},
				},
				"required": []string{"action"},
			},
		},

		// ── WAVV Dialer ──────────────────────────────────────────────────
		{
			"name":        "get_wavv_stats",
			"description": "Get WAVV dialer production stats — overview, team breakdown, leaderboard, or individual agent stats.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"type":    map[string]any{"type": "string", "description": "'overview', 'teams', 'leaderboard', or 'agent'"},
					"agentId": map[string]any{"type": "string", "description": "Required if type is 'agent' — agent Discord ID"},
					"from":    map[string]any{"type": "string", "description": "Start date YYYY-MM-DD (defaults to current week)"},
					"to":      map[string]any{"type": "string", "description": "End date YYYY-MM-DD"},
				},
			},
		},

		// ── Licenses ─────────────────────────────────────────────────────
		{
			"name":        "get_licenses",
			"description": "Get license information — all licenses, filtered by agent or state.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"agentId": map[string]any{"type": "string", "description": "Filter by agent Discord ID"},
					"state":   map[string]any{"type": "string", "description": "Filter by state abbreviation (CA, TX, FL, etc.)"},
					"status":  map[string]any{"type": "string", "description": "Filter by status"},
				},
			},
		},
		{
			"name":        "manage_license",
			"description": "Create, update, or delete a license record.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action":           map[string]any{"type": "string", "description": "'create', 'update', or 'delete'"},
					"licenseId":        map[string]any{"type": "string", "description": "Required for update/delete"},
					"agentId":          map[string]any{"type": "string", "description": "Agent Discord ID (for create)"},
					"state":            map[string]any{"type": "string"},
					"licenseNumber":    map[string]any{"type": "string"},
					"npn":              map[string]any{"type": "string"},
					"expirationDate":   map[string]any{"type": "string"},
					"linesOfAuthority": map[string]any{"type": "string"},
					"status":           map[string]any{"type": "string"},
				},
				"required": []string{"action"},
			},
		},

		// ── Org Chart & Team ─────────────────────────────────────────────
		{
			"name":         "get_org_chart",
			"description":  "Get the organization chart — full hierarchy.",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":        "manage_team",
			"description": "Manage team structure — assign a manager to an agent, or set an agent's compensation tier.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action":     map[string]any{"type": "string", "description": "'assign_manager' or 'set_comp_tier'"},
					"agentId":    map[string]any{"type": "string", "description": "Agent ID (Discord ID as string for portal)"},
					"managerId":  map[string]any{"type": "string", "description": "Manager ID (for assign_manager)"},
					"compTierId": map[string]any{"type": "string", "description": "Compensation tier UUID (for set_comp_tier)"},
				},
				"required": []string{"action", "agentId"},
			},
		},
		{
			"name":         "get_comp_tiers",
			"description":  "List all compensation tiers with their names and percentages.",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},

		// ── Messaging ────────────────────────────────────────────────────
		{
			"name":        "send_message",
			"description": "Send a message to someone — SMS to a recruit, or WhatsApp message. Use when Lucky says 'text John saying...' or 'send a WhatsApp to...'.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"channel": map[string]any{"type": "string", "description": "'sms' or 'whatsapp'"},
					"to":      map[string]any{"type": "string", "description": "For SMS: recruit ID. For WhatsApp: phone number."},
					"message": map[string]any{"type": "string", "description": "The message text to send"},
				},
				"required": []string{"channel", "message", "to"},
			},
		},

		// ── Lock-Ins ─────────────────────────────────────────────────────
		{
			"name":        "get_lock_ins",
			"description": "Get lock-in events — list all, or get details on a specific one including agents, budget, and itinerary.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"lockInId": map[string]any{"type": "string", "description": "If provided, get full details for this lock-in"},
				},
			},
		},
		{
			"name":        "manage_lock_in",
			"description": "Create, update, or delete a lock-in event. Can also add agents, budget items, or itinerary items.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action":      map[string]any{"type": "string", "description": "'create', 'update', 'delete', 'add_agent', 'add_budget_item', 'add_itinerary_item'"},
					"lockInId":    map[string]any{"type": "string", "description": "Required for update/delete/add operations"},
					"name":        map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
					"startDate":   map[string]any{"type": "string"},
					"endDate":     map[string]any{"type": "string"},
					"city":        map[string]any{"type": "string"},
					"state":       map[string]any{"type": "string"},
					"agentId":     map[string]any{"type": "string", "description": "For add_agent — Discord ID"},
					"agentName":   map[string]any{"type": "string", "description": "For add_agent"},
					"itemName":    map[string]any{"type": "string", "description": "For budget/itinerary items — title"},
					"amount":      map[string]any{"type": "number", "description": "For budget items"},
					"category":    map[string]any{"type": "string", "description": "For budget/itinerary items"},
					"time":        map[string]any{"type": "string", "description": "For itinerary items — start time"},
				},
				"required": []string{"action"},
			},
		},

		// ── Drip Campaigns ───────────────────────────────────────────────
		{
			"name":        "get_drip_campaigns",
			"description": "Get drip campaigns — list all, or get details on a specific one with steps and execution history.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"campaignId": map[string]any{"type": "string", "description": "If provided, get detailed info with steps"},
				},
			},
		},
		{
			"name":        "manage_drip_campaign",
			"description": "Create, update, or delete a drip campaign. Can also add/edit/delete steps.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action":          map[string]any{"type": "string", "description": "'create', 'update', 'delete', 'add_step', 'update_step', 'delete_step'"},
					"campaignId":      map[string]any{"type": "string"},
					"stepId":          map[string]any{"type": "string", "description": "For step operations"},
					"name":            map[string]any{"type": "string"},
					"channel":         map[string]any{"type": "string"},
					"triggerStage":    map[string]any{"type": "string"},
					"stepOrder":       map[string]any{"type": "integer"},
					"delayMinutes":    map[string]any{"type": "integer"},
					"messageTemplate": map[string]any{"type": "string"},
				},
				"required": []string{"action"},
			},
		},

		// ── Notifications ────────────────────────────────────────────────
		{
			"name":        "get_notifications",
			"description": "Get notifications — list recent notifications or get unread count.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"unreadCountOnly": map[string]any{"type": "boolean", "description": "If true, only return the unread count"},
					"type":            map[string]any{"type": "string", "description": "Filter by notification type"},
				},
			},
		},
		{
			"name":        "mark_notifications_read",
			"description": "Mark notifications as read — a specific one or all of them.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"notificationId": map[string]any{"type": "string", "description": "Specific notification ID, or omit to mark all as read"},
				},
			},
		},

		// ── Documents ────────────────────────────────────────────────────
		{
			"name":        "manage_documents",
			"description": "List, create, or delete documents in the document vault.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action":     map[string]any{"type": "string", "description": "'list', 'create', or 'delete'"},
					"documentId": map[string]any{"type": "string", "description": "For delete"},
					"agentId":    map[string]any{"type": "string", "description": "Filter by agent (for list) or assign to agent (for create)"},
					"filename":   map[string]any{"type": "string"},
					"fileUrl":    map[string]any{"type": "string"},
					"category":   map[string]any{"type": "string"},
				},
				"required": []string{"action"},
			},
		},

		// ── Activity Log ─────────────────────────────────────────────────
		{
			"name":        "get_activity_log",
			"description": "Get recent activity/audit log entries — actions taken across the platform.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"limit": map[string]any{"type": "integer", "description": "Number of entries to return, max 50. Default 25."},
				},
			},
		},

		// ── Pending Joins & Purge ────────────────────────────────────────
		{
			"name":         "get_pending_joins",
			"description":  "Get pending join requests — people waiting to be approved into the organization.",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
		{
			"name":        "manage_pending_join",
			"description": "Approve or reject a pending join request.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"joinId": map[string]any{"type": "string"},
					"action": map[string]any{"type": "string", "description": "'approve' or 'reject'"},
				},
				"required": []string{"joinId", "action"},
			},
		},
		{
			"name":         "get_purge_status",
			"description":  "Get purge system status — inactive agents being warned and purge settings.",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{}},
		},
	}
}

// ── Tool Execution ───────────────────────────────────────────────────────────

// executeToolCall runs a tool and returns its result.
func (s *Server) executeToolCall(r *http.Request, toolName string, input json.RawMessage) any {
	ctx := r.Context()
	user := GetAuthUser(r)

	switch toolName {

	// ── Dashboard & Analytics ────────────────────────────────────────────

	case "get_dashboard_summary":
		counts, err := s.db.GetAgentCounts(ctx)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		kicked, _ := s.db.GetKickedCount(ctx)
		total := 0
		for _, c := range counts {
			total += c
		}
		var funnel []map[string]any
		for stage := 1; stage <= 8; stage++ {
			funnel = append(funnel, map[string]any{
				"stage": stage,
				"label": stageLabels[stage],
				"count": counts[stage],
			})
		}
		return map[string]any{
			"totalActive": total,
			"totalKicked": kicked,
			"stageCounts": counts,
			"funnel":      funnel,
		}

	case "get_dashboard_stats":
		var params struct {
			Section string `json:"section"`
		}
		json.Unmarshal(input, &params)
		switch params.Section {
		case "funnel":
			stats, err := s.db.GetOverallTrackerStats(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return stats
		case "agencies":
			stats, err := s.db.GetAgencyTrackerStats(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"agencies": stats, "count": len(stats)}
		default: // "leaderboard" or empty
			lb, err := s.db.GetWeeklyLeaderboard(ctx, "sales", 10)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"leaderboard": lb, "count": len(lb)}
		}

	case "get_analytics":
		var params struct {
			Type string `json:"type"`
		}
		json.Unmarshal(input, &params)
		switch params.Type {
		case "conversion":
			stats, err := s.db.GetRecruitStats(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return stats
		case "sources":
			rows, err := s.db.Pool().QueryContext(ctx, `SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count FROM recruits GROUP BY source ORDER BY count DESC LIMIT 20`)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			defer rows.Close()
			var sources []map[string]any
			for rows.Next() {
				var source string
				var count int
				rows.Scan(&source, &count)
				sources = append(sources, map[string]any{"source": source, "count": count})
			}
			return map[string]any{"sources": sources}
		case "stage_duration":
			stats, err := s.db.GetOverallTrackerStats(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return stats
		default:
			return map[string]string{"error": "unknown analytics type, use: conversion, sources, stage_duration"}
		}

	// ── Agents ───────────────────────────────────────────────────────────

	case "get_agent_list":
		var params struct {
			Stage  int    `json:"stage"`
			Search string `json:"search"`
		}
		json.Unmarshal(input, &params)
		var agents []db.Agent
		var err error
		if params.Search != "" {
			agents, err = s.db.SearchAgents(ctx, params.Search)
		} else if params.Stage > 0 {
			agents, err = s.db.GetAgentsByStage(ctx, params.Stage)
		} else {
			agents, err = s.db.GetAllAgents(ctx, false)
		}
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		totalCount := len(agents)
		if len(agents) > 50 {
			agents = agents[:50]
		}
		return map[string]any{
			"agents":     agents,
			"totalCount": totalCount,
			"showing":    len(agents),
		}

	case "get_at_risk_agents":
		threshold := time.Now().AddDate(0, 0, -14)
		agents, err := s.db.GetInactiveAgents(ctx, threshold)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		totalCount := len(agents)
		if len(agents) > 25 {
			agents = agents[:25]
		}
		return map[string]any{
			"agents":     agents,
			"totalCount": totalCount,
			"showing":    len(agents),
		}

	case "get_agent_detail":
		var params struct {
			Search string `json:"search"`
		}
		json.Unmarshal(input, &params)
		agents, err := s.db.SearchAgents(ctx, params.Search)
		if err != nil || len(agents) == 0 {
			return map[string]string{"error": "agent not found"}
		}
		agent := agents[0]
		discordIDStr := strconv.FormatInt(agent.DiscordID, 10)
		profile, _ := s.db.GetOrCreateProfile(ctx, discordIDStr)
		licenses, _ := s.db.ListLicenses(ctx, discordIDStr, "", "")
		sales, _ := s.db.ListSalesByAgent(ctx, discordIDStr, "")
		if len(sales) > 5 {
			sales = sales[:5]
		}
		return map[string]any{
			"agent":    agent,
			"profile":  profile,
			"licenses": licenses,
			"sales":    sales,
		}

	case "agent_action":
		var params struct {
			DiscordID string `json:"discordId"`
			Action    string `json:"action"`
			Value     string `json:"value"`
		}
		json.Unmarshal(input, &params)
		discordID := chatParseDiscordID(params.DiscordID)
		if discordID == 0 {
			return map[string]string{"error": "invalid Discord ID"}
		}
		switch params.Action {
		case "kick":
			reason := params.Value
			if reason == "" {
				reason = "Kicked via AI assistant"
			}
			err := s.db.KickAgent(ctx, discordID, reason)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "action": "kick", "discordId": params.DiscordID}
		case "nudge", "message", "stage", "role":
			data := map[string]any{}
			if params.Action == "message" || params.Action == "nudge" {
				data["message"] = params.Value
			} else {
				data[params.Action] = params.Value
			}
			id, err := s.db.CreatePendingAction(ctx, params.Action, discordID, data)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "action": params.Action, "pendingActionId": id, "discordId": params.DiscordID, "note": "Queued — the bot will execute it shortly."}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	// ── Recruits ─────────────────────────────────────────────────────────

	case "get_recruit_pipeline":
		var params struct {
			Stage string `json:"stage"`
		}
		json.Unmarshal(input, &params)
		recruits, total, err := s.db.ListRecruits(ctx, "", params.Stage, 1, 25)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{
			"recruits":   recruits,
			"totalCount": total,
			"showing":    len(recruits),
		}

	case "get_recruit_detail":
		var params struct {
			Search string `json:"search"`
		}
		json.Unmarshal(input, &params)
		recruits, _, err := s.db.ListRecruits(ctx, params.Search, "", 1, 10)
		if err != nil || len(recruits) == 0 {
			return map[string]string{"error": "recruit not found"}
		}
		recruit := recruits[0]
		messages, _, _ := s.db.ListSmsMessages(ctx, "", recruit.ID, 1, 10)
		return map[string]any{
			"recruit":        recruit,
			"recentMessages": messages,
		}

	case "create_recruit":
		var params struct {
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
			Phone     string `json:"phone"`
			Email     string `json:"email"`
			Source    string `json:"source"`
			City      string `json:"city"`
			Notes     string `json:"notes"`
		}
		json.Unmarshal(input, &params)
		recruit := &db.Recruit{
			FirstName: params.FirstName,
			LastName:  params.LastName,
			Email:     params.Email,
			Phone:     chatStrPtr(params.Phone),
			Source:    chatStrPtr(params.Source),
			City:      chatStrPtr(params.City),
			Stage:     "NEW_LEAD",
		}
		if user != nil {
			recruit.AssignedManagerID = chatStrPtr(user.DiscordID)
		}
		id, err := s.db.CreateRecruit(ctx, recruit)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "recruitId": id, "name": params.FirstName + " " + params.LastName, "stage": "NEW_LEAD"}

	case "update_recruit":
		var params struct {
			RecruitID string `json:"recruitId"`
			Stage     string `json:"stage"`
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
			Phone     string `json:"phone"`
			Email     string `json:"email"`
			Source    string `json:"source"`
			Notes     string `json:"notes"`
		}
		json.Unmarshal(input, &params)
		updates := map[string]interface{}{}
		if params.Stage != "" {
			updates["stage"] = params.Stage
		}
		if params.FirstName != "" {
			updates["first_name"] = params.FirstName
		}
		if params.LastName != "" {
			updates["last_name"] = params.LastName
		}
		if params.Phone != "" {
			updates["phone"] = params.Phone
		}
		if params.Email != "" {
			updates["email"] = params.Email
		}
		if params.Source != "" {
			updates["source"] = params.Source
		}
		if len(updates) == 0 {
			return map[string]string{"error": "no fields to update"}
		}
		err := s.db.UpdateRecruit(ctx, params.RecruitID, updates)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "recruitId": params.RecruitID, "updated": updates}

	case "delete_recruit":
		var params struct {
			RecruitID string `json:"recruitId"`
		}
		json.Unmarshal(input, &params)
		err := s.db.DeleteRecruit(ctx, params.RecruitID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "deleted": params.RecruitID}

	case "schedule_recruit_interview":
		var params struct {
			RecruitID     string `json:"recruitId"`
			InterviewType string `json:"interviewType"`
			Date          string `json:"date"`
		}
		json.Unmarshal(input, &params)
		updates := map[string]interface{}{
			"stage":          "SCHEDULED",
			"interview_type": params.InterviewType,
			"interview_date": params.Date,
		}
		err := s.db.UpdateRecruit(ctx, params.RecruitID, updates)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "recruitId": params.RecruitID, "stage": "SCHEDULED", "interviewType": params.InterviewType, "date": params.Date}

	// ── Sales ────────────────────────────────────────────────────────────

	case "get_sales":
		var params struct {
			AgentID    string `json:"agentId"`
			Status     string `json:"status"`
			PolicyType string `json:"policyType"`
			Page       int    `json:"page"`
		}
		json.Unmarshal(input, &params)
		if params.Page < 1 {
			params.Page = 1
		}
		sales, total, _, err := s.db.ListSales(ctx, params.Status, params.AgentID, params.PolicyType, "", "", params.Page)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"sales": sales, "totalCount": total, "showing": len(sales), "page": params.Page}

	case "get_sales_stats":
		var params struct {
			AgentID string `json:"agentId"`
		}
		json.Unmarshal(input, &params)
		agentID := params.AgentID
		if agentID == "" {
			agentID = "" // GetAgentSaleStats handles empty as "all"
		}
		stats, err := s.db.GetAgentSaleStats(ctx, agentID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return stats

	case "create_sale":
		var params struct {
			AgentID      string  `json:"agentId"`
			ClientName   string  `json:"clientName"`
			PolicyType   string  `json:"policyType"`
			Carrier      string  `json:"carrier"`
			Premium      float64 `json:"premium"`
			Commission   float64 `json:"commission"`
			Status       string  `json:"status"`
			PolicyNumber string  `json:"policyNumber"`
			Notes        string  `json:"notes"`
		}
		json.Unmarshal(input, &params)
		status := params.Status
		if status == "" {
			status = "submitted"
		}
		agentID := strings.TrimSpace(params.AgentID)
		if agentID == "" && user != nil {
			agentID = strings.TrimSpace(user.AgentID)
			if agentID == "" && user.UserID != "" && user.UserID != "system" {
				if dbUser, err := s.db.GetUserByID(ctx, user.UserID); err == nil && dbUser != nil {
					agentID = strings.TrimSpace(dbUser.AgentID)
				}
			}
		}
		if agentID == "" {
			return map[string]string{"error": "agentId is required and the current account does not have a provisioned Agent ID"}
		}
		exists, err := s.db.AgentIDExists(ctx, agentID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		if !exists {
			return map[string]string{"error": "unknown agentId"}
		}
		sale := &db.Sale{
			AgentID:    agentID,
			ClientName: params.ClientName,
			PolicyType: params.PolicyType,
			Carrier:    params.Carrier,
			Premium:    params.Premium,
			Status:     status,
		}
		if params.Commission > 0 {
			sale.Commission = &params.Commission
		}
		if params.PolicyNumber != "" {
			sale.PolicyNumber = &params.PolicyNumber
		}
		if params.Notes != "" {
			sale.Notes = &params.Notes
		}
		id, err := s.db.CreateSale(ctx, sale)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "saleId": id, "agentId": agentID, "clientName": params.ClientName, "premium": params.Premium, "status": status}

	case "update_sale":
		var params struct {
			SaleID       string  `json:"saleId"`
			Status       string  `json:"status"`
			Premium      float64 `json:"premium"`
			Commission   float64 `json:"commission"`
			PolicyNumber string  `json:"policyNumber"`
			Carrier      string  `json:"carrier"`
			Notes        string  `json:"notes"`
		}
		json.Unmarshal(input, &params)
		updates := map[string]interface{}{}
		if params.Status != "" {
			updates["status"] = params.Status
		}
		if params.Premium > 0 {
			updates["premium"] = params.Premium
		}
		if params.Commission > 0 {
			updates["commission"] = params.Commission
		}
		if params.PolicyNumber != "" {
			updates["policy_number"] = params.PolicyNumber
		}
		if params.Carrier != "" {
			updates["carrier"] = params.Carrier
		}
		if params.Notes != "" {
			updates["notes"] = params.Notes
		}
		if len(updates) == 0 {
			return map[string]string{"error": "no fields to update"}
		}
		err := s.db.UpdateSale(ctx, params.SaleID, updates)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "saleId": params.SaleID, "updated": updates}

	case "delete_sale":
		var params struct {
			SaleID string `json:"saleId"`
		}
		json.Unmarshal(input, &params)
		err := s.db.DeleteSale(ctx, params.SaleID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "deleted": params.SaleID}

	// ── Appointments ─────────────────────────────────────────────────────

	case "get_appointments":
		var params struct {
			Upcoming bool   `json:"upcoming"`
			Status   string `json:"status"`
			Page     int    `json:"page"`
		}
		json.Unmarshal(input, &params)
		if params.Upcoming {
			appts, err := s.db.ListUpcomingAppointments(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"appointments": appts, "count": len(appts), "upcoming": true}
		}
		if params.Page < 1 {
			params.Page = 1
		}
		appts, total, err := s.db.ListAppointments(ctx, params.Status, params.Page, 20)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"appointments": appts, "totalCount": total, "showing": len(appts), "page": params.Page}

	case "create_appointment":
		var params struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			StartTime   string `json:"startTime"`
			EndTime     string `json:"endTime"`
			AgentID     string `json:"agentId"`
			MeetingLink string `json:"meetingLink"`
		}
		json.Unmarshal(input, &params)
		startTime, _ := time.Parse(time.RFC3339, params.StartTime)
		endTime, _ := time.Parse(time.RFC3339, params.EndTime)
		appt := &db.Appointment{
			AgentID:   params.AgentID,
			Title:     params.Title,
			StartTime: startTime,
			EndTime:   endTime,
			Status:    "scheduled",
		}
		if params.Description != "" {
			appt.Description = &params.Description
		}
		if params.MeetingLink != "" {
			appt.MeetingLink = &params.MeetingLink
		}
		id, err := s.db.CreateAppointment(ctx, appt)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "appointmentId": id, "title": params.Title, "startTime": params.StartTime}

	case "update_appointment":
		var params struct {
			AppointmentID string `json:"appointmentId"`
			Status        string `json:"status"`
		}
		json.Unmarshal(input, &params)
		err := s.db.UpdateAppointmentStatus(ctx, params.AppointmentID, params.Status)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "appointmentId": params.AppointmentID, "status": params.Status}

	case "delete_appointment":
		var params struct {
			AppointmentID string `json:"appointmentId"`
		}
		json.Unmarshal(input, &params)
		err := s.db.DeleteAppointment(ctx, params.AppointmentID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "deleted": params.AppointmentID}

	// ── Finance & Expenses ───────────────────────────────────────────────

	case "get_finance":
		var params struct {
			Type     string `json:"type"`
			AgentID  string `json:"agentId"`
			DateFrom string `json:"dateFrom"`
			DateTo   string `json:"dateTo"`
			Category string `json:"category"`
		}
		json.Unmarshal(input, &params)
		switch params.Type {
		case "summary":
			summary, err := s.db.GetFinanceSummary(ctx, params.DateFrom, params.DateTo)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return summary
		case "agent_pl":
			if params.AgentID == "" {
				return map[string]string{"error": "agentId required for agent_pl"}
			}
			pl, err := s.db.GetAgentPL(ctx, params.AgentID, params.DateFrom, params.DateTo)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return pl
		case "lead_roi":
			roi, err := s.db.GetLeadROI(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"leadROI": roi}
		case "expenses":
			expenses, total, err := s.db.ListExpenses(ctx, params.Category, params.AgentID, params.DateFrom, params.DateTo, 1)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"expenses": expenses, "totalCount": total, "showing": len(expenses)}
		default:
			return map[string]string{"error": "unknown finance type, use: summary, agent_pl, lead_roi, expenses"}
		}

	case "manage_expense":
		var params struct {
			Action      string  `json:"action"`
			ExpenseID   string  `json:"expenseId"`
			Description string  `json:"description"`
			Amount      float64 `json:"amount"`
			Category    string  `json:"category"`
			AgentID     string  `json:"agentId"`
			Date        string  `json:"date"`
		}
		json.Unmarshal(input, &params)
		switch params.Action {
		case "create":
			expense := &db.Expense{
				Description: params.Description,
				Amount:      params.Amount,
				Category:    params.Category,
				ExpenseDate: params.Date,
			}
			if params.AgentID != "" {
				expense.AgentDiscordID = &params.AgentID
			}
			id, err := s.db.CreateExpense(ctx, expense)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "expenseId": id, "description": params.Description, "amount": params.Amount}
		case "update":
			updates := map[string]interface{}{}
			if params.Description != "" {
				updates["description"] = params.Description
			}
			if params.Amount > 0 {
				updates["amount"] = params.Amount
			}
			if params.Category != "" {
				updates["category"] = params.Category
			}
			if params.Date != "" {
				updates["expense_date"] = params.Date
			}
			err := s.db.UpdateExpense(ctx, params.ExpenseID, updates)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "expenseId": params.ExpenseID, "updated": updates}
		case "delete":
			err := s.db.DeleteExpense(ctx, params.ExpenseID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "deleted": params.ExpenseID}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	// ── WAVV Dialer ──────────────────────────────────────────────────────

	case "get_wavv_stats":
		var params struct {
			Type    string `json:"type"`
			AgentID string `json:"agentId"`
			From    string `json:"from"`
			To      string `json:"to"`
		}
		json.Unmarshal(input, &params)
		now := time.Now()
		from := chatParseDateOrDefault(params.From, now.AddDate(0, 0, -7))
		to := chatParseDateOrDefault(params.To, now)
		switch params.Type {
		case "teams":
			teams, err := s.db.GetWavvTeamSummary(ctx, from, to)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"teams": teams, "count": len(teams), "from": from.Format("2006-01-02"), "to": to.Format("2006-01-02")}
		case "leaderboard":
			lb, err := s.db.GetWavvAgentLeaderboard(ctx, from, to)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"leaderboard": lb, "count": len(lb), "from": from.Format("2006-01-02"), "to": to.Format("2006-01-02")}
		case "agent":
			if params.AgentID == "" {
				return map[string]string{"error": "agentId required for agent stats"}
			}
			discordID := chatParseDiscordID(params.AgentID)
			stats, err := s.db.GetWavvAgentStats(ctx, discordID, from, to)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			sessions, _ := s.db.GetWavvSessions(ctx, discordID, from, to)
			daily, _ := s.db.GetWavvDailySummary(ctx, discordID, from, to)
			return map[string]any{"stats": stats, "sessions": sessions, "daily": daily}
		default: // "overview" or empty
			overview, err := s.db.GetWavvOverview(ctx, from, to)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return overview
		}

	// ── Licenses ─────────────────────────────────────────────────────────

	case "get_licenses":
		var params struct {
			AgentID string `json:"agentId"`
			State   string `json:"state"`
			Status  string `json:"status"`
		}
		json.Unmarshal(input, &params)
		licenses, err := s.db.ListLicenses(ctx, params.AgentID, params.State, params.Status)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"licenses": licenses, "count": len(licenses)}

	case "manage_license":
		var params struct {
			Action           string `json:"action"`
			LicenseID        string `json:"licenseId"`
			AgentID          string `json:"agentId"`
			State            string `json:"state"`
			LicenseNumber    string `json:"licenseNumber"`
			NPN              string `json:"npn"`
			ExpirationDate   string `json:"expirationDate"`
			LinesOfAuthority string `json:"linesOfAuthority"`
			Status           string `json:"status"`
		}
		json.Unmarshal(input, &params)
		switch params.Action {
		case "create":
			license := &db.License{
				AgentID:       params.AgentID,
				State:         params.State,
				LicenseNumber: params.LicenseNumber,
				Status:        params.Status,
			}
			if params.NPN != "" {
				license.NPN = &params.NPN
			}
			if params.ExpirationDate != "" {
				license.ExpirationDate = &params.ExpirationDate
			}
			id, err := s.db.CreateLicense(ctx, license)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "licenseId": id, "agentId": params.AgentID, "state": params.State}
		case "update":
			updates := map[string]interface{}{}
			if params.State != "" {
				updates["state"] = params.State
			}
			if params.LicenseNumber != "" {
				updates["license_number"] = params.LicenseNumber
			}
			if params.NPN != "" {
				updates["npn"] = params.NPN
			}
			if params.ExpirationDate != "" {
				updates["expiration_date"] = params.ExpirationDate
			}
			if params.Status != "" {
				updates["status"] = params.Status
			}
			err := s.db.UpdateLicense(ctx, params.LicenseID, updates)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "licenseId": params.LicenseID, "updated": updates}
		case "delete":
			err := s.db.DeleteLicense(ctx, params.LicenseID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "deleted": params.LicenseID}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	// ── Org Chart & Team ─────────────────────────────────────────────────

	case "get_org_chart":
		chart, err := s.db.GetOrgChart(ctx)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"orgChart": chart, "count": len(chart)}

	case "manage_team":
		var params struct {
			Action     string `json:"action"`
			AgentID    string `json:"agentId"`
			ManagerID  string `json:"managerId"`
			CompTierID string `json:"compTierId"`
		}
		json.Unmarshal(input, &params)
		switch params.Action {
		case "assign_manager":
			mgr := params.ManagerID
			_, err := s.db.SetManager(ctx, params.AgentID, &mgr)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "agentId": params.AgentID, "managerId": params.ManagerID}
		case "set_comp_tier":
			tier := params.CompTierID
			_, err := s.db.SetCompTier(ctx, params.AgentID, &tier)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "agentId": params.AgentID, "compTierId": params.CompTierID}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	case "get_comp_tiers":
		tiers, err := s.db.ListCompTiers(ctx)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"tiers": tiers, "count": len(tiers)}

	// ── Messaging ────────────────────────────────────────────────────────

	case "send_message":
		var params struct {
			Channel string `json:"channel"`
			To      string `json:"to"`
			Message string `json:"message"`
		}
		json.Unmarshal(input, &params)
		if s.smsClient == nil {
			return map[string]string{"error": "SMS/WhatsApp not configured — Twilio credentials missing"}
		}
		switch params.Channel {
		case "sms":
			// Look up recruit phone
			recruit, err := s.db.GetRecruit(ctx, params.To)
			if err != nil || recruit == nil {
				return map[string]string{"error": "recruit not found: " + params.To}
			}
			if recruit.Phone == nil || *recruit.Phone == "" {
				return map[string]string{"error": "recruit has no phone number"}
			}
			sid, err := s.smsClient.Send(*recruit.Phone, params.Message)
			if err != nil {
				return map[string]string{"error": "SMS send failed: " + err.Error()}
			}
			// Log the message
			sentStatus := "sent"
			s.db.CreateSmsMessage(ctx, &db.SmsMessage{
				RecruitID: &recruit.ID,
				ToNumber:  *recruit.Phone,
				Direction: "outbound",
				Body:      params.Message,
				Status:    &sentStatus,
			})
			return map[string]any{"success": true, "channel": "sms", "sid": sid, "to": *recruit.Phone, "recruitName": recruit.FirstName + " " + recruit.LastName}
		case "whatsapp":
			sid, err := s.smsClient.SendWhatsApp(params.To, params.Message)
			if err != nil {
				return map[string]string{"error": "WhatsApp send failed: " + err.Error()}
			}
			return map[string]any{"success": true, "channel": "whatsapp", "sid": sid, "to": params.To}
		default:
			return map[string]string{"error": "unknown channel: " + params.Channel + ". Use 'sms' or 'whatsapp'."}
		}

	// ── Lock-Ins ─────────────────────────────────────────────────────────

	case "get_lock_ins":
		var params struct {
			LockInID string `json:"lockInId"`
		}
		json.Unmarshal(input, &params)
		if params.LockInID != "" {
			lockIn, err := s.db.GetLockIn(ctx, params.LockInID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			agents, _ := s.db.ListLockInAgents(ctx, params.LockInID)
			budget, _ := s.db.ListBudgetItems(ctx, params.LockInID)
			budgetSummary, _ := s.db.GetBudgetSummary(ctx, params.LockInID)
			itinerary, _ := s.db.ListItinerary(ctx, params.LockInID)
			return map[string]any{
				"lockIn":        lockIn,
				"agents":        agents,
				"budget":        budget,
				"budgetSummary": budgetSummary,
				"itinerary":     itinerary,
			}
		}
		orgID := s.cfg.GuildIDInt()
		lockIns, err := s.db.ListLockIns(ctx, orgID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"lockIns": lockIns, "count": len(lockIns)}

	case "manage_lock_in":
		var params struct {
			Action      string  `json:"action"`
			LockInID    string  `json:"lockInId"`
			Name        string  `json:"name"`
			Description string  `json:"description"`
			StartDate   string  `json:"startDate"`
			EndDate     string  `json:"endDate"`
			City        string  `json:"city"`
			State       string  `json:"state"`
			AgentID     string  `json:"agentId"`
			AgentName   string  `json:"agentName"`
			ItemName    string  `json:"itemName"`
			Amount      float64 `json:"amount"`
			Category    string  `json:"category"`
			Time        string  `json:"time"`
		}
		json.Unmarshal(input, &params)
		switch params.Action {
		case "create":
			li := db.LockIn{
				Name:           params.Name,
				Description:    params.Description,
				StartDate:      params.StartDate,
				EndDate:        params.EndDate,
				City:           params.City,
				State:          params.State,
				Status:         "planning",
				CreatedByOrgID: s.cfg.GuildIDInt(),
			}
			created, err := s.db.CreateLockIn(ctx, li)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "lockInId": created.ID, "name": params.Name}
		case "update":
			updates := map[string]any{}
			if params.Name != "" {
				updates["name"] = params.Name
			}
			if params.Description != "" {
				updates["description"] = params.Description
			}
			if params.StartDate != "" {
				updates["start_date"] = params.StartDate
			}
			if params.EndDate != "" {
				updates["end_date"] = params.EndDate
			}
			if params.City != "" {
				updates["city"] = params.City
			}
			if params.State != "" {
				updates["state"] = params.State
			}
			err := s.db.UpdateLockIn(ctx, params.LockInID, updates)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "lockInId": params.LockInID, "updated": updates}
		case "delete":
			err := s.db.DeleteLockIn(ctx, params.LockInID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "deleted": params.LockInID}
		case "add_agent":
			agent := db.LockInAgent{
				LockInID:       params.LockInID,
				AgentDiscordID: chatParseDiscordID(params.AgentID),
				OrgID:          s.cfg.GuildIDInt(),
				AgentName:      params.AgentName,
				Status:         "confirmed",
			}
			created, err := s.db.AddLockInAgent(ctx, agent)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "agentId": created.ID, "name": params.AgentName}
		case "add_budget_item":
			item := db.LockInBudgetItem{
				LockInID:    params.LockInID,
				Category:    params.Category,
				Description: params.ItemName,
				Amount:      params.Amount,
			}
			created, err := s.db.AddBudgetItem(ctx, item)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "budgetItemId": created.ID, "description": params.ItemName, "amount": params.Amount}
		case "add_itinerary_item":
			item := db.LockInItineraryItem{
				LockInID:  params.LockInID,
				Title:     params.ItemName,
				StartTime: params.Time,
				Category:  params.Category,
			}
			created, err := s.db.AddItineraryItem(ctx, item)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "itineraryItemId": created.ID, "title": params.ItemName}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	// ── Drip Campaigns ───────────────────────────────────────────────────

	case "get_drip_campaigns":
		var params struct {
			CampaignID string `json:"campaignId"`
		}
		json.Unmarshal(input, &params)
		if params.CampaignID != "" {
			campaign, err := s.db.GetDripCampaign(ctx, params.CampaignID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			steps, _ := s.db.ListDripSteps(ctx, params.CampaignID)
			executions, _ := s.db.ListDripExecutions(ctx, params.CampaignID)
			return map[string]any{"campaign": campaign, "steps": steps, "executions": executions}
		}
		campaigns, err := s.db.ListDripCampaigns(ctx)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"campaigns": campaigns, "count": len(campaigns)}

	case "manage_drip_campaign":
		var params struct {
			Action          string `json:"action"`
			CampaignID      string `json:"campaignId"`
			StepID          string `json:"stepId"`
			Name            string `json:"name"`
			Channel         string `json:"channel"`
			TriggerStage    string `json:"triggerStage"`
			StepOrder       int    `json:"stepOrder"`
			DelayMinutes    int    `json:"delayMinutes"`
			MessageTemplate string `json:"messageTemplate"`
		}
		json.Unmarshal(input, &params)
		switch params.Action {
		case "create":
			campaign := db.DripCampaign{
				Name:         params.Name,
				Channel:      params.Channel,
				TriggerStage: params.TriggerStage,
				IsActive:     true,
			}
			id, err := s.db.CreateDripCampaign(ctx, campaign)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "campaignId": id, "name": params.Name}
		case "update":
			updates := map[string]interface{}{}
			if params.Name != "" {
				updates["name"] = params.Name
			}
			if params.Channel != "" {
				updates["channel"] = params.Channel
			}
			if params.TriggerStage != "" {
				updates["trigger_stage"] = params.TriggerStage
			}
			err := s.db.UpdateDripCampaign(ctx, params.CampaignID, updates)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "campaignId": params.CampaignID, "updated": updates}
		case "delete":
			err := s.db.DeleteDripCampaign(ctx, params.CampaignID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "deleted": params.CampaignID}
		case "add_step":
			step := db.DripStep{
				CampaignID:      params.CampaignID,
				StepOrder:       params.StepOrder,
				DelayMinutes:    params.DelayMinutes,
				MessageTemplate: params.MessageTemplate,
			}
			id, err := s.db.CreateDripStep(ctx, step)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "stepId": id, "stepOrder": params.StepOrder}
		case "update_step":
			updates := map[string]interface{}{}
			if params.DelayMinutes > 0 {
				updates["delay_minutes"] = params.DelayMinutes
			}
			if params.MessageTemplate != "" {
				updates["message_template"] = params.MessageTemplate
			}
			if params.StepOrder > 0 {
				updates["step_order"] = params.StepOrder
			}
			err := s.db.UpdateDripStep(ctx, params.StepID, updates)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "stepId": params.StepID, "updated": updates}
		case "delete_step":
			err := s.db.DeleteDripStep(ctx, params.StepID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "deleted": params.StepID}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	// ── Notifications ────────────────────────────────────────────────────

	case "get_notifications":
		var params struct {
			UnreadCountOnly bool   `json:"unreadCountOnly"`
			Type            string `json:"type"`
		}
		json.Unmarshal(input, &params)
		if user == nil {
			return map[string]string{"error": "unauthorized"}
		}
		if params.UnreadCountOnly {
			count, err := s.db.GetUnreadNotificationCount(ctx, user.UserID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"unreadCount": count}
		}
		notifications, total, err := s.db.ListNotifications(ctx, user.UserID, params.Type, 1, 25)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"notifications": notifications, "totalCount": total, "showing": len(notifications)}

	case "mark_notifications_read":
		var params struct {
			NotificationID string `json:"notificationId"`
		}
		json.Unmarshal(input, &params)
		if user == nil {
			return map[string]string{"error": "unauthorized"}
		}
		if params.NotificationID != "" {
			err := s.db.MarkNotificationRead(ctx, params.NotificationID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "marked": params.NotificationID}
		}
		err := s.db.MarkAllNotificationsRead(ctx, user.UserID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"success": true, "markedAll": true}

	// ── Documents ────────────────────────────────────────────────────────

	case "manage_documents":
		var params struct {
			Action     string `json:"action"`
			DocumentID string `json:"documentId"`
			AgentID    string `json:"agentId"`
			Filename   string `json:"filename"`
			FileURL    string `json:"fileUrl"`
			Category   string `json:"category"`
		}
		json.Unmarshal(input, &params)
		switch params.Action {
		case "list":
			docs, err := s.db.ListDocuments(ctx, params.AgentID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"documents": docs, "count": len(docs)}
		case "create":
			doc := db.Document{
				AgentDiscordID: params.AgentID,
				Filename:       params.Filename,
				FileURL:        params.FileURL,
				Category:       params.Category,
			}
			if user != nil {
				doc.UploadedBy = user.UserID
			}
			id, err := s.db.CreateDocument(ctx, doc)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "documentId": id, "filename": params.Filename}
		case "delete":
			err := s.db.DeleteDocument(ctx, params.DocumentID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "deleted": params.DocumentID}
		default:
			return map[string]string{"error": "unknown action: " + params.Action}
		}

	// ── Activity Log ─────────────────────────────────────────────────────

	case "get_activity_log":
		var params struct {
			Limit int `json:"limit"`
		}
		json.Unmarshal(input, &params)
		limit := params.Limit
		if limit <= 0 || limit > 50 {
			limit = 25
		}
		entries, err := s.db.ListAuditEntries(ctx, limit, 0)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"entries": entries, "count": len(entries)}

	// ── Pending Joins & Purge ────────────────────────────────────────────

	case "get_pending_joins":
		guildID := s.cfg.GuildIDInt()
		joins, err := s.db.ListPendingJoins(ctx, guildID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]any{"pendingJoins": joins, "count": len(joins)}

	case "manage_pending_join":
		var params struct {
			JoinID string `json:"joinId"`
			Action string `json:"action"`
		}
		json.Unmarshal(input, &params)
		reviewerID := ""
		if user != nil {
			reviewerID = user.UserID
		}
		switch params.Action {
		case "approve":
			result, err := s.db.ApprovePendingJoin(ctx, params.JoinID, reviewerID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "action": "approved", "join": result}
		case "reject":
			result, err := s.db.RejectPendingJoin(ctx, params.JoinID, reviewerID)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			return map[string]any{"success": true, "action": "rejected", "join": result}
		default:
			return map[string]string{"error": "unknown action: " + params.Action + ". Use 'approve' or 'reject'."}
		}

	case "get_purge_status":
		guildID := s.cfg.GuildIDInt()
		status, err := s.db.GetPurgeStatus(ctx, guildID)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		warnings, _ := s.db.ListPurgeWarnings(ctx, guildID)
		return map[string]any{"status": status, "warnings": warnings, "warningCount": len(warnings)}

	default:
		return map[string]string{"error": "unknown tool"}
	}
}
