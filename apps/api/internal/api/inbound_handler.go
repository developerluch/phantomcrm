package api

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"phantomcrm-api/internal/db"
	"phantomcrm-api/internal/sms"
)

// handleInboundRecruit receives new leads from the TFC website.
// Uses Bearer API_TOKEN for service-to-service auth (NOT behind auth middleware).
func (s *Server) handleInboundRecruit(w http.ResponseWriter, r *http.Request) {
	// Manual auth check: Bearer API_TOKEN
	auth := r.Header.Get("Authorization")
	token := strings.TrimPrefix(auth, "Bearer ")
	if token == auth || s.cfg.APIToken == "" || subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.APIToken)) != 1 {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		City      string `json:"city"`
		Source    string `json:"source"`
		Reason    string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.FirstName == "" || req.LastName == "" {
		jsonError(w, "firstName and lastName are required", http.StatusBadRequest)
		return
	}
	if req.Email == "" && req.Phone == "" {
		jsonError(w, "email or phone is required", http.StatusBadRequest)
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
			jsonOK(w, map[string]interface{}{"status": "existing", "recruit": existing})
			return
		}
	}
	if req.Phone != "" {
		existing, _ := s.db.FindRecruitByPhone(r.Context(), req.Phone)
		if existing != nil {
			jsonOK(w, map[string]interface{}{"status": "existing", "recruit": existing})
			return
		}
	}

	// Create new recruit
	phone := req.Phone
	city := req.City
	source := req.Source
	reason := req.Reason
	recruit := &db.Recruit{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Stage:     "NEW_LEAD",
	}
	if phone != "" {
		recruit.Phone = &phone
	}
	if city != "" {
		recruit.City = &city
	}
	if source != "" {
		recruit.Source = &source
	}
	if reason != "" {
		recruit.Reason = &reason
	}

	id, err := s.db.CreateRecruit(r.Context(), recruit)
	if err != nil {
		log.Printf("API: inbound recruit create: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
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
		"message": "**New Website Lead**\n" + req.FirstName + " " + req.LastName + "\nEmail: " + req.Email + "\nPhone: " + req.Phone,
	})

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "created", "recruit": created})
}
