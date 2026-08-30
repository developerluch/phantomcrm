package api

import (
	"log"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleFinanceSummary(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	summary, err := s.db.GetFinanceSummary(r.Context(), q.Get("dateFrom"), q.Get("dateTo"))
	if err != nil {
		log.Printf("API: finance summary: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, summary)
}

func (s *Server) handleAgentPL(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("discordID")
	q := r.URL.Query()
	pl, err := s.db.GetAgentPL(r.Context(), agentID, q.Get("dateFrom"), q.Get("dateTo"))
	if err != nil {
		log.Printf("API: agent P&L: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, pl)
}

func (s *Server) handleLeadROI(w http.ResponseWriter, r *http.Request) {
	roi, err := s.db.GetLeadROI(r.Context())
	if err != nil {
		log.Printf("API: lead ROI: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if roi == nil {
		roi = []db.LeadROI{}
	}
	jsonOK(w, roi)
}

func (s *Server) handleFinanceExport(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=finance_export.csv")

	if err := s.db.WriteExpensesCsv(r.Context(), w, q.Get("dateFrom"), q.Get("dateTo")); err != nil {
		log.Printf("API: finance export: %v", err)
	}
}
