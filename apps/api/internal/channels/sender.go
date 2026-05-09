// Package channels defines the polymorphic ChannelSender contract that every
// outbound messaging integration (SMS, WhatsApp, email, voice) implements.
//
// M2A replaces the M1 stub with this richer shape: senders are addressed by
// (Channel, Provider) so multiple providers can coexist on a channel
// (e.g. Twilio WhatsApp vs. Meta WhatsApp Business), and CanSend lets
// orchestrators check eligibility (DNC, WA 24h window, missing template)
// before paying provider cost.
package channels

import (
	"context"
	"errors"
	"time"
)

// ── Channel identity ───────────────────────────────────────────────────────

// Channel identifies the wire protocol.
type Channel string

const (
	ChannelSMS      Channel = "sms"
	ChannelWhatsApp Channel = "whatsapp"
	ChannelEmail    Channel = "email"
	ChannelVoice    Channel = "voice"
)

// ── Sentinel errors ────────────────────────────────────────────────────────

// ErrOptedOut is returned when the recipient has DNC set for the relevant
// channel (do_not_sms / do_not_email / do_not_call on contacts).
var ErrOptedOut = errors.New("channels: recipient opted out")

// ErrRateLimit is returned when the upstream provider has throttled sending.
// Outreach should back off + retry.
var ErrRateLimit = errors.New("channels: rate limited")

// ErrInvalidRecipient is returned when the destination (phone, email) is
// malformed or unreachable.
var ErrInvalidRecipient = errors.New("channels: invalid recipient")

// ErrTemplateRequired is returned when the channel forbids freeform sends
// (e.g. WhatsApp outside the 24h customer-care window) and no TemplateID
// was supplied on the SendRequest.
var ErrTemplateRequired = errors.New("channels: pre-approved template required")

// ErrUnsupported is returned when no sender is registered for the requested
// (channel, provider) tuple, or the provider is intentionally a stub
// (Meta WhatsApp pre-verification, Voice pre-M2C).
var ErrUnsupported = errors.New("channels: provider unsupported")

// ErrProviderDown is returned when the upstream provider's API is
// reachable but reports an outage.
var ErrProviderDown = errors.New("channels: provider down")

// ErrPermanent is returned for permanent provider rejections (invalid
// number, blocked recipient). Callers should NOT retry.
var ErrPermanent = errors.New("channels: permanent provider error")

// ErrTransient is returned for transient provider errors (5xx, timeout).
// Callers SHOULD retry with backoff.
var ErrTransient = errors.New("channels: transient provider error")

// ── Recipient + flags ──────────────────────────────────────────────────────

// RecipientFlags carries the opt-out state and any channel-specific
// time-windowed permissions resolved by the orchestrator before send.
type RecipientFlags struct {
	DoNotSms                bool
	DoNotEmail              bool
	DoNotCall               bool
	WhatsAppWindowExpiresAt *time.Time // nil = no open window
}

// Recipient is the resolved destination for a send. Orchestrators populate
// the relevant address field (PhoneE164 for sms/whatsapp/voice, Email for
// email) plus Flags from the Contact and Conversation rows.
type Recipient struct {
	ContactID    string
	PhoneE164    string
	Email        string
	PreferLocale string
	Flags        RecipientFlags
}

// ── Send request / receipt ─────────────────────────────────────────────────

// SendRequest is the neutral outbound payload; channel-specific senders map
// it onto their provider's request shape.
type SendRequest struct {
	Recipient         Recipient
	Body              string
	MediaURLs         []string
	Subject           string // email only
	TemplateID        string
	TemplateVariables map[string]any
	IdempotencyKey    string
	Metadata          map[string]string
}

// SendReceipt captures the provider's acknowledgement.
type SendReceipt struct {
	ProviderMessageID string
	Status            string // queued | sent | delivered | read | failed (provider-defined)
	CostCents         int
	SentAt            time.Time
	Raw               map[string]any
}

// ── Interface ──────────────────────────────────────────────────────────────

// ChannelSender is implemented by each channel/provider concrete sender.
//
// Orchestrators MUST call CanSend before Send for a fast-fail eligibility
// check (DNC, WA window, missing required template). Send must still be
// resilient to a stale CanSend result.
type ChannelSender interface {
	// Name returns which Channel this sender handles.
	Name() Channel

	// Provider returns the upstream provider identifier (e.g. "twilio",
	// "meta"). Combined with Name() it forms the registry key.
	Provider() string

	// CanSend returns nil if the sender can deliver to r right now.
	// Returns ErrOptedOut / ErrInvalidRecipient / ErrTemplateRequired
	// / ErrUnsupported as appropriate. CanSend MUST be cheap (no IO).
	CanSend(ctx context.Context, r Recipient) error

	// Send delivers one SendRequest. Returns the same sentinel errors
	// that CanSend can return, plus ErrRateLimit / ErrProviderDown /
	// ErrTransient / ErrPermanent for upstream conditions.
	Send(ctx context.Context, req SendRequest) (SendReceipt, error)
}
