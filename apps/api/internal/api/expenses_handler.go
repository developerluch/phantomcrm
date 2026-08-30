package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleListExpenses(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))

	expenses, total, err := s.db.ListExpenses(r.Context(), q.Get("category"), q.Get("agentId"), q.Get("dateFrom"), q.Get("dateTo"), page)
	if err != nil {
		log.Printf("API: list expenses: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if expenses == nil {
		expenses = []db.Expense{}
	}
	jsonOK(w, map[string]interface{}{"expenses": expenses, "total": total})
}

func (s *Server) handleCreateExpense(w http.ResponseWriter, r *http.Request) {
	var req db.Expense
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Category == "" || req.Description == "" || req.Amount <= 0 {
		jsonError(w, "category, description, and positive amount are required", http.StatusBadRequest)
		return
	}
	if req.ExpenseDate == "" {
		req.ExpenseDate = "now()"
	}

	id, err := s.db.CreateExpense(r.Context(), &req)
	if err != nil {
		log.Printf("API: create expense: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	expense, _ := s.db.GetExpense(r.Context(), id)
	if expense != nil {
		jsonOK(w, expense)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) handleUpdateExpense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("expenseID")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateExpense(r.Context(), id, updates); err != nil {
		log.Printf("API: update expense: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	expense, _ := s.db.GetExpense(r.Context(), id)
	if expense != nil {
		jsonOK(w, expense)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleDeleteExpense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("expenseID")
	if err := s.db.DeleteExpense(r.Context(), id); err != nil {
		log.Printf("API: delete expense: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
