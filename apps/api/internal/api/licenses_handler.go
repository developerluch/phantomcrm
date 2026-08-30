package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleListLicenses(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	licenses, err := s.db.ListLicenses(r.Context(), q.Get("agentId"), q.Get("state"), q.Get("status"))
	if err != nil {
		log.Printf("API: list licenses: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if licenses == nil {
		licenses = []db.License{}
	}
	jsonOK(w, licenses)
}

func (s *Server) handleGetLicense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("licenseID")
	license, err := s.db.GetLicense(r.Context(), id)
	if err != nil {
		log.Printf("API: get license: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if license == nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	jsonOK(w, license)
}

func (s *Server) handleCreateLicense(w http.ResponseWriter, r *http.Request) {
	var req db.License
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.AgentID == "" || req.State == "" || req.LicenseNumber == "" {
		jsonError(w, "agentId, state, and licenseNumber are required", http.StatusBadRequest)
		return
	}
	if req.Status == "" {
		req.Status = "PENDING"
	}

	id, err := s.db.CreateLicense(r.Context(), &req)
	if err != nil {
		log.Printf("API: create license: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	license, _ := s.db.GetLicense(r.Context(), id)
	if license != nil {
		jsonOK(w, license)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) handleUpdateLicense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("licenseID")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateLicense(r.Context(), id, updates); err != nil {
		log.Printf("API: update license: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	license, _ := s.db.GetLicense(r.Context(), id)
	if license != nil {
		jsonOK(w, license)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleDeleteLicense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("licenseID")
	if err := s.db.DeleteLicense(r.Context(), id); err != nil {
		log.Printf("API: delete license: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
