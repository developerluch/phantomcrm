package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

type createRoleRequest struct {
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

type updateRoleRequest struct {
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

func (s *Server) handleListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := s.db.ListRoles(r.Context())
	if err != nil {
		log.Printf("API: failed to list roles: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if roles == nil {
		roles = []db.Role{}
	}
	jsonOK(w, roles)
}

func (s *Server) handleCreateRole(w http.ResponseWriter, r *http.Request) {
	var req createRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	if req.Permissions == nil {
		req.Permissions = []string{}
	}

	id, err := s.db.CreateRole(r.Context(), req.Name, req.Permissions)
	if err != nil {
		log.Printf("API: failed to create role: %v", err)
		jsonError(w, "failed to create role", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": id, "status": "created"})
}

func (s *Server) handleUpdateRole(w http.ResponseWriter, r *http.Request) {
	roleID := r.PathValue("roleID")
	if roleID == "" {
		jsonError(w, "missing roleID", http.StatusBadRequest)
		return
	}

	var req updateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	if req.Permissions == nil {
		req.Permissions = []string{}
	}

	if err := s.db.UpdateRole(r.Context(), roleID, req.Name, req.Permissions); err != nil {
		log.Printf("API: failed to update role %s: %v", roleID, err)
		jsonError(w, "failed to update role", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": roleID, "status": "updated"})
}

func (s *Server) handleDeleteRole(w http.ResponseWriter, r *http.Request) {
	roleID := r.PathValue("roleID")
	if roleID == "" {
		jsonError(w, "missing roleID", http.StatusBadRequest)
		return
	}

	if err := s.db.DeleteRole(r.Context(), roleID); err != nil {
		log.Printf("API: failed to delete role %s: %v", roleID, err)
		jsonError(w, "failed to delete role", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": roleID, "status": "deleted"})
}
