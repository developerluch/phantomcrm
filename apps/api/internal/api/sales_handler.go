package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"phantomcrm-api/internal/db"
)

func (s *Server) handleListSales(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))

	sales, total, agg, err := s.db.ListSales(r.Context(), q.Get("status"), q.Get("agentId"), q.Get("policyType"), q.Get("dateFrom"), q.Get("dateTo"), page)
	if err != nil {
		log.Printf("API: list sales: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if sales == nil {
		sales = []db.Sale{}
	}
	jsonOK(w, map[string]interface{}{
		"sales":        sales,
		"total":        total,
		"totalPremium": agg.TotalPremium,
		"activeCount":  agg.ActiveCount,
	})
}

func (s *Server) handleGetAgentSales(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("discordID")
	status := r.URL.Query().Get("status")
	sales, err := s.db.ListSalesByAgent(r.Context(), agentID, status)
	if err != nil {
		log.Printf("API: agent sales: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if sales == nil {
		sales = []db.Sale{}
	}
	jsonOK(w, sales)
}

func (s *Server) handleGetAgentSaleStats(w http.ResponseWriter, r *http.Request) {
	agentID := r.PathValue("discordID")
	stats, err := s.db.GetAgentSaleStats(r.Context(), agentID)
	if err != nil {
		log.Printf("API: agent sale stats: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, stats)
}

func (s *Server) handleCreateSale(w http.ResponseWriter, r *http.Request) {
	var req db.Sale
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	agentID, ok := s.resolveSaleAgentID(w, r, req.AgentID)
	if !ok {
		return
	}
	req.AgentID = agentID
	req.ClientName = strings.TrimSpace(req.ClientName)
	req.PolicyType = strings.TrimSpace(req.PolicyType)
	req.Carrier = strings.TrimSpace(req.Carrier)
	if req.ClientName == "" || req.PolicyType == "" || req.Carrier == "" {
		jsonError(w, "clientName, policyType, and carrier are required", http.StatusBadRequest)
		return
	}
	if req.Premium <= 0 {
		jsonError(w, "premium must be greater than 0", http.StatusBadRequest)
		return
	}
	if req.Status == "" {
		req.Status = "submitted"
	}

	id, err := s.db.CreateSale(r.Context(), &req)
	if err != nil {
		log.Printf("API: create sale: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	sale, _ := s.db.GetSale(r.Context(), id)
	if sale != nil {
		jsonOK(w, sale)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) resolveSaleAgentID(w http.ResponseWriter, r *http.Request, provided string) (string, bool) {
	agentID := strings.TrimSpace(provided)
	if agentID == "" {
		au := GetAuthUser(r)
		if au != nil {
			agentID = strings.TrimSpace(au.AgentID)
			if agentID == "" && au.UserID != "" && au.UserID != "system" {
				user, err := s.db.GetUserByID(r.Context(), au.UserID)
				if err != nil {
					log.Printf("API: resolve sale agent id: %v", err)
					jsonError(w, "database error", http.StatusInternalServerError)
					return "", false
				}
				if user != nil {
					agentID = strings.TrimSpace(user.AgentID)
				}
			}
		}
	}
	if agentID == "" {
		jsonError(w, "agentId is required and the current account does not have a provisioned Agent ID", http.StatusBadRequest)
		return "", false
	}

	exists, err := s.db.AgentIDExists(r.Context(), agentID)
	if err != nil {
		log.Printf("API: validate sale agent id: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return "", false
	}
	if !exists {
		jsonError(w, "unknown agentId", http.StatusBadRequest)
		return "", false
	}
	return agentID, true
}

func (s *Server) handleUpdateSale(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("saleID")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateSale(r.Context(), id, updates); err != nil {
		log.Printf("API: update sale: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	sale, _ := s.db.GetSale(r.Context(), id)
	if sale != nil {
		jsonOK(w, sale)

		// Check if status change should trigger a postcard
		if newStatus, ok := updates["status"].(string); ok && sale.PostcardSentAt == nil {
			go s.maybePostcard(sale, newStatus)
		}
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleDeleteSale(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("saleID")
	if err := s.db.DeleteSale(r.Context(), id); err != nil {
		log.Printf("API: delete sale: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleSalesPipeline returns aggregated counts + total AP per status bucket.
// Matches the frontend PipelineSummary contract (src/types/portal.ts).
// Added 2026-05-12 — previously missing, causing 405 since the path matched
// the PUT/DELETE /portal/sales/{saleID} pattern with saleID="pipeline".
func (s *Server) handleSalesPipeline(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	agentID := q.Get("agentId")
	dateFrom := q.Get("dateFrom")
	dateTo := q.Get("dateTo")

	summary, err := s.db.GetSalesPipelineSummary(r.Context(), agentID, dateFrom, dateTo)
	if err != nil {
		log.Printf("API: sales pipeline: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, summary)
}

// handleSalesAnalytics returns by-policy-type / by-month / by-lead-source /
// top-agents breakdowns. Mirrors frontend SalesAnalytics contract. Stub
// implementation that returns empty arrays for any data the schema doesn't
// support yet (lead source / commission top-agents); the by-policy-type and
// by-month buckets are real.
func (s *Server) handleSalesAnalytics(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	agentID := q.Get("agentId")
	dateFrom := q.Get("dateFrom")
	dateTo := q.Get("dateTo")

	analytics, err := s.db.GetSalesAnalytics(r.Context(), agentID, dateFrom, dateTo)
	if err != nil {
		log.Printf("API: sales analytics: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, analytics)
}
