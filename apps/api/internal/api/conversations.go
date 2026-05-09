package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"phantomcrm-api/internal/api/websocket"
	"phantomcrm-api/internal/channels"
	"phantomcrm-api/internal/events"
	"phantomcrm-api/internal/repo"
)

// ── List ─────────────────────────────────────────────────────────────────

func (s *Server) handleCRMListConversations(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	page, err := s.conversationRepo.List(r.Context(), repo.ListConversationsQuery{
		Channel:         q.Get("channel"),
		Status:          q.Get("status"),
		AssignedAgentID: q.Get("assigned_agent_id"),
		Cursor:          q.Get("cursor"),
		Limit:           limit,
	})
	if err != nil {
		jsonError(w, "list conversations: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if page.Items == nil {
		page.Items = []repo.Conversation{}
	}
	jsonOK(w, map[string]any{
		"conversations": page.Items,
		"nextCursor":    page.NextCursor,
	})
}

// ── Get one + recent messages ────────────────────────────────────────────

func (s *Server) handleCRMGetConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	conv, err := s.conversationRepo.Get(r.Context(), id)
	if errors.Is(err, repo.ErrNotFound) {
		jsonError(w, "conversation not found", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "get conversation: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Include the most recent page of messages so the frontend can paint
	// the conversation view in one round-trip.
	msgs, err := s.messageRepo.ListByConversation(r.Context(), id, "", 50)
	if err != nil {
		jsonError(w, "list messages: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if msgs.Items == nil {
		msgs.Items = []repo.Message{}
	}
	jsonOK(w, map[string]any{
		"conversation":      conv,
		"messages":          msgs.Items,
		"nextMessageCursor": msgs.NextCursor,
	})
}

// ── List messages (paginate older history) ───────────────────────────────

func (s *Server) handleCRMListConversationMessages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	cursor := r.URL.Query().Get("cursor")
	page, err := s.messageRepo.ListByConversation(r.Context(), id, cursor, limit)
	if err != nil {
		jsonError(w, "list messages: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if page.Items == nil {
		page.Items = []repo.Message{}
	}
	jsonOK(w, map[string]any{
		"messages":   page.Items,
		"nextCursor": page.NextCursor,
	})
}

// ── Send ─────────────────────────────────────────────────────────────────

type sendMessageRequest struct {
	Body              string         `json:"body"`
	MediaURLs         []string       `json:"mediaUrls"`
	TemplateID        string         `json:"templateId"`
	TemplateVariables map[string]any `json:"templateVariables"`
	IdempotencyKey    string         `json:"idempotencyKey"`
}

func (s *Server) handleCRMSendMessage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	var req sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Body) == "" && strings.TrimSpace(req.TemplateID) == "" {
		jsonError(w, "body or templateId required", http.StatusBadRequest)
		return
	}

	conv, err := s.conversationRepo.Get(r.Context(), id)
	if errors.Is(err, repo.ErrNotFound) {
		jsonError(w, "conversation not found", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "get conversation: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Idempotency: if the caller supplied a key and we already wrote a
	// message for (conversation, key), return the existing record without
	// re-hitting the provider.
	if req.IdempotencyKey != "" {
		if existing, err := s.messageRepo.FindByIdempotencyKey(r.Context(), conv.ID, req.IdempotencyKey); err == nil {
			jsonOK(w, existing)
			return
		}
	}

	// Resolve recipient from the contact + conversation.
	contact, err := s.contactRepo.Get(r.Context(), conv.ContactID, buildActorScope(r))
	if errors.Is(err, repo.ErrNotFound) {
		jsonError(w, "contact not visible", http.StatusForbidden)
		return
	}
	if err != nil {
		jsonError(w, "get contact: "+err.Error(), http.StatusInternalServerError)
		return
	}
	rec := channels.Recipient{
		ContactID: contact.ID,
		Flags: channels.RecipientFlags{
			DoNotSms:                contact.DoNotSMS,
			DoNotEmail:              contact.DoNotEmail,
			DoNotCall:               contact.DoNotCall,
			WhatsAppWindowExpiresAt: conv.WhatsAppWindowExpiresAt,
		},
	}
	if contact.Phone != nil {
		rec.PhoneE164 = *contact.Phone
	}
	if contact.Email != nil {
		rec.Email = *contact.Email
	}

	sender, err := s.channelRegistry.For(channels.Channel(conv.Channel), conv.Provider)
	if err != nil {
		writeChannelError(w, err)
		return
	}

	// Mint our outbound id up-front so we can persist the failed-send
	// message even when the provider rejects.
	au := GetAuthUser(r)
	var sentBy *string
	if au != nil && au.UserID != "" {
		uid := au.UserID
		sentBy = &uid
	}
	out := repo.Message{
		ConversationID:    conv.ID,
		ContactID:         conv.ContactID,
		Direction:         "outbound",
		Channel:           conv.Channel,
		Provider:          conv.Provider,
		FromAddr:          nil,
		ToAddr:            stringPtr(rec.PhoneE164, rec.Email),
		Body:              req.Body,
		MediaURLs:         req.MediaURLs,
		TemplateID:        nullStringValue(req.TemplateID),
		TemplateVariables: req.TemplateVariables,
		Status:            "queued",
		SentByAgentID:     sentBy,
		IdempotencyKey:    nullStringValue(req.IdempotencyKey),
	}

	receipt, sendErr := sender.Send(r.Context(), channels.SendRequest{
		Recipient:         rec,
		Body:              req.Body,
		MediaURLs:         req.MediaURLs,
		TemplateID:        req.TemplateID,
		TemplateVariables: req.TemplateVariables,
		IdempotencyKey:    req.IdempotencyKey,
	})
	if sendErr != nil {
		// Persist the failed attempt so the inbox surfaces the error.
		out.Status = "failed"
		errMsg := sendErr.Error()
		out.ErrorMessage = &errMsg
		_, _ = s.messageRepo.Insert(r.Context(), out)
		writeChannelError(w, sendErr)
		return
	}

	out.Status = receipt.Status
	if out.Status == "" {
		out.Status = "sent"
	}
	if receipt.ProviderMessageID != "" {
		mid := receipt.ProviderMessageID
		out.ExternalMessageID = &mid
	}
	if receipt.CostCents != 0 {
		c := receipt.CostCents
		out.CostCents = &c
	}
	if !receipt.SentAt.IsZero() {
		out.CreatedAt = receipt.SentAt.UTC()
	}
	saved, err := s.messageRepo.Insert(r.Context(), out)
	if err != nil {
		jsonError(w, "persist message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := s.conversationRepo.MarkOutbound(r.Context(), conv.ID, saved.CreatedAt); err != nil {
		// Non-fatal — message is durable; surface the error in logs only.
		// The next inbound or read mark will repair the timestamp.
		_ = err
	}

	if s.eventPublisher != nil {
		_ = s.eventPublisher.Publish(r.Context(), events.Event{
			Type:        "message.sent",
			ContactID:   ptrTo(saved.ContactID),
			SubjectType: "message",
			SubjectID:   saved.ID,
			Payload: map[string]any{
				"conversationId": saved.ConversationID,
				"channel":        saved.Channel,
				"provider":       saved.Provider,
				"externalId":     valueOrNil(saved.ExternalMessageID),
			},
		})
	}
	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent("crm:message_sent", map[string]any{
			"conversationId": saved.ConversationID,
			"messageId":      saved.ID,
			"contactId":      saved.ContactID,
		}))
	}

	jsonOK(w, saved)
}

// ── Snooze / Close / Read / Assign ───────────────────────────────────────

type snoozeRequest struct {
	SnoozeUntil time.Time `json:"snoozeUntil"`
}

func (s *Server) handleCRMSnoozeConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	var req snoozeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SnoozeUntil.IsZero() {
		jsonError(w, "snoozeUntil required (RFC3339)", http.StatusBadRequest)
		return
	}
	if err := s.conversationRepo.Snooze(r.Context(), id, req.SnoozeUntil); err != nil {
		writeRepoError(w, err)
		return
	}
	jsonOK(w, map[string]string{"status": "snoozed", "id": id})
}

func (s *Server) handleCRMCloseConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	if err := s.conversationRepo.Close(r.Context(), id); err != nil {
		writeRepoError(w, err)
		return
	}
	jsonOK(w, map[string]string{"status": "closed", "id": id})
}

func (s *Server) handleCRMReadConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	if err := s.conversationRepo.MarkRead(r.Context(), id); err != nil {
		writeRepoError(w, err)
		return
	}
	jsonOK(w, map[string]string{"status": "read", "id": id})
}

type assignRequest struct {
	AgentID string `json:"agentId"`
}

func (s *Server) handleCRMAssignConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing conversation id", http.StatusBadRequest)
		return
	}
	var req assignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := s.conversationRepo.Assign(r.Context(), id, req.AgentID); err != nil {
		writeRepoError(w, err)
		return
	}
	jsonOK(w, map[string]string{"status": "assigned", "id": id, "agentId": req.AgentID})
}

// ── Per-contact thread list ──────────────────────────────────────────────

func (s *Server) handleCRMContactConversations(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing contact id", http.StatusBadRequest)
		return
	}
	// Visibility: route through ContactRepo.Get to enforce ActorScope
	// before exposing the contact's threads.
	if _, err := s.contactRepo.Get(r.Context(), id, buildActorScope(r)); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			jsonError(w, "contact not found", http.StatusNotFound)
			return
		}
		jsonError(w, "get contact: "+err.Error(), http.StatusInternalServerError)
		return
	}
	convs, err := s.conversationRepo.ListByContact(r.Context(), id)
	if err != nil {
		jsonError(w, "list conversations: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if convs == nil {
		convs = []repo.Conversation{}
	}
	jsonOK(w, map[string]any{"conversations": convs})
}

// ── Templates ────────────────────────────────────────────────────────────

func (s *Server) handleCRMListTemplates(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	tpls, err := s.templateRepo.List(r.Context(), q.Get("channel"), q.Get("status"))
	if err != nil {
		jsonError(w, "list templates: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"templates": tpls})
}

func (s *Server) handleCRMCreateTemplate(w http.ResponseWriter, r *http.Request) {
	var t repo.MessageTemplate
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(t.Name) == "" || strings.TrimSpace(t.Channel) == "" ||
		strings.TrimSpace(t.Provider) == "" || strings.TrimSpace(t.Body) == "" {
		jsonError(w, "name, channel, provider, body required", http.StatusBadRequest)
		return
	}
	created, err := s.templateRepo.Create(r.Context(), t)
	if err != nil {
		jsonError(w, "create template: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, created)
}

func (s *Server) handleCRMUpdateTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing template id", http.StatusBadRequest)
		return
	}
	var patch map[string]any
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	updated, err := s.templateRepo.Update(r.Context(), id, patch)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	jsonOK(w, updated)
}

func (s *Server) handleCRMDeleteTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		jsonError(w, "missing template id", http.StatusBadRequest)
		return
	}
	if err := s.templateRepo.Delete(r.Context(), id); err != nil {
		writeRepoError(w, err)
		return
	}
	jsonOK(w, map[string]string{"status": "deleted", "id": id})
}

// ── Error mapping helpers ────────────────────────────────────────────────

func writeRepoError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		jsonError(w, "not found", http.StatusNotFound)
	case errors.Is(err, repo.ErrScoped):
		jsonError(w, "forbidden", http.StatusForbidden)
	case errors.Is(err, repo.ErrInvalidPayload):
		jsonError(w, err.Error(), http.StatusBadRequest)
	default:
		jsonError(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeChannelError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, channels.ErrTemplateRequired):
		jsonError(w, err.Error(), http.StatusUnprocessableEntity)
	case errors.Is(err, channels.ErrOptedOut):
		jsonError(w, err.Error(), http.StatusConflict)
	case errors.Is(err, channels.ErrInvalidRecipient):
		jsonError(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, channels.ErrUnsupported):
		jsonError(w, err.Error(), http.StatusNotImplemented)
	case errors.Is(err, channels.ErrRateLimit):
		jsonError(w, err.Error(), http.StatusTooManyRequests)
	case errors.Is(err, channels.ErrProviderDown):
		jsonError(w, err.Error(), http.StatusBadGateway)
	case errors.Is(err, channels.ErrPermanent):
		jsonError(w, err.Error(), http.StatusUnprocessableEntity)
	case errors.Is(err, channels.ErrTransient):
		jsonError(w, err.Error(), http.StatusServiceUnavailable)
	default:
		jsonError(w, err.Error(), http.StatusInternalServerError)
	}
}

// ── Tiny pointer helpers ─────────────────────────────────────────────────

func nullStringValue(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	out := s
	return &out
}

func stringPtr(candidates ...string) *string {
	for _, c := range candidates {
		if strings.TrimSpace(c) != "" {
			out := c
			return &out
		}
	}
	return nil
}

func ptrTo(s string) *string {
	if s == "" {
		return nil
	}
	out := s
	return &out
}

func valueOrNil(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}
