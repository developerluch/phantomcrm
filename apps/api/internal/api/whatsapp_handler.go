package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"phantomcrm-api/internal/db"
)

type upsertSessionRequest struct {
	VADiscordID     string     `json:"vaDiscordId"`
	VAName          string     `json:"vaName"`
	PhoneNumber     string     `json:"phoneNumber"`
	Status          string     `json:"status"`
	LastConnectedAt *time.Time `json:"lastConnectedAt"`
}

type createMessageRequest struct {
	ConversationID string `json:"conversationId"`
	Sender         string `json:"sender"`
	Body           string `json:"body"`
	MediaURL       string `json:"mediaUrl"`
	MediaType      string `json:"mediaType"`
	IsFromContact  bool   `json:"isFromContact"`
	Send           bool   `json:"send"`      // When true, send via Twilio WhatsApp before recording
	To             string `json:"to"`        // Phone number to send to (required when send=true)
	RecruitID      string `json:"recruitId"` // Optional: link conversation to a recruit
}

func (s *Server) handleListWhatsAppSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.db.ListWhatsAppSessions(r.Context())
	if err != nil {
		log.Printf("API: failed to list whatsapp sessions: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if sessions == nil {
		sessions = []db.WhatsAppSession{}
	}
	jsonOK(w, sessions)
}

func (s *Server) handleUpsertWhatsAppSession(w http.ResponseWriter, r *http.Request) {
	var req upsertSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.VADiscordID == "" {
		jsonError(w, "vaDiscordId is required", http.StatusBadRequest)
		return
	}

	session := db.WhatsAppSession{
		VADiscordID:     req.VADiscordID,
		VAName:          req.VAName,
		PhoneNumber:     req.PhoneNumber,
		Status:          req.Status,
		LastConnectedAt: req.LastConnectedAt,
	}

	id, err := s.db.UpsertWhatsAppSession(r.Context(), session)
	if err != nil {
		log.Printf("API: failed to upsert whatsapp session: %v", err)
		jsonError(w, "failed to create/update session", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": id, "status": "ok"})
}

func (s *Server) handleListWhatsAppConversations(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("sessionID")
	if sessionID == "" {
		jsonError(w, "missing sessionID", http.StatusBadRequest)
		return
	}

	conversations, err := s.db.ListConversations(r.Context(), sessionID)
	if err != nil {
		log.Printf("API: failed to list conversations for session %s: %v", sessionID, err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if conversations == nil {
		conversations = []db.WhatsAppConversation{}
	}
	jsonOK(w, conversations)
}

func (s *Server) handleCreateWhatsAppMessage(w http.ResponseWriter, r *http.Request) {
	var req createMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Body == "" {
		jsonError(w, "body is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Send via Twilio WhatsApp if requested
	if req.Send {
		if req.To == "" {
			jsonError(w, "to is required when send=true", http.StatusBadRequest)
			return
		}
		if s.smsClient == nil {
			jsonError(w, "WhatsApp not configured", http.StatusServiceUnavailable)
			return
		}

		sid, err := s.smsClient.SendWhatsApp(req.To, req.Body)
		if err != nil {
			log.Printf("API: WhatsApp send to %s failed: %v", req.To, err)
			jsonError(w, "failed to send WhatsApp message", http.StatusInternalServerError)
			return
		}

		// Find or create conversation for this phone
		conv, err := s.db.FindOrCreateConversationByPhone(ctx, req.To, "")
		if err != nil {
			log.Printf("API: find/create conversation for %s: %v", req.To, err)
			jsonError(w, "failed to create conversation", http.StatusInternalServerError)
			return
		}

		// Link to recruit if provided
		if req.RecruitID != "" {
			_ = s.db.LinkConversationToRecruit(ctx, conv.ID, req.RecruitID)
		}

		// Record the message
		msg := db.WhatsAppMessage{
			ConversationID: conv.ID,
			Sender:         "system",
			Body:           req.Body,
			IsFromContact:  false,
		}
		msgID, err := s.db.CreateMessage(ctx, msg)
		if err != nil {
			log.Printf("API: record WhatsApp message: %v", err)
		}

		jsonOK(w, map[string]string{"id": msgID, "sid": sid, "conversationId": conv.ID, "status": "sent"})
		return
	}

	// Default: DB-only record (existing behavior)
	if req.ConversationID == "" {
		jsonError(w, "conversationId is required when send=false", http.StatusBadRequest)
		return
	}

	msg := db.WhatsAppMessage{
		ConversationID: req.ConversationID,
		Sender:         req.Sender,
		Body:           req.Body,
		MediaURL:       req.MediaURL,
		MediaType:      req.MediaType,
		IsFromContact:  req.IsFromContact,
	}

	id, err := s.db.CreateMessage(ctx, msg)
	if err != nil {
		log.Printf("API: failed to create whatsapp message: %v", err)
		jsonError(w, "failed to create message", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": id, "status": "created"})
}

func (s *Server) handleListWhatsAppMessages(w http.ResponseWriter, r *http.Request) {
	conversationID := r.PathValue("conversationID")
	if conversationID == "" {
		jsonError(w, "missing conversationID", http.StatusBadRequest)
		return
	}

	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}

	messages, err := s.db.ListMessages(r.Context(), conversationID, limit)
	if err != nil {
		log.Printf("API: failed to list messages for conversation %s: %v", conversationID, err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []db.WhatsAppMessage{}
	}
	jsonOK(w, messages)
}

func (s *Server) handleListAllWhatsAppConversations(w http.ResponseWriter, r *http.Request) {
	conversations, err := s.db.ListAllConversations(r.Context())
	if err != nil {
		log.Printf("API: failed to list all whatsapp conversations: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if conversations == nil {
		conversations = []db.WhatsAppConversation{}
	}
	jsonOK(w, conversations)
}

func (s *Server) handleLinkConversationToRecruit(w http.ResponseWriter, r *http.Request) {
	conversationID := r.PathValue("conversationID")
	if conversationID == "" {
		jsonError(w, "missing conversationID", http.StatusBadRequest)
		return
	}

	var req struct {
		RecruitID string `json:"recruitId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RecruitID == "" {
		jsonError(w, "recruitId is required", http.StatusBadRequest)
		return
	}

	if err := s.db.LinkConversationToRecruit(r.Context(), conversationID, req.RecruitID); err != nil {
		log.Printf("API: failed to link conversation %s to recruit %s: %v", conversationID, req.RecruitID, err)
		jsonError(w, "failed to link conversation", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "linked"})
}
