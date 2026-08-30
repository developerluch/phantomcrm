package api

import (
	"log"
	"net/http"
	"strconv"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

func (s *Server) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("perPage"))
	if perPage == 0 {
		perPage = 25
	}

	notifications, total, err := s.db.ListNotifications(r.Context(), user.UserID, q.Get("type"), page, perPage)
	if err != nil {
		log.Printf("API: list notifications: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if notifications == nil {
		notifications = []db.Notification{}
	}

	pageCount := (total + perPage - 1) / perPage
	jsonOK(w, map[string]interface{}{
		"notifications": notifications,
		"total":         total,
		"page":          page,
		"perPage":       perPage,
		"pageCount":     pageCount,
	})
}

func (s *Server) handleUnreadNotificationCount(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	count, err := s.db.GetUnreadNotificationCount(r.Context(), user.UserID)
	if err != nil {
		log.Printf("API: unread count: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]int{"count": count})
}

func (s *Server) handleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("notificationID")
	if err := s.db.MarkNotificationRead(r.Context(), id); err != nil {
		log.Printf("API: mark read: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := s.db.MarkAllNotificationsRead(r.Context(), user.UserID); err != nil {
		log.Printf("API: mark all read: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
