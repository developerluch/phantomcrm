package channels

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// SMSTransport is the minimal subset of the Twilio SMS client that
// TwilioSMSSender requires. Used for testability — the production
// implementation is *sms.Client (in internal/sms).
type SMSTransport interface {
	Send(to, body string) (sid string, err error)
}

// TwilioSMSSender adapts a Twilio SMS transport to the ChannelSender
// interface for (sms, twilio).
type TwilioSMSSender struct {
	tx SMSTransport
}

// NewTwilioSMSSender returns a sender wrapping tx. tx may be nil — in that
// case Send returns ErrUnsupported, which lets servers boot without
// Twilio creds.
func NewTwilioSMSSender(tx SMSTransport) *TwilioSMSSender {
	return &TwilioSMSSender{tx: tx}
}

func (s *TwilioSMSSender) Name() Channel    { return ChannelSMS }
func (s *TwilioSMSSender) Provider() string { return "twilio" }

func (s *TwilioSMSSender) CanSend(_ context.Context, r Recipient) error {
	if s == nil || s.tx == nil {
		return fmt.Errorf("%w: twilio sms transport not configured", ErrUnsupported)
	}
	if r.Flags.DoNotSms {
		return ErrOptedOut
	}
	if strings.TrimSpace(r.PhoneE164) == "" {
		return ErrInvalidRecipient
	}
	return nil
}

func (s *TwilioSMSSender) Send(ctx context.Context, req SendRequest) (SendReceipt, error) {
	if err := s.CanSend(ctx, req.Recipient); err != nil {
		return SendReceipt{}, err
	}
	if strings.TrimSpace(req.Body) == "" {
		return SendReceipt{}, fmt.Errorf("%w: empty body", ErrInvalidRecipient)
	}

	sid, err := s.tx.Send(req.Recipient.PhoneE164, req.Body)
	if err != nil {
		return SendReceipt{}, mapTwilioError(err)
	}

	return SendReceipt{
		ProviderMessageID: sid,
		Status:            "queued",
		SentAt:            time.Now().UTC(),
	}, nil
}

// mapTwilioError inspects the error string from internal/sms (which formats
// upstream HTTP failures as "...twilio returned <code>") and maps known
// codes onto the channel-level sentinel errors. Unknown errors pass through
// as ErrTransient.
func mapTwilioError(err error) error {
	if err == nil {
		return nil
	}
	s := err.Error()
	switch {
	case strings.Contains(s, "429"):
		return fmt.Errorf("%w: %v", ErrRateLimit, err)
	case strings.Contains(s, "503"), strings.Contains(s, "504"):
		return fmt.Errorf("%w: %v", ErrProviderDown, err)
	case strings.Contains(s, "500"), strings.Contains(s, "502"):
		return fmt.Errorf("%w: %v", ErrTransient, err)
	case strings.Contains(s, "400"), strings.Contains(s, "401"),
		strings.Contains(s, "403"), strings.Contains(s, "404"):
		return fmt.Errorf("%w: %v", ErrPermanent, err)
	default:
		return fmt.Errorf("%w: %v", ErrTransient, err)
	}
}
