package api

import (
	"encoding/json"
	"log"
	"net/http"
)

func (s *Server) handleGetNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	pool := s.db.Pool()
	var prefsJSON []byte
	err := pool.QueryRowContext(r.Context(),
		`SELECT preferences FROM notification_preferences WHERE user_id = $1::UUID`, user.UserID).Scan(&prefsJSON)
	if err != nil {
		// Return empty prefs if not found
		jsonOK(w, map[string]interface{}{})
		return
	}

	var prefs map[string]interface{}
	json.Unmarshal(prefsJSON, &prefs)
	jsonOK(w, prefs)
}

func (s *Server) handleUpdateNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var prefs map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	prefsJSON, _ := json.Marshal(prefs)
	pool := s.db.Pool()
	_, err := pool.ExecContext(r.Context(),
		`INSERT INTO notification_preferences (user_id, preferences)
		 VALUES ($1::UUID, $2)
		 ON CONFLICT (user_id) DO UPDATE SET preferences = $2, updated_at = NOW()`,
		user.UserID, prefsJSON)
	if err != nil {
		log.Printf("API: update notification prefs: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonOK(w, prefs)
}
