package api

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"phantomcrm-api/internal/api/websocket"
	"phantomcrm-api/internal/db"
	"phantomcrm-api/internal/sms"
)

// handleWhatsAppWebhook receives inbound WhatsApp messages from Twilio.
// Route: POST /api/v1/whatsapp/webhook (unauthenticated — Twilio calls directly)
func (s *Server) handleWhatsAppWebhook(w http.ResponseWriter, r *http.Request) {
	if !s.validateTwilioSignature(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	from := r.FormValue("From")               // "whatsapp:+15551234567"
	body := r.FormValue("Body")
	msgSid := r.FormValue("MessageSid")
	profileName := r.FormValue("ProfileName") // WhatsApp display name

	// Strip "whatsapp:" prefix for phone lookup
	cleanPhone := strings.TrimPrefix(from, "whatsapp:")
	cleanPhone = sms.NormalizePhone(cleanPhone)

	log.Printf("WhatsApp inbound from %s (%s): %s [SID: %s]", cleanPhone, profileName, truncate(body, 80), msgSid)

	ctx := r.Context()

	// 1. Find or create conversation
	conv, err := s.db.FindOrCreateConversationByPhone(ctx, cleanPhone, profileName)
	if err != nil {
		log.Printf("whatsapp webhook: find/create conversation: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// 2. Store the message
	msg := db.WhatsAppMessage{
		ConversationID: conv.ID,
		Sender:         profileName,
		Body:           body,
		IsFromContact:  true,
	}
	msgID, err := s.db.CreateMessage(ctx, msg)
	if err != nil {
		log.Printf("whatsapp webhook: create message: %v", err)
	}

	// Update conversation last_message_at
	_ = s.db.UpdateConversationLastMessage(ctx, conv.ID, true)

	// 3. Check for opt-out keywords
	upperBody := strings.ToUpper(strings.TrimSpace(body))
	if upperBody == "STOP" || upperBody == "UNSUBSCRIBE" || upperBody == "CANCEL" || upperBody == "QUIT" {
		s.handleOptOut(ctx, cleanPhone, conv.ID)
		w.Header().Set("Content-Type", "text/xml")
		w.Write([]byte("<Response></Response>"))
		return
	}

	// 4. Try to match to a recruit
	recruit, _ := s.db.FindRecruitByPhone(ctx, cleanPhone)
	if recruit != nil {
		// Link conversation to recruit if not already linked
		if conv.RecruitID == nil || *conv.RecruitID != recruit.ID {
			_ = s.db.LinkConversationToRecruit(ctx, conv.ID, recruit.ID)
		}
	}

	// 5. Broadcast WebSocket event
	eventData := map[string]interface{}{
		"conversationId": conv.ID,
		"messageId":      msgID,
		"from":           cleanPhone,
		"body":           body,
		"profileName":    profileName,
	}
	if recruit != nil {
		eventData["recruitId"] = recruit.ID
	}
	s.hub.Publish(websocket.NewEvent("whatsapp:message_received", eventData))

	// 6. Return empty TwiML (no auto-reply — drip campaign handles responses)
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
