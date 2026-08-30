package api

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/channels"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleSendSms(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AgentID string `json:"agentId"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	msg := &db.SmsMessage{
		AgentID:   &req.AgentID,
		ToNumber:  "",
		Body:      req.Message,
		Direction: "outbound",
	}
	id, err := s.db.CreateSmsMessage(r.Context(), msg)
	if err != nil {
		log.Printf("API: send sms: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"id": id, "status": "queued"})
}

func (s *Server) handleSmsCampaign(w http.ResponseWriter, r *http.Request) {
	var req struct {
		StageID string `json:"stageId"`
		GuildID string `json:"guildId"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Campaign SMS is a placeholder — in production this would iterate agents
	jsonOK(w, map[string]int{"total": 0, "sent": 0, "failed": 0})
}

func (s *Server) handleSmsHistory(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("perPage"))
	if perPage == 0 {
		perPage = 25
	}

	messages, total, err := s.db.ListSmsMessages(r.Context(), q.Get("agent_id"), "", page, perPage)
	if err != nil {
		log.Printf("API: sms history: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []db.SmsMessage{}
	}

	pageCount := (total + perPage - 1) / perPage
	jsonOK(w, map[string]interface{}{
		"messages":  messages,
		"total":     total,
		"page":      page,
		"perPage":   perPage,
		"pageCount": pageCount,
	})
}

// validateTwilioSignature verifies the X-Twilio-Signature header using HMAC-SHA1.
func (s *Server) validateTwilioSignature(r *http.Request) bool {
	if s.cfg.TwilioAuthToken == "" {
		return true // Skip validation if no auth token configured (dev mode)
	}
	sig := r.Header.Get("X-Twilio-Signature")
	if sig == "" {
		return false
	}

	// Build the full URL Twilio used to sign
	scheme := "https"
	if fwd := r.Header.Get("X-Forwarded-Proto"); fwd != "" {
		scheme = fwd
	}
	fullURL := scheme + "://" + r.Host + r.RequestURI

	// Sort POST params and append to URL
	_ = r.ParseForm()
	params := make([]string, 0, len(r.PostForm))
	for k := range r.PostForm {
		params = append(params, k)
	}
	sort.Strings(params)
	data := fullURL
	for _, k := range params {
		data += k + r.PostFormValue(k)
	}

	mac := hmac.New(sha1.New, []byte(s.cfg.TwilioAuthToken))
	mac.Write([]byte(data))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(sig), []byte(expected))
}

// handleTwilioWebhook receives inbound SMS from Twilio.
//
// Behavior:
//   - Writes to the legacy `sms_messages` table for back-compat (recruit
//     drip/timeline still reads from it).
//   - Writes to the unified CRM M2A `conversations` + `messages` tables so
//     the new Inbox surfaces the message.
//   - Auto-creates a Contact if no match by phone (lifecycle='lead',
//     source_type='inbound_sms').
func (s *Server) handleTwilioWebhook(w http.ResponseWriter, r *http.Request) {
	if !s.validateTwilioSignature(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	from := r.FormValue("From")
	body := r.FormValue("Body")
	sid := r.FormValue("MessageSid")

	// Legacy: per-recruit sms_messages timeline.
	recruit, _ := s.db.FindRecruitByPhone(r.Context(), from)
	var recruitID *string
	if recruit != nil {
		recruitID = &recruit.ID
	}
	status := "received"
	legacy := &db.SmsMessage{
		RecruitID:  recruitID,
		ToNumber:   s.cfg.TwilioFromNumber,
		FromNumber: &from,
		Body:       body,
		Direction:  "inbound",
		Status:     &status,
		ProviderID: &sid,
	}
	s.db.CreateSmsMessage(r.Context(), legacy)

	if recruit != nil {
		s.hub.Publish(websocket.NewEvent("recruit:sms_received", map[string]interface{}{
			"recruitId": recruit.ID,
			"from":      from,
			"body":      body,
		}))
	}

	// Unified M2A: write into conversations + messages.
	res, err := s.upsertInboundMessage(r.Context(), inboundMessage{
		Phone:      from,
		Body:       body,
		ExternalID: sid,
		Channel:    channels.ChannelSMS,
		Provider:   "twilio",
		SourceType: "inbound_sms",
	})
	if err != nil {
		log.Printf("sms webhook: unified write: %v", err)
	} else {
		extra := map[string]any{}
		if recruit != nil {
			extra["recruitId"] = recruit.ID
		}
		s.broadcastInbound(res, extra)
	}

	// Return empty TwiML (no auto-reply)
	w.Header().Set("Content-Type", "text/xml")
	w.Write([]byte("<Response></Response>"))
}

// handleTwilioStatusCallback receives delivery status updates from Twilio.
func (s *Server) handleTwilioStatusCallback(w http.ResponseWriter, r *http.Request) {
	if !s.validateTwilioSignature(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	r.ParseForm()
	sid := r.FormValue("MessageSid")
	status := r.FormValue("MessageStatus")

	if sid != "" && status != "" {
		s.db.UpdateSmsStatus(r.Context(), sid, status)
	}
	w.WriteHeader(http.StatusNoContent)
}
