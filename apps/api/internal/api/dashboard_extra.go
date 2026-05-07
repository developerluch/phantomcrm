package api

import (
	"log"
	"net/http"
)

func (s *Server) handleDashboardStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	pool := s.db.Pool()

	var totalAgents, newThisWeek, activeAgents int
	pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM onboarding_agents").Scan(&totalAgents)
	pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM onboarding_agents WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&newThisWeek)
	pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM onboarding_agents WHERE kicked_at IS NULL").Scan(&activeAgents)

	conversionRate := 0.0
	if totalAgents > 0 {
		var licensed int
		pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM onboarding_agents WHERE current_stage >= 5").Scan(&licensed)
		conversionRate = float64(licensed) / float64(totalAgents) * 100
	}

	jsonOK(w, map[string]interface{}{
		"totalAgents":    totalAgents,
		"newThisWeek":    newThisWeek,
		"activeAgents":   activeAgents,
		"conversionRate": conversionRate,
	})
}

func (s *Server) handleRevenueChart(w http.ResponseWriter, r *http.Request) {
	pool := s.db.Pool()
	rows, err := pool.QueryContext(r.Context(),
		`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM'), COALESCE(SUM(premium), 0)
		 FROM sales WHERE created_at >= NOW() - INTERVAL '12 months'
		 GROUP BY 1 ORDER BY 1`)
	if err != nil {
		log.Printf("API: revenue chart: %v", err)
		// Return empty array rather than error since sales table may not have data
		jsonOK(w, []interface{}{})
		return
	}
	defer rows.Close()

	type point struct {
		Month   string  `json:"month"`
		Revenue float64 `json:"revenue"`
	}
	var out []point
	for rows.Next() {
		var p point
		if err := rows.Scan(&p.Month, &p.Revenue); err != nil {
			log.Printf("API: revenue chart scan: %v", err)
			continue
		}
		out = append(out, p)
	}
	if out == nil {
		out = []point{}
	}
	jsonOK(w, out)
}

func (s *Server) handleDashboardLeaderboard(w http.ResponseWriter, r *http.Request) {
	pool := s.db.Pool()
	rows, err := pool.QueryContext(r.Context(),
		`SELECT agent_discord_id,
		        COALESCE(SUM(commission), 0), COALESCE(SUM(premium), 0), COUNT(*)
		 FROM sales GROUP BY agent_discord_id ORDER BY SUM(premium) DESC LIMIT 10`)
	if err != nil {
		log.Printf("API: dashboard leaderboard: %v", err)
		jsonOK(w, []interface{}{})
		return
	}
	defer rows.Close()

	type entry struct {
		AgentID         string  `json:"agentId"`
		Name            string  `json:"name"`
		TotalCommission float64 `json:"totalCommission"`
		TotalPremium    float64 `json:"totalPremium"`
		PolicyCount     int     `json:"policyCount"`
	}
	var out []entry
	for rows.Next() {
		var e entry
		if err := rows.Scan(&e.AgentID, &e.TotalCommission, &e.TotalPremium, &e.PolicyCount); err != nil {
			log.Printf("API: dashboard leaderboard scan: %v", err)
			continue
		}
		e.Name = e.AgentID // Will be resolved by frontend
		out = append(out, e)
	}
	if out == nil {
		out = []entry{}
	}
	jsonOK(w, out)
}

func (s *Server) handlePipelineValue(w http.ResponseWriter, r *http.Request) {
	pool := s.db.Pool()
	rows, err := pool.QueryContext(r.Context(),
		`SELECT current_stage, COUNT(*) FROM onboarding_agents GROUP BY current_stage ORDER BY current_stage`)
	if err != nil {
		log.Printf("API: pipeline value: %v", err)
		jsonOK(w, []interface{}{})
		return
	}
	defer rows.Close()

	type entry struct {
		Stage string `json:"stage"`
		Count int    `json:"count"`
	}
	var out []entry
	for rows.Next() {
		var stage, count int
		if err := rows.Scan(&stage, &count); err != nil {
			log.Printf("API: pipeline value scan: %v", err)
			continue
		}
		info := stageNames[stage]
		out = append(out, entry{Stage: info.Name, Count: count})
	}
	if out == nil {
		out = []entry{}
	}
	jsonOK(w, out)
}
