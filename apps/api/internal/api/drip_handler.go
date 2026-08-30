package api

import (
	"encoding/json"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// handleListDripCampaigns returns all drip campaigns.
func (s *Server) handleListDripCampaigns(w http.ResponseWriter, r *http.Request) {
	campaigns, err := s.db.ListDripCampaigns(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaigns)
}

// handleCreateDripCampaign creates a new drip campaign.
func (s *Server) handleCreateDripCampaign(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string `json:"name"`
		Channel      string `json:"channel"`
		TriggerStage string `json:"triggerStage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.TriggerStage == "" {
		http.Error(w, "name and triggerStage are required", http.StatusBadRequest)
		return
	}
	if req.Channel == "" {
		req.Channel = "whatsapp"
	}
	id, err := s.db.CreateDripCampaign(r.Context(), db.DripCampaign{
		Name:         req.Name,
		Channel:      req.Channel,
		TriggerStage: req.TriggerStage,
		IsActive:     true,
	})
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": id})
}

// handleGetDripCampaign returns a single campaign with its steps.
func (s *Server) handleGetDripCampaign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	campaign, err := s.db.GetDripCampaign(r.Context(), id)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if campaign == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	steps, _ := s.db.ListDripSteps(r.Context(), id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"campaign": campaign,
		"steps":    steps,
	})
}

// handleUpdateDripCampaign updates a campaign.
func (s *Server) handleUpdateDripCampaign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := s.db.UpdateDripCampaign(r.Context(), id, updates); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeleteDripCampaign deletes a campaign and its steps (CASCADE).
func (s *Server) handleDeleteDripCampaign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.db.DeleteDripCampaign(r.Context(), id); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleListDripSteps returns all steps for a campaign.
func (s *Server) handleListDripSteps(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("id")
	steps, err := s.db.ListDripSteps(r.Context(), campaignID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(steps)
}

// handleCreateDripStep creates a new step in a campaign.
func (s *Server) handleCreateDripStep(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("id")
	var req struct {
		StepOrder       int    `json:"stepOrder"`
		DelayMinutes    int    `json:"delayMinutes"`
		MessageTemplate string `json:"messageTemplate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.MessageTemplate == "" {
		http.Error(w, "messageTemplate is required", http.StatusBadRequest)
		return
	}
	id, err := s.db.CreateDripStep(r.Context(), db.DripStep{
		CampaignID:      campaignID,
		StepOrder:       req.StepOrder,
		DelayMinutes:    req.DelayMinutes,
		MessageTemplate: req.MessageTemplate,
	})
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": id})
}

// handleUpdateDripStep updates a step.
func (s *Server) handleUpdateDripStep(w http.ResponseWriter, r *http.Request) {
	stepID := r.PathValue("stepID")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := s.db.UpdateDripStep(r.Context(), stepID, updates); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeleteDripStep deletes a step.
func (s *Server) handleDeleteDripStep(w http.ResponseWriter, r *http.Request) {
	stepID := r.PathValue("stepID")
	if err := s.db.DeleteDripStep(r.Context(), stepID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleListDripExecutions returns all executions for a campaign.
func (s *Server) handleListDripExecutions(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("id")
	executions, err := s.db.ListDripExecutions(r.Context(), campaignID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(executions)
}
