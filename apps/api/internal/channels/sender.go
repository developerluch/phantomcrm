// Package channels defines the ChannelSender contract that every outbound
// messaging integration (SMS, WhatsApp, email) implements. This file is a
// LOCKED INTERFACE STUB shipped by M1 so that M2 (outreach) can implement
// against a stable shape without a coordination PR.
//
// NO concrete senders live in M1. Adding senders is M2's job.
package channels

import (
	"context"
	"errors"
)

// ErrOptedOut is returned when the recipient has DNC set for the relevant
// channel (do_not_sms / do_not_email / do_not_call on contacts).
var ErrOptedOut = errors.New("channels: recipient opted out")

// ErrRateLimit is returned when the upstream provider has throttled sending.
// Outreach should back off + retry.
var ErrRateLimit = errors.New("channels: rate limited")

// ErrInvalidRecipient is returned when the destination (phone, email) is
// malformed or unreachable.
var ErrInvalidRecipient = errors.New("channels: invalid recipient")

// Channel identifies the wire protocol.
type Channel string

const (
	ChannelSMS      Channel = "sms"
	ChannelWhatsApp Channel = "whatsapp"
	ChannelEmail    Channel = "email"
)

// Message is the neutral outbound payload; channel-specific senders map it
// onto their provider's request shape.
type Message struct {
	ContactID   string
	ToAddress   string // phone (E.164) or email
	Subject     string // email only
	Body        string
	TemplateID  string
	TemplateVars map[string]string
	Metadata    map[string]string
}

// SendResult captures the provider's acknowledgement.
type SendResult struct {
	ProviderMessageID string
	Channel           Channel
}

// ChannelSender is implemented by each channel's concrete sender in M2.
type ChannelSender interface {
	// Channel returns which Channel this sender handles.
	Channel() Channel

	// Send delivers one Message. Returns ErrOptedOut / ErrRateLimit /
	// ErrInvalidRecipient for the respective conditions.
	Send(ctx context.Context, msg Message) (SendResult, error)
}
