package api

import (
	"encoding/json"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

type updateUserRequest struct {
	RoleID      *string `json:"roleId"`
	IsActive    *bool   `json:"isActive"`
	DisplayName *string `json:"displayName"`
}

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.db.ListUsers(r.Context())
	if err != nil {
		log.Printf("API: failed to list users: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if users == nil {
		users = []db.User{}
	}
	jsonOK(w, users)
}

func (s *Server) handleGetUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		jsonError(w, "missing userID", http.StatusBadRequest)
		return
	}

	user, err := s.db.GetUserByID(r.Context(), userID)
	if err != nil {
		log.Printf("API: failed to get user %s: %v", userID, err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if user == nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}

	jsonOK(w, user)
}

func (s *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		jsonError(w, "missing userID", http.StatusBadRequest)
		return
	}

	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	updates := db.UserUpdate{
		RoleID:      req.RoleID,
		IsActive:    req.IsActive,
		DisplayName: req.DisplayName,
	}

	if err := s.db.UpdateUser(r.Context(), userID, updates); err != nil {
		log.Printf("API: failed to update user %s: %v", userID, err)
		jsonError(w, "failed to update user", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": userID, "status": "updated"})
}
