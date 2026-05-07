package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"phantomcrm-api/internal/db"
)

type createCampaignRequest struct {
	OrgID           string          `json:"orgId"`
	CreatedBy       string          `json:"createdBy"`
	Name            string          `json:"name"`
	Channel         string          `json:"channel"`
	TargetType      string          `json:"targetType"`
	TargetFilter    json.RawMessage `json:"targetFilter"`
	MessageTemplate string          `json:"messageTemplate"`
	Status          string          `json:"status"`
	ScheduledAt     *time.Time      `json:"scheduledAt"`
}

type updateCampaignStatusRequest struct {
	Status string `json:"status"`
}

func (s *Server) handleListCampaigns(w http.ResponseWriter, r *http.Request) {
	campaigns, err := s.db.ListCampaigns(r.Context())
	if err != nil {
		log.Printf("API: failed to list campaigns: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if campaigns == nil {
		campaigns = []db.Campaign{}
	}
	jsonOK(w, campaigns)
}

func (s *Server) handleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	var req createCampaignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	c := db.Campaign{
		OrgID:           req.OrgID,
		CreatedBy:       req.CreatedBy,
		Name:            req.Name,
		Channel:         req.Channel,
		TargetType:      req.TargetType,
		TargetFilter:    req.TargetFilter,
		MessageTemplate: req.MessageTemplate,
		Status:          req.Status,
		ScheduledAt:     req.ScheduledAt,
	}

	id, err := s.db.CreateCampaign(r.Context(), c)
	if err != nil {
		log.Printf("API: failed to create campaign: %v", err)
		jsonError(w, "failed to create campaign", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": id, "status": "created"})
}

func (s *Server) handleGetCampaign(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("campaignID")
	if campaignID == "" {
		jsonError(w, "missing campaignID", http.StatusBadRequest)
		return
	}

	campaign, err := s.db.GetCampaign(r.Context(), campaignID)
	if err != nil {
		log.Printf("API: failed to get campaign %s: %v", campaignID, err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if campaign == nil {
		jsonError(w, "campaign not found", http.StatusNotFound)
		return
	}

	jsonOK(w, campaign)
}

func (s *Server) handleUpdateCampaignStatus(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("campaignID")
	if campaignID == "" {
		jsonError(w, "missing campaignID", http.StatusBadRequest)
		return
	}

	var req updateCampaignStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Status == "" {
		jsonError(w, "status is required", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateCampaignStatus(r.Context(), campaignID, req.Status); err != nil {
		log.Printf("API: failed to update campaign status %s: %v", campaignID, err)
		jsonError(w, "failed to update campaign status", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": campaignID, "status": req.Status})
}

func (s *Server) handleDeleteCampaign(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("campaignID")
	if campaignID == "" {
		jsonError(w, "missing campaignID", http.StatusBadRequest)
		return
	}

	if err := s.db.DeleteCampaign(r.Context(), campaignID); err != nil {
		log.Printf("API: failed to delete campaign %s: %v", campaignID, err)
		jsonError(w, "failed to delete campaign", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": campaignID, "status": "deleted"})
}
