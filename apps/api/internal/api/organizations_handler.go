package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleListOrganizations(w http.ResponseWriter, r *http.Request) {
	orgs, err := s.db.ListOrganizations(r.Context())
	if err != nil {
		log.Printf("API: list organizations: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if orgs == nil {
		orgs = []db.Organization{}
	}
	jsonOK(w, orgs)
}

func (s *Server) handleGetOrganization(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	org, err := s.db.GetOrganization(r.Context(), id)
	if err != nil {
		log.Printf("API: get organization: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if org == nil {
		jsonError(w, "organization not found", http.StatusNotFound)
		return
	}
	jsonOK(w, org)
}

func (s *Server) handleCreateOrganization(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.Slug == "" {
		jsonError(w, "name and slug are required", http.StatusBadRequest)
		return
	}

	id, err := s.db.CreateOrganization(r.Context(), req.Name, req.Slug)
	if err != nil {
		log.Printf("API: create organization: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	org, _ := s.db.GetOrganization(r.Context(), id)
	if org != nil {
		jsonOK(w, org)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) handleUpdateOrganization(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.Slug == "" {
		jsonError(w, "name and slug are required", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateOrganization(r.Context(), id, req.Name, req.Slug); err != nil {
		log.Printf("API: update organization: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	org, _ := s.db.GetOrganization(r.Context(), id)
	if org != nil {
		jsonOK(w, org)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleDeleteOrganization(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.db.DeleteOrganization(r.Context(), id); err != nil {
		log.Printf("API: delete organization: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
