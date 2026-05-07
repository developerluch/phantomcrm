package api

import (
	"encoding/json"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

type createBugReportRequest struct {
	Description string `json:"description"`
	Severity    string `json:"severity"`
	PageURL     string `json:"pageUrl"`
	UserAgent   string `json:"userAgent"`
}

func (s *Server) handleCreateBugReport(w http.ResponseWriter, r *http.Request) {
	var req createBugReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Description == "" {
		jsonError(w, "description is required", http.StatusBadRequest)
		return
	}

	// Extract user ID from auth context if available
	userID := ""
	if au := GetAuthUser(r); au != nil {
		userID = au.UserID
	}

	br := db.BugReport{
		UserID:      userID,
		Description: req.Description,
		Severity:    req.Severity,
		PageURL:     req.PageURL,
		UserAgent:   req.UserAgent,
	}

	id, err := s.db.CreateBugReport(r.Context(), br)
	if err != nil {
		log.Printf("API: failed to create bug report: %v", err)
		jsonError(w, "failed to create bug report", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": id, "status": "created"})
}

func (s *Server) handleListBugReports(w http.ResponseWriter, r *http.Request) {
	reports, err := s.db.ListBugReports(r.Context())
	if err != nil {
		log.Printf("API: failed to list bug reports: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if reports == nil {
		reports = []db.BugReport{}
	}
	jsonOK(w, reports)
}
