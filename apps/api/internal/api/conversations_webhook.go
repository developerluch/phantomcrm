package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/channels"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
	"github.com/developerluch/phantomcrm/apps/api/internal/events"
	"github.com/developerluch/phantomcrm/apps/api/internal/repo"
)

// inboundMessage carries everything the unified write needs from a Twilio
// (or future Meta/Voice) inbound webhook. Phone is the raw caller-id (we
// re-normalize); ProfileName is the WA display name (empty for SMS).
type inboundMessage struct {
	Phone       string
	ProfileName string
	Body        string
	ExternalID  string
	Channel     channels.Channel
	Provider    string
	SourceType  string // "inbound_sms" | "inbound_whatsapp"
}

// inboundResult is what upsertInboundMessage returns. Callers broadcast the
// WebSocket event using these values so all routes emit identical payloads.
type inboundResult struct {
	ContactID    string
	Conversation repo.Conversation
	Message      repo.Message
}

// upsertInboundMessage is the unified write path for every inbound message
// across SMS / WhatsApp / etc:
//
//  1. UpsertContactFromSource resolves or creates a Contact (matches by
//     phone_normalized → email → source_type+source_id; new contacts land
//     as lifecycle='lead' with the supplied SourceType).
//  2. FindOpenByContactChannelProvider looks for an open thread; creates
//     one if none exists.
//  3. Inserts the message (direction='inbound', from_addr=phone,
//     external_message_id=Twilio SID).
//  4. BumpUnread increments unread_count and updates last_inbound_at.
//  5. For WhatsApp inbound, extends the 24h customer-care window.
//  6. Persists a 'message.received' event to the events table.
//
// The WebSocket broadcast is intentionally left to the caller — the
// per-channel webhook may want to enrich the payload (e.g. attach the
// matched recruit_id for legacy consumers) before fanning out.
func (s *Server) upsertInboundMessage(ctx context.Context, in inboundMessage) (inboundResult, error) {
	if strings.TrimSpace(in.Phone) == "" {
		return inboundResult{}, fmt.Errorf("upsert inbound: empty phone")
	}
	if strings.TrimSpace(string(in.Channel)) == "" {
		return inboundResult{}, fmt.Errorf("upsert inbound: empty channel")
	}

	// 1. Resolve or create the contact. ProfileName is best-effort — for
	// WA, Twilio sends the user's display name (e.g. "Jane Doe"); we put
	// it into FirstName so buildFullName produces the same value. SMS
	// inbound has no profile name; the contact is created phone-only.
	src := db.SourceRow{
		Kind:           in.SourceType,
		FirstName:      in.ProfileName,
		Phone:          in.Phone,
		LifecycleStage: "lead",
	}
	contactID, err := s.db.UpsertContactFromSource(ctx, src)
	if err != nil {
		return inboundResult{}, fmt.Errorf("upsert inbound: contact: %w", err)
	}

	// 2. Find or create the open conversation.
	conv, err := s.conversationRepo.FindOpenByContactChannelProvider(
		ctx, contactID, string(in.Channel), in.Provider)
	if errors.Is(err, repo.ErrNotFound) {
		conv, err = s.conversationRepo.Create(ctx, repo.Conversation{
			ContactID: contactID,
			Channel:   string(in.Channel),
			Provider:  in.Provider,
			Status:    "open",
		})
		if err != nil {
			return inboundResult{}, fmt.Errorf("upsert inbound: create conversation: %w", err)
		}
	} else if err != nil {
		return inboundResult{}, fmt.Errorf("upsert inbound: find conversation: %w", err)
	}

	// 3. Append the inbound message.
	now := time.Now().UTC()
	fromAddr := in.Phone
	msg, err := s.messageRepo.Insert(ctx, repo.Message{
		ConversationID:    conv.ID,
		ContactID:         contactID,
		Direction:         "inbound",
		Channel:           string(in.Channel),
		Provider:          in.Provider,
		ExternalMessageID: nullStringValue(in.ExternalID),
		FromAddr:          &fromAddr,
		Body:              in.Body,
		Status:            "delivered",
		CreatedAt:         now,
	})
	if err != nil {
		return inboundResult{}, fmt.Errorf("upsert inbound: insert message: %w", err)
	}

	// 4. Bump unread + last_inbound_at.
	if err := s.conversationRepo.BumpUnread(ctx, conv.ID, 1, now); err != nil {
		return inboundResult{}, fmt.Errorf("upsert inbound: bump unread: %w", err)
	}

	// 5. Extend WhatsApp 24h window on every WA inbound.
	if in.Channel == channels.ChannelWhatsApp {
		expires := now.Add(24 * time.Hour)
		if err := s.conversationRepo.ExtendWhatsAppWindow(ctx, conv.ID, expires); err != nil {
			return inboundResult{}, fmt.Errorf("upsert inbound: extend wa window: %w", err)
		}
		conv.WhatsAppWindowExpiresAt = &expires
	}

	// 6. Persist event for the audit timeline.
	if s.eventPublisher != nil {
		_ = s.eventPublisher.Publish(ctx, events.Event{
			Type:        "message.received",
			ContactID:   ptrTo(contactID),
			SubjectType: "message",
			SubjectID:   msg.ID,
			Payload: map[string]any{
				"conversationId": conv.ID,
				"channel":        string(in.Channel),
				"provider":       in.Provider,
				"externalId":     in.ExternalID,
				"profileName":    in.ProfileName,
			},
		})
	}

	conv.LastInboundAt = &now
	conv.UnreadCount++
	return inboundResult{ContactID: contactID, Conversation: conv, Message: msg}, nil
}

// broadcastInbound publishes a "crm:message_received" WebSocket event so the
// inbox UI can refresh in near-real-time. Extra is merged into the payload
// (e.g. legacy recruit_id from the WA opt-out path).
func (s *Server) broadcastInbound(res inboundResult, extra map[string]any) {
	if s.hub == nil {
		return
	}
	payload := map[string]any{
		"conversationId": res.Conversation.ID,
		"messageId":      res.Message.ID,
		"contactId":      res.ContactID,
		"channel":        res.Conversation.Channel,
		"provider":       res.Conversation.Provider,
		"unreadCount":    res.Conversation.UnreadCount,
	}
	for k, v := range extra {
		payload[k] = v
	}
	s.hub.Publish(websocket.NewEvent("crm:message_received", payload))
}
