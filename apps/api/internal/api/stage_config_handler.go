package api

import (
	"encoding/json"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

func (s *Server) handleListStageConfigs(w http.ResponseWriter, r *http.Request) {
	configs, err := s.db.ListStageConfigs(r.Context())
	if err != nil {
		log.Printf("API: list stage configs: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if configs == nil {
		configs = []db.StageConfig{}
	}
	jsonOK(w, configs)
}

func (s *Server) handleUpdateStageConfig(w http.ResponseWriter, r *http.Request) {
	stage := r.PathValue("stage")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateStageConfig(r.Context(), stage, updates); err != nil {
		log.Printf("API: update stage config: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	cfg, _ := s.db.GetStageConfig(r.Context(), stage)
	if cfg != nil {
		jsonOK(w, cfg)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}
