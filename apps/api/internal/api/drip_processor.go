package api

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// startDripProcessor runs the drip campaign processor in the background.
// It checks for due executions every 60 seconds and sends the next message.
func (s *Server) startDripProcessor(ctx context.Context) {
	log.Println("Drip campaign processor started")
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("Drip campaign processor stopping")
			return
		case <-ticker.C:
			s.processDueExecutions(ctx)
		}
	}
}

// processDueExecutions finds and processes all drip executions that are due.
func (s *Server) processDueExecutions(ctx context.Context) {
	executions, err := s.db.ListDueExecutions(ctx, time.Now())
	if err != nil {
		log.Printf("drip: list due executions: %v", err)
		return
	}
	if len(executions) == 0 {
		return
	}

	log.Printf("drip: processing %d due executions", len(executions))

	for _, exec := range executions {
		s.processOneExecution(ctx, exec)
		// Small delay between sends to avoid Twilio rate limits
		time.Sleep(100 * time.Millisecond)
	}
}

// processOneExecution processes a single drip execution step.
func (s *Server) processOneExecution(ctx context.Context, exec db.DripExecution) {
	// Load campaign steps
	steps, err := s.db.ListDripSteps(ctx, exec.CampaignID)
	if err != nil {
		log.Printf("drip: load steps for campaign %s: %v", exec.CampaignID, err)
		return
	}

	// Find the current step to send (exec.CurrentStep is the last sent step, so next is CurrentStep+1)
	nextStepOrder := exec.CurrentStep + 1
	var currentStep *db.DripStep
	for i := range steps {
		if steps[i].StepOrder == nextStepOrder {
			currentStep = &steps[i]
			break
		}
	}
	if currentStep == nil {
		// No more steps — campaign complete
		if err := s.db.CompleteExecution(ctx, exec.ID); err != nil {
			log.Printf("drip: complete execution %s: %v", exec.ID, err)
		}
		return
	}

	// Load recruit
	recruit, err := s.db.GetRecruit(ctx, exec.RecruitID)
	if err != nil || recruit == nil {
		log.Printf("drip: recruit %s not found, cancelling execution", exec.RecruitID)
		_ = s.db.CancelExecutionsByRecruitID(ctx, exec.RecruitID, "cancelled")
		return
	}

	// Check opt-out
	if recruit.OptedOut {
		log.Printf("drip: recruit %s opted out, cancelling execution", exec.RecruitID)
		_ = s.db.CancelExecutionsByRecruitID(ctx, exec.RecruitID, "opted_out")
		return
	}

	// Check phone
	if recruit.Phone == nil || *recruit.Phone == "" {
		log.Printf("drip: recruit %s has no phone, cancelling execution", exec.RecruitID)
		_ = s.db.CancelExecutionsByRecruitID(ctx, exec.RecruitID, "cancelled")
		return
	}

	// Interpolate template
	body := interpolateTemplate(currentStep.MessageTemplate, recruit)
	// Replace {{bookingLink}} with Cal.com URL
	if s.cfg.CalComURL != "" {
		body = strings.Replace(body, "{{bookingLink}}", s.cfg.CalComURL, -1)
	}

	// Load campaign to check channel
	campaign, err := s.db.GetDripCampaign(ctx, exec.CampaignID)
	if err != nil || campaign == nil {
		log.Printf("drip: campaign %s not found", exec.CampaignID)
		return
	}

	// Send message
	switch campaign.Channel {
	case "whatsapp":
		s.sendAutoWhatsApp(ctx, recruit, body)
	case "sms":
		s.sendAutoSms(ctx, recruit, body)
	default:
		// Send both
		s.sendAutoWhatsApp(ctx, recruit, body)
		s.sendAutoSms(ctx, recruit, body)
	}

	// Calculate next step
	var nextSendAt *time.Time
	for i := range steps {
		if steps[i].StepOrder == nextStepOrder+1 {
			t := time.Now().Add(time.Duration(steps[i].DelayMinutes) * time.Minute)
			nextSendAt = &t
			break
		}
	}

	if nextSendAt != nil {
		// More steps — advance
		if err := s.db.AdvanceExecution(ctx, exec.ID, nextStepOrder, nextSendAt); err != nil {
			log.Printf("drip: advance execution %s: %v", exec.ID, err)
		}
	} else {
		// Last step — complete
		if err := s.db.CompleteExecution(ctx, exec.ID); err != nil {
			log.Printf("drip: complete execution %s: %v", exec.ID, err)
		}
	}

	log.Printf("drip: sent step %d of campaign %s to recruit %s (%s)",
		nextStepOrder, campaign.Name, recruit.ID, *recruit.Phone)
}

// sendAutoWhatsApp sends a WhatsApp message via Twilio and records it in the database.
func (s *Server) sendAutoWhatsApp(ctx context.Context, recruit *db.Recruit, body string) {
	if s.smsClient == nil {
		log.Println("hooks: SMS client not configured, skipping auto-WhatsApp")
		return
	}
	if recruit.Phone == nil || *recruit.Phone == "" {
		return
	}

	sid, err := s.smsClient.SendWhatsApp(*recruit.Phone, body)
	if err != nil {
		log.Printf("hooks: auto-WhatsApp to %s failed: %v", *recruit.Phone, err)
		return
	}

	// Record in WhatsApp conversation
	conv, err := s.db.FindOrCreateConversationByPhone(ctx, *recruit.Phone, recruit.FirstName+" "+recruit.LastName)
	if err != nil {
		log.Printf("hooks: find/create conversation for WhatsApp: %v", err)
		return
	}

	msgID, err := s.db.CreateMessage(ctx, db.WhatsAppMessage{
		ConversationID: conv.ID,
		Sender:         "system",
		Body:           body,
		IsFromContact:  false,
	})
	if err != nil {
		log.Printf("hooks: save auto-WhatsApp message: %v", err)
		return
	}

	_ = s.db.UpdateConversationLastMessage(ctx, conv.ID, false)

	// Link conversation to recruit if not already linked
	if conv.RecruitID == nil {
		_ = s.db.LinkConversationToRecruit(ctx, conv.ID, recruit.ID)
	}

	_ = sid // SID logged by Twilio client
	s.hub.Publish(websocket.NewEvent("recruit:whatsapp_sent", map[string]interface{}{
		"recruitId":      recruit.ID,
		"conversationId": conv.ID,
		"messageId":      msgID,
	}))
}

// startDripCampaignsForStage starts drip campaigns triggered by a recruit stage change.
func (s *Server) startDripCampaignsForStage(ctx context.Context, recruit *db.Recruit, stage string) {
	if recruit == nil {
		return
	}
	if recruit.OptedOut {
		return
	}

	campaigns, err := s.db.ListActiveCampaignsByStage(ctx, stage)
	if err != nil {
		log.Printf("drip: list campaigns for stage %s: %v", stage, err)
		return
	}

	for _, campaign := range campaigns {
		// Get first step to determine initial delay
		steps, err := s.db.ListDripSteps(ctx, campaign.ID)
		if err != nil || len(steps) == 0 {
			continue
		}

		firstDelay := steps[0].DelayMinutes
		id, err := s.db.StartExecution(ctx, campaign.ID, recruit.ID, firstDelay)
		if err != nil {
			log.Printf("drip: start execution for campaign %s recruit %s: %v", campaign.ID, recruit.ID, err)
			continue
		}
		if id != "" {
			log.Printf("drip: started campaign %q for recruit %s %s (execution: %s)", campaign.Name, recruit.FirstName, recruit.LastName, id)
		}
	}
}
