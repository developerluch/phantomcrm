package api

import (
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"phantomcrm-api/internal/db"
)

func (s *Server) handleAgentSidebar(w http.ResponseWriter, r *http.Request) {
	discordIDStr := r.PathValue("discordID")
	discordID, err := strconv.ParseInt(discordIDStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid discordID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	now := time.Now()
	sevenDaysAgo := now.AddDate(0, 0, -7)

	var (
		agent          *db.Agent
		profile        *db.AgentProfile
		wavvGoal       *db.WavvGoal
		dailySummaries []db.WavvDailySummary
		rank           int
		recruits       []db.Agent
		activity       []db.SidebarActivityEntry
		errs           [7]error
	)

	var wg sync.WaitGroup
	wg.Add(7)

	go func() {
		defer wg.Done()
		agent, errs[0] = s.db.GetAgent(ctx, discordID)
	}()

	go func() {
		defer wg.Done()
		profile, errs[1] = s.db.GetOrCreateProfile(ctx, discordIDStr)
	}()

	go func() {
		defer wg.Done()
		wavvGoal, errs[2] = s.db.GetWavvGoal(ctx, discordID, "weekly")
	}()

	go func() {
		defer wg.Done()
		dailySummaries, errs[3] = s.db.GetWavvDailySummary(ctx, discordID, sevenDaysAgo, now)
	}()

	go func() {
		defer wg.Done()
		rank, errs[4] = s.db.GetAgentLeaderboardRank(ctx, discordID)
	}()

	go func() {
		defer wg.Done()
		recruits, errs[5] = s.db.GetRecruits(ctx, discordID)
	}()

	go func() {
		defer wg.Done()
		activity, errs[6] = s.db.GetSidebarActivity(ctx, discordID, 10)
	}()

	wg.Wait()

	// Log errors but don't fail the whole request
	for i, e := range errs {
		if e != nil {
			log.Printf("API: sidebar query %d failed for %s: %v", i, discordIDStr, e)
		}
	}

	if agent == nil && errs[0] != nil {
		jsonError(w, "failed to load agent", http.StatusInternalServerError)
		return
	}
	if agent == nil {
		jsonError(w, "agent not found", http.StatusNotFound)
		return
	}

	// Build wavv goal value
	wavvGoalDials := 0
	if wavvGoal != nil {
		wavvGoalDials = wavvGoal.Dials
	}

	dailySummaryCount := len(dailySummaries)

	if recruits == nil {
		recruits = []db.Agent{}
	}
	if activity == nil {
		activity = []db.SidebarActivityEntry{}
	}

	resp := db.SidebarData{
		AgentData:       agent,
		Profile:         profile,
		WavvGoal:        wavvGoalDials,
		DailySummaries:  dailySummaryCount,
		LeaderboardRank: rank,
		Recruits:        recruits,
		RecentActivity:  activity,
	}

	jsonOK(w, resp)
}
