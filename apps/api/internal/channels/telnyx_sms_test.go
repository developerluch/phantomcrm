package channels

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

func TestTelnyxSMS_HappyPath(t *testing.T) {
	tx := &fakeSMSTransport{sid: "msg_telnyx_123"}
	s := NewTelnyxSMSSender(tx)

	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"}
	if err := s.CanSend(context.Background(), rec); err != nil {
		t.Fatalf("CanSend: %v", err)
	}
	receipt, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "ping"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if receipt.ProviderMessageID != "msg_telnyx_123" {
		t.Errorf("ProviderMessageID = %q, want msg_telnyx_123", receipt.ProviderMessageID)
	}
	if tx.calls != 1 {
		t.Errorf("transport calls = %d, want 1", tx.calls)
	}
	if tx.lastTo != "+15551234567" || tx.lastBody != "ping" {
		t.Errorf("transport got (%s, %s); want (+15551234567, ping)", tx.lastTo, tx.lastBody)
	}
}

func TestTelnyxSMS_OptedOut(t *testing.T) {
	tx := &fakeSMSTransport{}
	s := NewTelnyxSMSSender(tx)

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

func TestTelnyxSMS_InvalidRecipient(t *testing.T) {
	tx := &fakeSMSTransport{}
	s := NewTelnyxSMSSender(tx)

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

func TestTelnyxSMS_TransportNotConfigured(t *testing.T) {
	s := NewTelnyxSMSSender(nil)
	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"}
	if err := s.CanSend(context.Background(), rec); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("CanSend(nil tx): got %v, want ErrUnsupported", err)
	}
}

func TestTelnyxSMS_MapsTelnyxErrors(t *testing.T) {
	cases := []struct {
		name string
		in   error
		want error
	}{
		{"rate limit", fmt.Errorf("sms: telnyx returned 429"), ErrRateLimit},
		{"server down 503", fmt.Errorf("sms: telnyx returned 503"), ErrProviderDown},
		{"server down 504", fmt.Errorf("sms: telnyx returned 504"), ErrProviderDown},
		{"transient 500", fmt.Errorf("sms: telnyx returned 500"), ErrTransient},
		{"transient 502", fmt.Errorf("sms: telnyx returned 502"), ErrTransient},
		{"permanent 400", fmt.Errorf("sms: telnyx returned 400"), ErrPermanent},
		{"permanent 401", fmt.Errorf("sms: telnyx returned 401"), ErrPermanent},
		{"permanent 403", fmt.Errorf("sms: telnyx returned 403"), ErrPermanent},
		{"permanent 404", fmt.Errorf("sms: telnyx returned 404"), ErrPermanent},
		{"unknown wraps to transient", fmt.Errorf("network: dial tcp: i/o timeout"), ErrTransient},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := mapTelnyxError(tc.in)
			if !errors.Is(got, tc.want) {
				t.Fatalf("mapTelnyxError(%v) = %v, want wrap %v", tc.in, got, tc.want)
			}
		})
	}
	if mapTelnyxError(nil) != nil {
		t.Fatalf("mapTelnyxError(nil) should be nil")
	}
}

func TestTelnyxSMS_ProviderError(t *testing.T) {
	tx := &fakeSMSTransport{err: fmt.Errorf("sms: telnyx returned 429")}
	s := NewTelnyxSMSSender(tx)

	rec := Recipient{ContactID: "c1", PhoneE164: "+15551234567"}
	_, err := s.Send(context.Background(), SendRequest{Recipient: rec, Body: "x"})
	if !errors.Is(err, ErrRateLimit) {
		t.Fatalf("Send (provider 429): got %v, want ErrRateLimit", err)
	}
}
