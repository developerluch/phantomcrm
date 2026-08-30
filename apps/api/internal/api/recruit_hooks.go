package api

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// onRecruitStageChange fires automation when a recruit moves to a new stage.
// Must be called in a goroutine with context.Background() (request ctx dies after response).
func (s *Server) onRecruitStageChange(ctx context.Context, recruit *db.Recruit, oldStage, newStage string) {
	if recruit == nil {
		return
	}

	cfg, err := s.db.GetStageConfig(ctx, newStage)
	if err != nil {
		log.Printf("hooks: get stage config for %s: %v", newStage, err)
		return
	}
	if cfg == nil {
		return
	}

	// Auto-SMS if template exists and recruit has a phone number
	if cfg.SmsTemplate != "" && recruit.Phone != nil && *recruit.Phone != "" {
		body := interpolateTemplate(cfg.SmsTemplate, recruit)
		s.sendAutoSms(ctx, recruit, body)
	}

	// Auto-assign manager
	if cfg.AutoAssign && cfg.ManagerDiscordID != "" {
		_ = s.db.UpdateRecruit(ctx, recruit.ID, map[string]interface{}{
			"assignedManagerId": cfg.ManagerDiscordID,
		})
	}

	// Discord DM notification to manager
	if cfg.NotifyDiscord && cfg.ManagerDiscordID != "" {
		s.notifyManagerDiscord(ctx, recruit, cfg.ManagerDiscordID, newStage)
	}

	// Broadcast WebSocket event
	s.hub.Publish(websocket.NewEvent("recruit:stage_changed", map[string]interface{}{
		"recruitId": recruit.ID,
		"oldStage":  oldStage,
		"newStage":  newStage,
	}))

	// Start any drip campaigns configured for this stage
	go s.startDripCampaignsForStage(context.Background(), recruit, newStage)

	// Bridge recruit to agent when onboarded
	if newStage == "ONBOARDED" {
		s.tryBridgeRecruitToAgent(ctx, recruit)
	}
}

// sendAutoSms sends an SMS via Twilio and records it in the database.
func (s *Server) sendAutoSms(ctx context.Context, recruit *db.Recruit, body string) {
	if s.smsClient == nil {
		log.Println("hooks: SMS client not configured, skipping auto-SMS")
		return
	}
	if recruit.Phone == nil || *recruit.Phone == "" {
		return
	}

	sid, err := s.smsClient.Send(*recruit.Phone, body)
	if err != nil {
		log.Printf("hooks: auto-SMS to %s failed: %v", *recruit.Phone, err)
		return
	}

	from := s.smsClient.FromNumber()
	status := "sent"
	msg := &db.SmsMessage{
		RecruitID:  &recruit.ID,
		ToNumber:   *recruit.Phone,
		FromNumber: &from,
		Body:       body,
		Direction:  "outbound",
		Status:     &status,
		ProviderID: &sid,
	}
	id, err := s.db.CreateSmsMessage(ctx, msg)
	if err != nil {
		log.Printf("hooks: save auto-SMS record: %v", err)
		return
	}

	s.hub.Publish(websocket.NewEvent("recruit:sms_sent", map[string]interface{}{
		"recruitId": recruit.ID,
		"messageId": id,
	}))
}

// interpolateTemplate replaces {{placeholders}} with recruit data.
func interpolateTemplate(tmpl string, recruit *db.Recruit) string {
	r := strings.NewReplacer(
		"{{firstName}}", recruit.FirstName,
		"{{lastName}}", recruit.LastName,
		"{{email}}", recruit.Email,
		"{{phone}}", ptrStr(recruit.Phone),
		"{{city}}", ptrStr(recruit.City),
	)
	result := r.Replace(tmpl)
	if recruit.InterviewDate != nil {
		result = strings.Replace(result, "{{interviewDate}}", recruit.InterviewDate.Format("January 2, 2006"), 1)
	}
	return result
}

// ptrStr safely dereferences a *string, returning "" if nil.
func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// strPtr returns a pointer to the given string.
func strPtr(s string) *string {
	return &s
}

// notifyManagerDiscord queues a Discord DM to the manager via pending_actions.
func (s *Server) notifyManagerDiscord(ctx context.Context, recruit *db.Recruit, managerDiscordID, stage string) {
	discordID, err := parseDiscordID(managerDiscordID)
	if err != nil {
		log.Printf("hooks: invalid manager Discord ID %q: %v", managerDiscordID, err)
		return
	}

	msg := fmt.Sprintf("**Pipeline Update**\n%s %s moved to **%s**\nPhone: %s\nEmail: %s",
		recruit.FirstName, recruit.LastName, stage,
		ptrStr(recruit.Phone), recruit.Email)

	_, err = s.db.CreatePendingAction(ctx, "send_dm", discordID, map[string]string{
		"message": msg,
	})
	if err != nil {
		log.Printf("hooks: queue Discord DM: %v", err)
	}
}

func parseDiscordID(s string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(s, "%d", &id)
	return id, err
}

func (s *Server) tryBridgeRecruitToAgent(ctx context.Context, recruit *db.Recruit) {
	if recruit == nil {
		return
	}

	var matchedAgent *db.Agent
	if recruit.Email != "" {
		matchedAgent, _ = s.db.FindAgentByEmail(ctx, recruit.Email)
	}
	if matchedAgent == nil && recruit.Phone != nil && *recruit.Phone != "" {
		matchedAgent, _ = s.db.FindAgentByPhone(ctx, *recruit.Phone)
	}
	if matchedAgent == nil {
		return
	}

	agentDiscordStr := fmt.Sprintf("%d", matchedAgent.DiscordID)
	_ = s.db.UpdateRecruit(ctx, recruit.ID, map[string]interface{}{
		"discordId": agentDiscordStr,
	})
	if recruit.AssignedManagerID != nil && *recruit.AssignedManagerID != "" {
		_, _ = s.db.SetManager(ctx, agentDiscordStr, recruit.AssignedManagerID)
	}
	log.Printf("hooks: linked recruit %s to agent %d", recruit.ID, matchedAgent.DiscordID)
}
