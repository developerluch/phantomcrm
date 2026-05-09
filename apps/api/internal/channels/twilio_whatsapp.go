package channels

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// WhatsAppTransport is the minimal subset of the Twilio client used by
// TwilioWhatsAppSender.
type WhatsAppTransport interface {
	SendWhatsApp(to, body string) (sid string, err error)
}

// TwilioWhatsAppSender adapts a Twilio WhatsApp transport to ChannelSender
// for (whatsapp, twilio). It enforces the WhatsApp 24-hour customer-care
// window: outside the window, Send REQUIRES a TemplateID.
type TwilioWhatsAppSender struct {
	tx  WhatsAppTransport
	now func() time.Time // injected for tests
}

func NewTwilioWhatsAppSender(tx WhatsAppTransport) *TwilioWhatsAppSender {
	return &TwilioWhatsAppSender{tx: tx, now: time.Now}
}

func (s *TwilioWhatsAppSender) Name() Channel    { return ChannelWhatsApp }
func (s *TwilioWhatsAppSender) Provider() string { return "twilio" }

// withClock is a test-only override for the sender's clock.
func (s *TwilioWhatsAppSender) withClock(now func() time.Time) *TwilioWhatsAppSender {
	s.now = now
	return s
}

func (s *TwilioWhatsAppSender) CanSend(_ context.Context, r Recipient) error {
	if s == nil || s.tx == nil {
		return fmt.Errorf("%w: twilio whatsapp transport not configured", ErrUnsupported)
	}
	// Reuse SMS DNC as the WhatsApp opt-out flag until a dedicated
	// do_not_whatsapp column lands.
	if r.Flags.DoNotSms {
		return ErrOptedOut
	}
	if strings.TrimSpace(r.PhoneE164) == "" {
		return ErrInvalidRecipient
	}
	return nil
}

func (s *TwilioWhatsAppSender) Send(ctx context.Context, req SendRequest) (SendReceipt, error) {
	if err := s.CanSend(ctx, req.Recipient); err != nil {
		return SendReceipt{}, err
	}

	// 24h customer-care window: outside the window, only pre-approved
	// templates may be sent.
	windowOpen := req.Recipient.Flags.WhatsAppWindowExpiresAt != nil &&
		req.Recipient.Flags.WhatsAppWindowExpiresAt.After(s.clock())
	if !windowOpen && strings.TrimSpace(req.TemplateID) == "" {
		return SendReceipt{}, ErrTemplateRequired
	}

	body := req.Body
	if strings.TrimSpace(body) == "" {
		// For template sends without a freeform body, surface a
		// human-readable placeholder; real template rendering happens
		// upstream when the provider exposes it.
		body = req.TemplateID
	}

	sid, err := s.tx.SendWhatsApp(req.Recipient.PhoneE164, body)
	if err != nil {
		return SendReceipt{}, mapTwilioError(err)
	}

	return SendReceipt{
		ProviderMessageID: sid,
		Status:            "queued",
		SentAt:            s.clock().UTC(),
	}, nil
}

func (s *TwilioWhatsAppSender) clock() time.Time {
	if s.now == nil {
		return time.Now()
	}
	return s.now()
}
