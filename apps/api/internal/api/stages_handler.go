package api

import "net/http"

func (s *Server) handleStages(w http.ResponseWriter, r *http.Request) {
	type stage struct {
		ID    int    `json:"id"`
		Label string `json:"label"`
		Color string `json:"color"`
	}
	stages := []stage{
		{1, "Welcome", "#3b82f6"},
		{2, "Form Completed", "#f59e0b"},
		{3, "Sorted", "#8b5cf6"},
		{4, "Student", "#06b6d4"},
		{5, "Verified", "#10b981"},
		{6, "Contracting", "#22c55e"},
		{7, "Setup", "#a855f7"},
		{8, "Active", "#6366f1"},
		{9, "Kicked", "#ef4444"},
	}
	jsonOK(w, stages)
}
