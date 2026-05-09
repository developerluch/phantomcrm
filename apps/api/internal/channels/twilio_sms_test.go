package channels

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

type fakeSMSTransport struct {
	calls    int
	lastTo   string
	lastBody string
	sid      string
	err      error
}

func (f *fakeSMSTransport) Send(to, body string) (string, error) {
	f.calls++
	f.lastTo = to
	f.lastBody = body
	if f.err != nil {
		return "", f.err
	}
	if f.sid == "" {
		return "SM-test-" + to, nil
	}
	return f.sid, nil
}

func TestTwilioSMS_HappyPath(t *testing.T) {
	tx := &fakeSMSTransport{sid: "SM123"}
	s := NewTwilioSMSSender(tx)

	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"}
	if err := s.CanSend(context.Background(), rec); err != nil {
		t.Fatalf("CanSend: %v", err)
	}
	receipt, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "ping"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if receipt.ProviderMessageID != "SM123" {
		t.Errorf("ProviderMessageID = %q, want SM123", receipt.ProviderMessageID)
	}
	if tx.calls != 1 {
		t.Errorf("transport calls = %d, want 1", tx.calls)
	}
	if tx.lastTo != "+15551234567" || tx.lastBody != "ping" {
		t.Errorf("transport got (%s, %s); want (+15551234567, ping)", tx.lastTo, tx.lastBody)
	}
}

func TestTwilioSMS_OptedOut(t *testing.T) {
	tx := &fakeSMSTransport{}
	s := NewTwilioSMSSender(tx)

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
		t.Fatalf("transport calls = %d, want 0 (must short-circuit)", tx.calls)
	}
}

func TestTwilioSMS_InvalidRecipient(t *testing.T) {
	tx := &fakeSMSTransport{}
	s := NewTwilioSMSSender(tx)

	cases := []struct {
		name string
		rec  Recipient
	}{
		{"empty phone", Recipient{ContactID: "c1"}},
		{"whitespace phone", Recipient{ContactID: "c1", PhoneE164: "   "}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := s.CanSend(context.Background(), tc.rec); !errors.Is(err, ErrInvalidRecipient) {
				t.Fatalf("CanSend: got %v, want ErrInvalidRecipient", err)
			}
			if _, err := s.Send(context.Background(), SendRequest{Recipient: tc.rec, Body: "x"}); !errors.Is(err, ErrInvalidRecipient) {
				t.Fatalf("Send: got %v, want ErrInvalidRecipient", err)
			}
		})
	}
}

func TestTwilioSMS_TransportNotConfigured(t *testing.T) {
	s := NewTwilioSMSSender(nil)
	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"}
	if err := s.CanSend(context.Background(), rec); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("CanSend(nil tx): got %v, want ErrUnsupported", err)
	}
}

func TestTwilioSMS_MapsTwilioErrors(t *testing.T) {
	cases := []struct {
		name string
		in   error
		want error
	}{
		{"rate limit", fmt.Errorf("sms: twilio returned 429"), ErrRateLimit},
		{"server down", fmt.Errorf("sms: twilio returned 503"), ErrProviderDown},
		{"transient 500", fmt.Errorf("sms: twilio returned 500"), ErrTransient},
		{"permanent 400", fmt.Errorf("sms: twilio returned 400"), ErrPermanent},
		{"permanent 401", fmt.Errorf("sms: twilio returned 401"), ErrPermanent},
		{"unknown wraps to transient", fmt.Errorf("network: dial tcp: i/o timeout"), ErrTransient},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := mapTwilioError(tc.in)
			if !errors.Is(got, tc.want) {
				t.Fatalf("mapTwilioError(%v) = %v, want wrap %v", tc.in, got, tc.want)
			}
		})
	}
	if mapTwilioError(nil) != nil {
		t.Fatalf("mapTwilioError(nil) should be nil")
	}
}

func TestTwilioSMS_ProviderError(t *testing.T) {
	tx := &fakeSMSTransport{err: fmt.Errorf("sms: twilio returned 429")}
	s := NewTwilioSMSSender(tx)

	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"}
	_, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "x"})
	if !errors.Is(err, ErrRateLimit) {
		t.Fatalf("Send (provider 429): got %v, want ErrRateLimit", err)
	}
}
