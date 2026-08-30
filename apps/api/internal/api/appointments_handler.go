package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleListAppointments(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("perPage"))
	if perPage == 0 {
		perPage = 25
	}

	appointments, total, err := s.db.ListAppointments(r.Context(), q.Get("status"), page, perPage)
	if err != nil {
		log.Printf("API: list appointments: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if appointments == nil {
		appointments = []db.Appointment{}
	}

	pageCount := (total + perPage - 1) / perPage
	jsonOK(w, map[string]interface{}{
		"appointments": appointments,
		"total":        total,
		"page":         page,
		"perPage":      perPage,
		"pageCount":    pageCount,
	})
}

func (s *Server) handleListUpcomingAppointments(w http.ResponseWriter, r *http.Request) {
	appointments, err := s.db.ListUpcomingAppointments(r.Context())
	if err != nil {
		log.Printf("API: upcoming appointments: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if appointments == nil {
		appointments = []db.Appointment{}
	}
	jsonOK(w, appointments)
}

func (s *Server) handleCreateAppointment(w http.ResponseWriter, r *http.Request) {
	var req db.Appointment
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Title == "" || req.AgentID == "" {
		jsonError(w, "title and agentId are required", http.StatusBadRequest)
		return
	}
	if req.Status == "" {
		req.Status = "scheduled"
	}

	id, err := s.db.CreateAppointment(r.Context(), &req)
	if err != nil {
		log.Printf("API: create appointment: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	appt, _ := s.db.GetAppointment(r.Context(), id)
	if appt != nil {
		jsonOK(w, appt)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) handleUpdateAppointmentStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("appointmentID")
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.db.UpdateAppointmentStatus(r.Context(), id, req.Status); err != nil {
		log.Printf("API: update appointment status: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	appt, _ := s.db.GetAppointment(r.Context(), id)
	if appt != nil {
		jsonOK(w, appt)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) handleDeleteAppointment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("appointmentID")
	if err := s.db.DeleteAppointment(r.Context(), id); err != nil {
		log.Printf("API: delete appointment: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
