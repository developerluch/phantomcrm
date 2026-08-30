package api

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/channels"
	"github.com/developerluch/phantomcrm/apps/api/internal/sms"
)

// handleWhatsAppWebhook receives inbound WhatsApp messages from Twilio.
// Route: POST /api/v1/whatsapp/webhook (unauthenticated — Twilio calls directly)
//
// M2A: writes into the unified `conversations` + `messages` tables (no
// longer touches legacy `whatsapp_conversations` / `whatsapp_messages`).
// Extends the 24h customer-care window on every inbound. Opt-out keyword
// handling and the legacy WS event "whatsapp:opted_out" are preserved.
func (s *Server) handleWhatsAppWebhook(w http.ResponseWriter, r *http.Request) {
	if !s.validateTwilioSignature(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	from := r.FormValue("From") // "whatsapp:+15551234567"
	body := r.FormValue("Body")
	msgSid := r.FormValue("MessageSid")
	profileName := r.FormValue("ProfileName") // WhatsApp display name

	// Strip "whatsapp:" prefix for phone lookup
	cleanPhone := strings.TrimPrefix(from, "whatsapp:")
	cleanPhone = sms.NormalizePhone(cleanPhone)

	log.Printf("WhatsApp inbound from %s (%s): %s [SID: %s]", cleanPhone, profileName, truncate(body, 80), msgSid)

	ctx := r.Context()

	// Opt-out keywords short-circuit BEFORE the unified write so the
	// recruit gets DNC'd and drip executions are cancelled even if the
	// inbox write trips.
	upperBody := strings.ToUpper(strings.TrimSpace(body))
	isOptOut := upperBody == "STOP" || upperBody == "UNSUBSCRIBE" || upperBody == "CANCEL" || upperBody == "QUIT"

	res, err := s.upsertInboundMessage(ctx, inboundMessage{
		Phone:       cleanPhone,
		ProfileName: profileName,
		Body:        body,
		ExternalID:  msgSid,
		Channel:     channels.ChannelWhatsApp,
		Provider:    "twilio",
		SourceType:  "inbound_whatsapp",
	})
	if err != nil {
		log.Printf("whatsapp webhook: unified write: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if isOptOut {
		s.handleOptOut(ctx, cleanPhone, res.Conversation.ID)
		w.Header().Set("Content-Type", "text/xml")
		w.Write([]byte("<Response></Response>"))
		return
	}

	// Optional recruit enrichment for legacy listeners. The recruit
	// linkage formerly persisted on whatsapp_conversations.recruit_id is
	// no longer maintained — downstream consumers should match by
	// contact_id instead.
	recruit, _ := s.db.FindRecruitByPhone(ctx, cleanPhone)
	extra := map[string]any{
		"from":        cleanPhone,
		"body":        body,
		"profileName": profileName,
	}
	if recruit != nil {
		extra["recruitId"] = recruit.ID
	}
	s.broadcastInbound(res, extra)
	// Legacy event for any consumer still listening.
	if s.hub != nil {
		s.hub.Publish(websocket.NewEvent("whatsapp:message_received", map[string]any{
			"conversationId": res.Conversation.ID,
			"messageId":      res.Message.ID,
			"from":           cleanPhone,
			"body":           body,
			"profileName":    profileName,
			"recruitId":      extra["recruitId"],
		}))
	}

	// Return empty TwiML (no auto-reply — drip campaign handles responses)
	w.Header().Set("Content-Type", "text/xml")
	w.Write([]byte("<Response></Response>"))
}

// handleOptOut processes opt-out requests (STOP, UNSUBSCRIBE, etc.)
func (s *Server) handleOptOut(ctx context.Context, phone, conversationID string) {
	recruit, _ := s.db.FindRecruitByPhone(ctx, phone)
	if recruit == nil {
		log.Printf("whatsapp opt-out: no recruit found for phone %s", phone)
		return
	}

	// Mark recruit as opted out
	err := s.db.UpdateRecruit(ctx, recruit.ID, map[string]interface{}{
		"optedOut":   true,
		"optedOutAt": time.Now(),
	})
	if err != nil {
		log.Printf("whatsapp opt-out: update recruit: %v", err)
	}

	// Cancel all active drip executions
	err = s.db.CancelExecutionsByRecruitID(ctx, recruit.ID, "opted_out")
	if err != nil {
		log.Printf("whatsapp opt-out: cancel executions: %v", err)
	}

	log.Printf("whatsapp opt-out: recruit %s (%s %s) opted out", recruit.ID, recruit.FirstName, recruit.LastName)

	s.hub.Publish(websocket.NewEvent("whatsapp:opted_out", map[string]interface{}{
		"recruitId":      recruit.ID,
		"conversationId": conversationID,
		"phone":          phone,
	}))
}

// handleWhatsAppStatusCallback receives status updates from Twilio for WhatsApp messages.
// Route: POST /api/v1/whatsapp/status-wa (unauthenticated — Twilio calls directly)
func (s *Server) handleWhatsAppStatusCallback(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	msgSid := r.FormValue("MessageSid")
	status := r.FormValue("MessageStatus")

	log.Printf("WhatsApp status update: SID=%s Status=%s", msgSid, status)

	w.WriteHeader(http.StatusOK)
}

// truncate shortens a string to maxLen, appending "..." if truncated.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
