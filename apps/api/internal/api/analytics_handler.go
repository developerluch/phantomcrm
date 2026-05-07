package api

import (
	"encoding/csv"
	"fmt"
	"log"
	"net/http"
	"strconv"
)

var stageNames = map[int]struct{ Name, Slug, Color string }{
	1: {"Welcome", "welcome", "#3b82f6"},
	2: {"Form Completed", "form_completed", "#f59e0b"},
	3: {"Sorted", "sorted", "#8b5cf6"},
	4: {"Student", "student", "#06b6d4"},
	5: {"Verified", "verified", "#10b981"},
	6: {"Contracting", "contracting", "#22c55e"},
	7: {"Setup", "setup", "#a855f7"},
	8: {"Active", "active", "#6366f1"},
	9: {"Kicked", "kicked", "#ef4444"},
}

func (s *Server) handleConversionAnalytics(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Pool().QueryContext(r.Context(),
		`SELECT current_stage, COUNT(*) FROM onboarding_agents GROUP BY current_stage ORDER BY current_stage`)
	if err != nil {
		log.Printf("API: conversion analytics: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var total int
	type stageCount struct {
		Stage int
		Count int
	}
	var counts []stageCount
	for rows.Next() {
		var sc stageCount
		if err := rows.Scan(&sc.Stage, &sc.Count); err != nil {
			log.Printf("API: conversion analytics scan: %v", err)
			continue
		}
		counts = append(counts, sc)
		total += sc.Count
	}

	type result struct {
		Name       string  `json:"name"`
		Slug       string  `json:"slug"`
		Color      string  `json:"color"`
		Count      int     `json:"count"`
		Percentage float64 `json:"percentage"`
	}
	var out []result
	for _, sc := range counts {
		info := stageNames[sc.Stage]
		pct := 0.0
		if total > 0 {
			pct = float64(sc.Count) / float64(total) * 100
		}
		out = append(out, result{Name: info.Name, Slug: info.Slug, Color: info.Color, Count: sc.Count, Percentage: pct})
	}
	if out == nil {
		out = []result{}
	}
	jsonOK(w, out)
}

func (s *Server) handleSourceAnalytics(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Pool().QueryContext(r.Context(),
		`SELECT COALESCE(agency, 'Unknown'), COUNT(*) FROM onboarding_agents GROUP BY agency ORDER BY COUNT(*) DESC LIMIT 20`)
	if err != nil {
		log.Printf("API: source analytics: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type result struct {
		Source string `json:"source"`
		Count  int    `json:"count"`
	}
	var out []result
	for rows.Next() {
		var r result
		if err := rows.Scan(&r.Source, &r.Count); err != nil {
			log.Printf("API: source analytics scan: %v", err)
			continue
		}
		out = append(out, r)
	}
	if out == nil {
		out = []result{}
	}
	jsonOK(w, out)
}

func (s *Server) handleTrendsAnalytics(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Pool().QueryContext(r.Context(),
		`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD'), COUNT(*)
		 FROM onboarding_agents WHERE created_at >= NOW() - INTERVAL '12 weeks'
		 GROUP BY 1 ORDER BY 1`)
	if err != nil {
		log.Printf("API: trends analytics: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type result struct {
		Week  string `json:"week"`
		Count int    `json:"count"`
	}
	var out []result
	for rows.Next() {
		var r result
		if err := rows.Scan(&r.Week, &r.Count); err != nil {
			log.Printf("API: trends analytics scan: %v", err)
			continue
		}
		out = append(out, r)
	}
	if out == nil {
		out = []result{}
	}
	jsonOK(w, out)
}

func (s *Server) handleStageDurationAnalytics(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Pool().QueryContext(r.Context(),
		`SELECT current_stage, COUNT(*),
		        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(last_active, NOW()) - created_at)) / 86400), 0)
		 FROM onboarding_agents GROUP BY current_stage ORDER BY current_stage`)
	if err != nil {
		log.Printf("API: stage duration: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type result struct {
		Name       string  `json:"name"`
		Slug       string  `json:"slug"`
		Color      string  `json:"color"`
		AvgDays    float64 `json:"avgDays"`
		AgentCount int     `json:"agentCount"`
	}
	var out []result
	for rows.Next() {
		var stage, count int
		var avgDays float64
		if err := rows.Scan(&stage, &count, &avgDays); err != nil {
			log.Printf("API: stage duration scan: %v", err)
			continue
		}
		info := stageNames[stage]
		out = append(out, result{Name: info.Name, Slug: info.Slug, Color: info.Color, AvgDays: avgDays, AgentCount: count})
	}
	if out == nil {
		out = []result{}
	}
	jsonOK(w, out)
}

func (s *Server) handleExportCsv(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Pool().QueryContext(r.Context(),
		`SELECT discord_id, COALESCE(first_name,''), COALESCE(last_name,''), COALESCE(agency,''),
		        current_stage, COALESCE(state,''), created_at::TEXT
		 FROM onboarding_agents ORDER BY created_at DESC`)
	if err != nil {
		log.Printf("API: export csv: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=agents_export.csv")

	writer := csv.NewWriter(w)
	writer.Write([]string{"Discord ID", "First Name", "Last Name", "Agency", "Stage", "State", "Created At"})

	for rows.Next() {
		var discordID int64
		var first, last, agency, state, created string
		var stage int
		if err := rows.Scan(&discordID, &first, &last, &agency, &stage, &state, &created); err != nil {
			log.Printf("API: export csv scan: %v", err)
			continue
		}
		writer.Write([]string{
			fmt.Sprintf("%d", discordID), first, last, agency, strconv.Itoa(stage), state, created,
		})
	}
	writer.Flush()
}
