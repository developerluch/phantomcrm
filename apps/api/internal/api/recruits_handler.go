package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
	"github.com/developerluch/phantomcrm/apps/api/internal/sms"
)

func (s *Server) handleListRecruits(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("perPage"))
	if perPage == 0 {
		perPage = 25
	}

	recruits, total, err := s.db.ListRecruits(r.Context(), q.Get("search"), q.Get("stage"), page, perPage)
	if err != nil {
		log.Printf("API: list recruits: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if recruits == nil {
		recruits = []db.Recruit{}
	}

	pageCount := (total + perPage - 1) / perPage
	jsonOK(w, map[string]interface{}{
		"recruits":  recruits,
		"total":     total,
		"page":      page,
		"perPage":   perPage,
		"pageCount": pageCount,
	})
}

func (s *Server) handleGetRecruit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("recruitID")
	recruit, err := s.db.GetRecruit(r.Context(), id)
	if err != nil {
		log.Printf("API: get recruit: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if recruit == nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	jsonOK(w, recruit)
}

func (s *Server) handleCreateRecruit(w http.ResponseWriter, r *http.Request) {
	var req db.Recruit
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.FirstName == "" || req.LastName == "" || req.Email == "" {
		jsonError(w, "firstName, lastName, and email are required", http.StatusBadRequest)
		return
	}
	if req.Stage == "" {
		req.Stage = "NEW_LEAD"
	}

	if req.AssignedManagerID == nil || *req.AssignedManagerID == "" {
		if user := GetAuthUser(r); user != nil && user.DiscordID != "" {
			req.AssignedManagerID = &user.DiscordID
		}
	}

	id, err := s.db.CreateRecruit(r.Context(), &req)
	if err != nil {
		log.Printf("API: create recruit: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	recruit, _ := s.db.GetRecruit(r.Context(), id)
	if recruit != nil {
		jsonOK(w, recruit)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) handleUpdateRecruit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("recruitID")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Capture old stage for transition hooks
	existing, _ := s.db.GetRecruit(r.Context(), id)
	oldStage := ""
	if existing != nil {
		oldStage = existing.Stage
	}

	if err := s.db.UpdateRecruit(r.Context(), id, updates); err != nil {
		log.Printf("API: update recruit: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	recruit, _ := s.db.GetRecruit(r.Context(), id)

	// Fire stage change hooks if stage changed
	if newStage, ok := updates["stage"]; ok {
		if ns, isStr := newStage.(string); isStr && ns != oldStage {
			go s.onRecruitStageChange(context.Background(), recruit, oldStage, ns)
		}
	}

	if recruit != nil {
		jsonOK(w, recruit)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleDeleteRecruit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("recruitID")
	if err := s.db.DeleteRecruit(r.Context(), id); err != nil {
		log.Printf("API: delete recruit: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRecruitStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.db.GetRecruitStats(r.Context())
	if err != nil {
		log.Printf("API: recruit stats: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, stats)
}

func (s *Server) handleRecruitSms(w http.ResponseWriter, r *http.Request) {
	recruitID := r.PathValue("recruitID")
	var req struct {
		Body     string `json:"body"`
		ToNumber string `json:"toNumber"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var providerID *string
	var fromNumber *string
	status := "sent"

	// Normalize phone and send via Twilio if configured
	req.ToNumber = sms.NormalizePhone(req.ToNumber)
	if s.smsClient != nil && req.ToNumber != "" {
		sid, err := s.smsClient.Send(req.ToNumber, req.Body)
		if err != nil {
			log.Printf("API: twilio send failed: %v", err)
			jsonError(w, "SMS send failed: "+err.Error(), http.StatusBadGateway)
			return
		}
		providerID = &sid
		from := s.smsClient.FromNumber()
		fromNumber = &from
	}

	msg := &db.SmsMessage{
		RecruitID:  &recruitID,
		ToNumber:   req.ToNumber,
		FromNumber: fromNumber,
		Body:       req.Body,
		Direction:  "outbound",
		Status:     &status,
		ProviderID: providerID,
	}
	id, err := s.db.CreateSmsMessage(r.Context(), msg)
	if err != nil {
		log.Printf("API: recruit sms: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"id": id, "status": "sent"})
}

func (s *Server) handleScheduleRecruitInterview(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("recruitID")
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	existing, _ := s.db.GetRecruit(r.Context(), id)
	oldStage := ""
	if existing != nil {
		oldStage = existing.Stage
	}

	updates := map[string]interface{}{
		"stage": "SCHEDULED",
	}
	if v, ok := req["interviewType"]; ok {
		updates["interviewType"] = v
	}
	if v, ok := req["date"]; ok {
		updates["interviewDate"] = v
	}

	if err := s.db.UpdateRecruit(r.Context(), id, updates); err != nil {
		log.Printf("API: schedule interview: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	recruit, _ := s.db.GetRecruit(r.Context(), id)
	if oldStage != "SCHEDULED" {
		go s.onRecruitStageChange(context.Background(), recruit, oldStage, "SCHEDULED")
	}
	jsonOK(w, recruit)
}

func (s *Server) handleOnboardRecruit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("recruitID")

	existing, _ := s.db.GetRecruit(r.Context(), id)
	oldStage := ""
	if existing != nil {
		oldStage = existing.Stage
	}

	updates := map[string]interface{}{"stage": "ONBOARDED"}
	if err := s.db.UpdateRecruit(r.Context(), id, updates); err != nil {
		log.Printf("API: onboard recruit: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	recruit, _ := s.db.GetRecruit(r.Context(), id)
	if oldStage != "ONBOARDED" {
		go s.onRecruitStageChange(context.Background(), recruit, oldStage, "ONBOARDED")
	}
	jsonOK(w, map[string]interface{}{"recruit": recruit, "agent": nil})
}

// handlePublicApply handles public recruit applications from the website (no auth required).
func (s *Server) handlePublicApply(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Phone     string `json:"phone,omitempty"`
		City      string `json:"city,omitempty"`
		Source    string `json:"source,omitempty"`
		Reason    string `json:"reason,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.FirstName == "" || req.LastName == "" || req.Email == "" {
		jsonError(w, "firstName, lastName, and email are required", http.StatusBadRequest)
		return
	}

	// Normalize
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Phone != "" {
		req.Phone = sms.NormalizePhone(req.Phone)
	}
	if req.Source == "" {
		req.Source = "website"
	}

	// Dedup: check email first, then phone
	if req.Email != "" {
		existing, _ := s.db.FindRecruitByEmail(r.Context(), req.Email)
		if existing != nil {
			jsonOK(w, map[string]interface{}{"status": "existing", "id": existing.ID})
			return
		}
	}
	if req.Phone != "" {
		existing, _ := s.db.FindRecruitByPhone(r.Context(), req.Phone)
		if existing != nil {
			jsonOK(w, map[string]interface{}{"status": "existing", "id": existing.ID})
			return
		}
	}

	// Create new recruit
	recruit := &db.Recruit{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Stage:     "NEW_LEAD",
	}
	if req.Phone != "" {
		recruit.Phone = &req.Phone
	}
	if req.City != "" {
		recruit.City = &req.City
	}
	if req.Source != "" {
		recruit.Source = &req.Source
	}
	if req.Reason != "" {
		recruit.Reason = &req.Reason
	}

	id, err := s.db.CreateRecruit(r.Context(), recruit)
	if err != nil {
		log.Printf("API: public apply: %v", err)
		jsonError(w, "application error", http.StatusInternalServerError)
		return
	}

	created, _ := s.db.GetRecruit(r.Context(), id)

	// Fire stage hooks for NEW_LEAD (welcome SMS)
	if created != nil {
		go s.onRecruitStageChange(context.Background(), created, "", "NEW_LEAD")
	}

	// Queue Discord notification
	luckyDiscordID := int64(771166989418496022)
	s.db.CreatePendingAction(r.Context(), "send_dm", luckyDiscordID, map[string]string{
		"message": "**New Website Application**\n" + req.FirstName + " " + req.LastName + "\nEmail: " + req.Email + "\nPhone: " + req.Phone,
	})

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "received"})
}

func (s *Server) handleRecruitMessages(w http.ResponseWriter, r *http.Request) {
	recruitID := r.PathValue("recruitID")
	messages, _, err := s.db.ListSmsMessages(r.Context(), "", recruitID, 1, 100)
	if err != nil {
		log.Printf("API: recruit messages: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []db.SmsMessage{}
	}
	jsonOK(w, messages)
}

func (s *Server) handleBulkImportRecruits(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Recruits []struct {
			FirstName  string `json:"firstName"`
			LastName   string `json:"lastName"`
			Phone      string `json:"phone"`
			Tags       string `json:"tags"`
			SmsMessage string `json:"smsMessage"`
			Source     string `json:"source"`
		} `json:"recruits"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Recruits) > 500 {
		jsonError(w, "maximum 500 recruits per import", http.StatusBadRequest)
		return
	}

	user := GetAuthUser(r)
	var managerID *string
	if user != nil && user.DiscordID != "" {
		managerID = &user.DiscordID
	}

	created, skipped, queued := 0, 0, 0
	for _, row := range req.Recruits {
		if row.FirstName == "" || row.LastName == "" {
			skipped++
			continue
		}

		// Normalize phone
		phone := sms.NormalizePhone(row.Phone)

		// Dedup by phone
		if phone != "" {
			existing, _ := s.db.FindRecruitByPhone(r.Context(), phone)
			if existing != nil {
				skipped++
				continue
			}
		}

		recruit := &db.Recruit{
			FirstName:         row.FirstName,
			LastName:          row.LastName,
			Stage:             "NEW_LEAD",
			AssignedManagerID: managerID,
		}
		if phone != "" {
			recruit.Phone = &phone
		}
		if row.Source != "" {
			recruit.Source = &row.Source
		}

		id, err := s.db.CreateRecruit(r.Context(), recruit)
		if err != nil {
			log.Printf("API: bulk import create: %v", err)
			skipped++
			continue
		}
		created++

		// Queue SMS if provided and Twilio configured
		if row.SmsMessage != "" && phone != "" && s.smsClient != nil {
			recruitObj, _ := s.db.GetRecruit(r.Context(), id)
			if recruitObj != nil {
				s.sendAutoSms(r.Context(), recruitObj, row.SmsMessage)
				queued++
			}
		}
	}

	jsonOK(w, map[string]int{
		"created": created,
		"skipped": skipped,
		"queued":  queued,
	})
}
