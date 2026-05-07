package api

import (
	"log"
	"net/http"
	"strconv"
	"time"
)

func (s *Server) handleActivityLog(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit == 0 {
		limit = 50
	}

	pool := s.db.Pool()
	rows, err := pool.QueryContext(r.Context(),
		`SELECT id, event_type, COALESCE(details, ''), discord_id, created_at
		 FROM agent_activity_log ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		log.Printf("API: activity log: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type entry struct {
		ID          int64  `json:"id"`
		Action      string `json:"action"`
		Description string `json:"description"`
		AgentID     string `json:"agentId"`
		CreatedAt   string `json:"createdAt"`
	}
	var out []entry
	for rows.Next() {
		var e entry
		var discordID int64
		var createdAt time.Time
		if err := rows.Scan(&e.ID, &e.Action, &e.Description, &discordID, &createdAt); err != nil {
			log.Printf("API: activity log scan: %v", err)
			continue
		}
		e.AgentID = strconv.FormatInt(discordID, 10)
		e.CreatedAt = createdAt.Format(time.RFC3339)
		out = append(out, e)
	}
	if out == nil {
		out = []entry{}
	}
	jsonOK(w, out)
}

func (s *Server) handleAnnouncement(w http.ResponseWriter, r *http.Request) {
	// Announcement is a Discord bot action — queue as a pending action
	w.WriteHeader(http.StatusNoContent)
}
