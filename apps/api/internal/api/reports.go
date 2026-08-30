package api

import (
	"log"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// handleAgentReport returns a summary report of all agents.
func (s *Server) handleAgentReport(w http.ResponseWriter, r *http.Request) {
	agents, err := s.db.GetAllAgents(r.Context(), false)
	if err != nil {
		log.Printf("API: failed to get agents for report: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if agents == nil {
		agents = []db.Agent{}
	}
	jsonOK(w, agents)
}

// handleProductionReport returns production data using WAVV leaderboard data.
func (s *Server) handleProductionReport(w http.ResponseWriter, r *http.Request) {
	from, to := parseDateRange(r)

	leaderboard, err := s.db.GetWavvAgentLeaderboard(r.Context(), from, to)
	if err != nil {
		log.Printf("API: failed to get production report: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if leaderboard == nil {
		leaderboard = []db.WavvAgentRollup{}
	}
	jsonOK(w, leaderboard)
}
