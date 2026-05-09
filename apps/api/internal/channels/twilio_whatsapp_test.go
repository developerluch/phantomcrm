package channels

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeWATransport struct {
	calls    int
	sentTo   string
	sentBody string
	sid      string
	err      error
}

func (f *fakeWATransport) SendWhatsApp(to, body string) (string, error) {
	f.calls++
	f.sentTo = to
	f.sentBody = body
	if f.err != nil {
		return "", f.err
	}
	if f.sid == "" {
		return "WA-test-" + to, nil
	}
	return f.sid, nil
}

func waSenderWithClock(tx WhatsAppTransport, now time.Time) *TwilioWhatsAppSender {
	return NewTwilioWhatsAppSender(tx).withClock(func() time.Time { return now })
}

func TestTwilioWhatsApp_FreeformInsideWindow(t *testing.T) {
	now := time.Date(2026, 5, 9, 12, 0, 0, 0, time.UTC)
	openUntil := now.Add(2 * time.Hour) // window still open
	tx := &fakeWATransport{}
	s := waSenderWithClock(tx, now)

	rec := Recipient{
		ContactID: "c1",
		PhoneE164: "+15551234567",
		Flags:     RecipientFlags{WhatsAppWindowExpiresAt: &openUntil},
	}
	if err := s.CanSend(context.Background(), rec); err != nil {
		t.Fatalf("CanSend: %v", err)
	}
	receipt, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "hi"})
	if err != nil {
		t.Fatalf("Send (in-window freeform): %v", err)
	}
	if receipt.ProviderMessageID == "" {
		t.Errorf("expected provider message id, got empty")
	}
	if tx.calls != 1 {
		t.Errorf("expected 1 transport call, got %d", tx.calls)
	}
	if tx.sentBody != "hi" {
		t.Errorf("body = %q, want %q", tx.sentBody, "hi")
	}
}

func TestTwilioWhatsApp_FreeformOutsideWindow_RequiresTemplate(t *testing.T) {
	now := time.Date(2026, 5, 9, 12, 0, 0, 0, time.UTC)
	closedAt := now.Add(-1 * time.Hour) // window already expired
	tx := &fakeWATransport{}
	s := waSenderWithClock(tx, now)

	rec := Recipient{
		ContactID: "c1",
		PhoneE164: "+15551234567",
		Flags:     RecipientFlags{WhatsAppWindowExpiresAt: &closedAt},
	}
	// Freeform send outside window must be rejected.
	_, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "freeform"})
	if !errors.Is(err, ErrTemplateRequired) {
		t.Fatalf("Send (out-of-window, no template): got %v, want ErrTemplateRequired", err)
	}
	if tx.calls != 0 {
		t.Fatalf("transport called %d times — should short-circuit before send", tx.calls)
	}
}

func TestTwilioWhatsApp_OutsideWindowWithTemplate_Sends(t *testing.T) {
	now := time.Date(2026, 5, 9, 12, 0, 0, 0, time.UTC)
	closedAt := now.Add(-1 * time.Hour)
	tx := &fakeWATransport{sid: "WA-template-1"}
	s := waSenderWithClock(tx, now)

	rec := Recipient{
		ContactID: "c1",
		PhoneE164: "+15551234567",
		Flags:     RecipientFlags{WhatsAppWindowExpiresAt: &closedAt},
	}
	receipt, err := s.Send(context.Background(), SendRequest{
		Recipient:  rec,
		TemplateID: "tmpl_appointment_reminder",
	})
	if err != nil {
		t.Fatalf("Send (out-of-window, with template): %v", err)
	}
	if receipt.ProviderMessageID != "WA-template-1" {
		t.Errorf("ProviderMessageID = %q, want WA-template-1", receipt.ProviderMessageID)
	}
	if tx.calls != 1 {
		t.Errorf("transport calls = %d, want 1", tx.calls)
	}
}

func TestTwilioWhatsApp_NilWindow_RequiresTemplate(t *testing.T) {
	tx := &fakeWATransport{}
	s := waSenderWithClock(tx, time.Now())

	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"} // nil window
	_, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "x"})
	if !errors.Is(err, ErrTemplateRequired) {
		t.Fatalf("Send (nil window): got %v, want ErrTemplateRequired", err)
	}
}

func TestTwilioWhatsApp_OptedOut(t *testing.T) {
	tx := &fakeWATransport{}
	s := waSenderWithClock(tx, time.Now())

	rec := Recipient{
		ContactID: "c1",
		PhoneE164: "+15551234567",
		Flags:     RecipientFlags{DoNotSms: true},
	}
	if err := s.CanSend(context.Background(), rec); !errors.Is(err, ErrOptedOut) {
		t.Fatalf("CanSend: got %v, want ErrOptedOut", err)
	}
	if _, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "x"}); !errors.Is(err, ErrOptedOut) {
		t.Fatalf("Send: got %v, want ErrOptedOut", err)
	}
	if tx.calls != 0 {
		t.Fatalf("transport calls = %d, want 0", tx.calls)
	}
}

func TestRegistry_ForUnknownReturnsErrUnsupported(t *testing.T) {
	r := NewRegistry()
	r.Register(NewTwilioSMSSender(&fakeSMSTransport{}))
	if _, err := r.For(ChannelSMS, "unknown"); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("For(sms, unknown): got %v, want ErrUnsupported", err)
	}
	if _, err := r.For(ChannelEmail, "twilio"); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("For(email, twilio): got %v, want ErrUnsupported", err)
	}
	got, err := r.For(ChannelSMS, "twilio")
	if err != nil {
		t.Fatalf("For(sms, twilio): %v", err)
	}
	if got.Name() != ChannelSMS || got.Provider() != "twilio" {
		t.Fatalf("got %s/%s, want sms/twilio", got.Name(), got.Provider())
	}
}
