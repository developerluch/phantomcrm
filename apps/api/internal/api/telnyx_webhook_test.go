package api

import (
	"testing"
)

// telnyxEnv assembles a minimal telnyxWebhookEnvelope for table tests.
// Keep the helper local and explicit so each case's intent is readable
// without a layer of indirection.
func telnyxEnv(eventType string, to []telnyxPhone, errs []telnyxError) telnyxWebhookEnvelope {
	var env telnyxWebhookEnvelope
	env.Data.EventType = eventType
	env.Data.Payload.To = to
	env.Data.Payload.Errors = errs
	return env
}

func TestMapTelnyxStatus_MessageSent(t *testing.T) {
	status, code, msg := mapTelnyxStatus(telnyxEnv("message.sent", nil, nil))
	if status != "sent" {
		t.Fatalf("status = %q, want sent", status)
	}
	if code != nil || msg != nil {
		t.Fatalf("expected nil error fields, got code=%v msg=%v", code, msg)
	}
}

func TestMapTelnyxStatus_FinalizedDelivered(t *testing.T) {
	env := telnyxEnv(
		"message.finalized",
		[]telnyxPhone{{PhoneNumber: "+15551112222", Status: "delivered"}},
		nil,
	)
	status, code, msg := mapTelnyxStatus(env)
	if status != "delivered" {
		t.Fatalf("status = %q, want delivered", status)
	}
	if code != nil || msg != nil {
		t.Fatalf("expected nil error fields on delivered, got code=%v msg=%v", code, msg)
	}
}

func TestMapTelnyxStatus_FinalizedDeliveryFailed(t *testing.T) {
	env := telnyxEnv(
		"message.finalized",
		[]telnyxPhone{{PhoneNumber: "+15551112222", Status: "delivery_failed"}},
		[]telnyxError{{Code: "40010", Title: "carrier_rejection", Detail: "spam_detected"}},
	)
	status, code, msg := mapTelnyxStatus(env)
	if status != "delivery_failed" {
		t.Fatalf("status = %q, want delivery_failed", status)
	}
	if code == nil || *code != "40010" {
		t.Fatalf("code = %v, want *40010", code)
	}
	if msg == nil || *msg != "carrier_rejection: spam_detected" {
		t.Fatalf("msg = %v, want *\"carrier_rejection: spam_detected\"", msg)
	}
}

func TestMapTelnyxStatus_FinalizedDeliveryUnconfirmedCollapsesToFailed(t *testing.T) {
	env := telnyxEnv(
		"message.finalized",
		[]telnyxPhone{{PhoneNumber: "+15551112222", Status: "delivery_unconfirmed"}},
		nil,
	)
	status, code, msg := mapTelnyxStatus(env)
	if status != "failed" {
		t.Fatalf("status = %q, want failed (collapsed)", status)
	}
	if code != nil || msg != nil {
		t.Fatalf("expected nil error fields when errors[] is empty, got code=%v msg=%v", code, msg)
	}
}

func TestMapTelnyxStatus_FinalizedMissingToCollapsesToFailed(t *testing.T) {
	env := telnyxEnv("message.finalized", nil, []telnyxError{{Code: "9999", Title: "unknown"}})
	status, code, msg := mapTelnyxStatus(env)
	if status != "failed" {
		t.Fatalf("status = %q, want failed when To is empty", status)
	}
	if code == nil || *code != "9999" {
		t.Fatalf("code = %v, want *9999", code)
	}
	if msg == nil || *msg != "unknown" {
		t.Fatalf("msg = %v, want *\"unknown\"", msg)
	}
}

func TestMapTelnyxStatus_DeliveryFailedEvent(t *testing.T) {
	env := telnyxEnv(
		"message.delivery_failed",
		nil,
		[]telnyxError{{Code: "40005", Title: "destination_unreachable", Detail: "number_disconnected"}},
	)
	status, code, msg := mapTelnyxStatus(env)
	if status != "failed" {
		t.Fatalf("status = %q, want failed", status)
	}
	if code == nil || *code != "40005" {
		t.Fatalf("code = %v, want *40005", code)
	}
	if msg == nil || *msg != "destination_unreachable: number_disconnected" {
		t.Fatalf("msg = %v, want *\"destination_unreachable: number_disconnected\"", msg)
	}
}

func TestMapTelnyxStatus_SendingFailedEvent(t *testing.T) {
	env := telnyxEnv("message.sending_failed", nil, []telnyxError{{Code: "10002", Title: "auth_failure"}})
	status, code, msg := mapTelnyxStatus(env)
	if status != "failed" {
		t.Fatalf("status = %q, want failed", status)
	}
	if code == nil || *code != "10002" {
		t.Fatalf("code = %v, want *10002", code)
	}
	if msg == nil || *msg != "auth_failure" {
		t.Fatalf("msg = %v, want *\"auth_failure\"", msg)
	}
}

func TestMapTelnyxStatus_LegacyMessageFailedEvent(t *testing.T) {
	env := telnyxEnv("message.failed", nil, []telnyxError{{Code: "30007", Title: "blocked"}})
	status, code, msg := mapTelnyxStatus(env)
	if status != "failed" {
		t.Fatalf("status = %q, want failed (legacy alias)", status)
	}
	if code == nil || *code != "30007" {
		t.Fatalf("code = %v, want *30007", code)
	}
	if msg == nil || *msg != "blocked" {
		t.Fatalf("msg = %v, want *\"blocked\"", msg)
	}
}

func TestMapTelnyxStatus_FailedEventWithNoErrors(t *testing.T) {
	env := telnyxEnv("message.delivery_failed", nil, nil)
	status, code, msg := mapTelnyxStatus(env)
	if status != "failed" {
		t.Fatalf("status = %q, want failed", status)
	}
	if code != nil || msg != nil {
		t.Fatalf("expected nil error fields when errors[] is empty, got code=%v msg=%v", code, msg)
	}
}

func TestMapTelnyxStatus_MessageReceivedReturnsEmpty(t *testing.T) {
	// message.received is handled by the inbound write path, not the status
	// dispatcher. mapTelnyxStatus must return ("", nil, nil) so the caller
	// knows there is no status update to write.
	env := telnyxEnv("message.received", nil, nil)
	status, code, msg := mapTelnyxStatus(env)
	if status != "" {
		t.Fatalf("status = %q, want empty for message.received", status)
	}
	if code != nil || msg != nil {
		t.Fatalf("expected nil error fields for message.received, got code=%v msg=%v", code, msg)
	}
}

func TestMapTelnyxStatus_UnknownEventReturnsEmpty(t *testing.T) {
	env := telnyxEnv("message.totally_made_up", nil, nil)
	status, code, msg := mapTelnyxStatus(env)
	if status != "" {
		t.Fatalf("status = %q, want empty for unknown event", status)
	}
	if code != nil || msg != nil {
		t.Fatalf("expected nil error fields for unknown event, got code=%v msg=%v", code, msg)
	}
}
