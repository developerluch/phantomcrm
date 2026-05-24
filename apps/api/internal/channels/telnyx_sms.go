package channels

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// TelnyxSMSSender adapts a Telnyx SMS transport to the ChannelSender
// interface for (sms, telnyx). Reuses the SMSTransport interface declared
// in twilio_sms.go (same package); *sms.TelnyxClient.Send has the same
// (to, body) (sid, err) shape as *sms.Client.Send.
type TelnyxSMSSender struct {
	tx SMSTransport
}

// NewTelnyxSMSSender returns a sender wrapping tx. tx may be nil — in that
// case Send returns ErrUnsupported, which lets servers boot without
// Telnyx creds.
func NewTelnyxSMSSender(tx SMSTransport) *TelnyxSMSSender {
	return &TelnyxSMSSender{tx: tx}
}

func (s *TelnyxSMSSender) Name() Channel    { return ChannelSMS }
func (s *TelnyxSMSSender) Provider() string { return "telnyx" }

func (s *TelnyxSMSSender) CanSend(_ context.Context, r Recipient) error {
	if s == nil || s.tx == nil {
		return fmt.Errorf("%w: telnyx sms transport not configured", ErrUnsupported)
	}
	if r.Flags.DoNotSms {
		return ErrOptedOut
	}
	if strings.TrimSpace(r.PhoneE164) == "" {
		return ErrInvalidRecipient
	}
	return nil
}

func (s *TelnyxSMSSender) Send(ctx context.Context, req SendRequest) (SendReceipt, error) {
	if err := s.CanSend(ctx, req.Recipient); err != nil {
		return SendReceipt{}, err
	}
	if strings.TrimSpace(req.Body) == "" {
		return SendReceipt{}, fmt.Errorf("%w: empty body", ErrInvalidRecipient)
	}

	sid, err := s.tx.Send(req.Recipient.PhoneE164, req.Body)
	if err != nil {
		return SendReceipt{}, mapTelnyxError(err)
	}

	return SendReceipt{
		ProviderMessageID: sid,
		Status:            "queued",
		SentAt:            time.Now().UTC(),
	}, nil
}

// mapTelnyxError inspects the error string from internal/sms (which formats
// upstream HTTP failures as "...telnyx returned <code>") and maps known
// codes onto the channel-level sentinel errors. Unknown errors pass through
// as ErrTransient.
func mapTelnyxError(err error) error {
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
