package api

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/channels"
	"github.com/developerluch/phantomcrm/apps/api/internal/repo"
)

// telnyxReplayWindow is the maximum age a Telnyx-signed webhook payload may
// be before we reject it. Telnyx clocks may drift a few seconds; five
// minutes is the canonical replay window used across most signed-webhook
// providers (Stripe, Slack, Twilio Voice).
const telnyxReplayWindow = 5 * time.Minute

// verifyTelnyxSignature verifies an inbound Telnyx webhook against the
// configured TELNYX_PUBLIC_KEY using Ed25519. Per Telnyx docs, the signed
// payload is `<timestamp>|<rawBody>`. Headers are case-insensitive
// (r.Header.Get canonicalizes).
//
// Returns nil on success. Any non-nil error means the request should be
// rejected with 401.
func (s *Server) verifyTelnyxSignature(r *http.Request, rawBody []byte) error {
	if s.cfg.TelnyxPublicKey == "" {
		return errors.New("telnyx public key not configured")
	}

	sigB64 := r.Header.Get("Telnyx-Signature-Ed25519")
	timestamp := r.Header.Get("Telnyx-Timestamp")
	if sigB64 == "" || timestamp == "" {
		return errors.New("missing signature headers")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("bad timestamp: %w", err)
	}
	age := time.Since(time.Unix(ts, 0))
	if age < -telnyxReplayWindow || age > telnyxReplayWindow {
		return fmt.Errorf("timestamp outside replay window (age=%s)", age)
	}

	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return fmt.Errorf("bad signature encoding: %w", err)
	}
	if len(sig) != ed25519.SignatureSize {
		return fmt.Errorf("signature wrong size: got %d want %d", len(sig), ed25519.SignatureSize)
	}

	pubKey, err := base64.StdEncoding.DecodeString(s.cfg.TelnyxPublicKey)
	if err != nil {
		return fmt.Errorf("bad public key encoding: %w", err)
	}
	if len(pubKey) != ed25519.PublicKeySize {
		return fmt.Errorf("public key wrong size: got %d want %d", len(pubKey), ed25519.PublicKeySize)
	}

	payload := make([]byte, 0, len(timestamp)+1+len(rawBody))
	payload = append(payload, timestamp...)
	payload = append(payload, '|')
	payload = append(payload, rawBody...)

	if !ed25519.Verify(ed25519.PublicKey(pubKey), payload, sig) {
		return errors.New("invalid signature")
	}
	return nil
}

// telnyxPhone is the per-number block inside a Telnyx webhook payload's
// from / to fields. Telnyx always includes phone_number; other fields
// (carrier, line_type, status) are present on different event types.
type telnyxPhone struct {
	PhoneNumber string `json:"phone_number"`
	Status      string `json:"status"`
}

// telnyxError mirrors Telnyx's standard error shape inside a webhook
// payload's `errors` array (present on message.failed / failed-delivery
// events). Code is the numeric Telnyx error code; Title is human-readable.
type telnyxError struct {
	Code   string `json:"code"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

// telnyxWebhookEnvelope is the shared shape across Telnyx Messaging
// webhooks. Inbound and status callbacks both use it; the discriminator
// is data.event_type.
type telnyxWebhookEnvelope struct {
	Data struct {
		EventType string `json:"event_type"`
		Payload   struct {
			ID     string        `json:"id"`
			From   telnyxPhone   `json:"from"`
			To     []telnyxPhone `json:"to"`
			Text   string        `json:"text"`
			Errors []telnyxError `json:"errors"`
		} `json:"payload"`
	} `json:"data"`
}

// handleTelnyxInbound is the single entry point for every Telnyx Messaging
// webhook. Telnyx's messaging profile exposes only one webhook_url field,
// so inbound (message.received) AND status callbacks (message.sent /
// message.finalized / message.delivery_failed / message.sending_failed)
// all arrive here. Dispatch happens on data.event_type. Writes to the
// unified conversations + messages tables (skips the legacy sms_messages
// table that handleTwilioWebhook writes to; recruit-timeline parity for
// Telnyx-received SMS is intentionally out of scope for this PR).
func (s *Server) handleTelnyxInbound(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MiB cap
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewReader(rawBody))

	if err := s.verifyTelnyxSignature(r, rawBody); err != nil {
		log.Printf("telnyx webhook: signature verification failed: %v", err)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var env telnyxWebhookEnvelope
	if err := json.Unmarshal(rawBody, &env); err != nil {
		log.Printf("telnyx webhook: parse body: %v", err)
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	switch env.Data.EventType {
	case "message.received":
		// Inbound write path — unchanged.
		res, err := s.upsertInboundMessage(r.Context(), inboundMessage{
			Phone:      env.Data.Payload.From.PhoneNumber,
			Body:       env.Data.Payload.Text,
			ExternalID: env.Data.Payload.ID,
			Channel:    channels.ChannelSMS,
			Provider:   "telnyx",
			SourceType: "inbound_sms",
		})
		if err != nil {
			log.Printf("telnyx webhook: unified write: %v", err)
		} else {
			s.broadcastInbound(res, nil)
		}

	case "message.sent",
		"message.finalized",
		"message.delivery_failed",
		"message.sending_failed",
		"message.failed":
		// Status callback. mapTelnyxStatus has full unit-test coverage of
		// the (event_type, to[0].status, errors[0]) -> (status, errCode,
		// errMsg) translation; this branch is the thin handler glue.
		if env.Data.Payload.ID == "" {
			log.Printf("telnyx webhook: %s event missing payload.id", env.Data.EventType)
			break
		}
		status, errCode, errMsg := mapTelnyxStatus(env)
		if status == "" {
			// Defensive: should be unreachable given the case list above,
			// but log + 200-ack rather than retry forever.
			log.Printf("telnyx webhook: no status mapping for %s id=%s",
				env.Data.EventType, env.Data.Payload.ID)
			break
		}
		if err := s.messageRepo.UpdateStatusByProviderMessageID(
			r.Context(), "telnyx", env.Data.Payload.ID, status, errCode, errMsg,
		); err != nil {
			if errors.Is(err, repo.ErrNotFound) {
				// Status update for a message we don't have a record of —
				// normal for sends issued outside Phantom (portal test sends,
				// pre-provisioning messages). Log + 200-ack.
				log.Printf("telnyx webhook: status update for unknown message_id=%s status=%s",
					env.Data.Payload.ID, status)
				break
			}
			log.Printf("telnyx webhook: status update failed for id=%s status=%s: %v",
				env.Data.Payload.ID, status, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

	default:
		// Genuinely unknown event type. Log + 200-ack so Telnyx does not
		// retry on a loop.
		log.Printf("telnyx webhook: unhandled event type: %q", env.Data.EventType)
	}

	w.WriteHeader(http.StatusOK)
}

// mapTelnyxStatus collapses a Telnyx Messaging event into the unified
// messages.status vocabulary used by the outbound send path. Returns
// (status, errorCode, errorMessage) — the latter two are nil except on
// failed events. Returns "" for events the status dispatcher does not
// handle (message.received and any unknown type).
func mapTelnyxStatus(env telnyxWebhookEnvelope) (string, *string, *string) {
	switch env.Data.EventType {
	case "message.sent":
		return "sent", nil, nil
	case "message.finalized":
		// Telnyx "finalized" is the lifecycle-complete event. The real
		// outcome lives on to[0].status. Hybrid vocabulary:
		//   delivered           -> "delivered"
		//   delivery_failed     -> "delivery_failed" (preserve the distinct DB state)
		//   anything else       -> "failed" (delivery_unconfirmed, missing To, etc.)
		if len(env.Data.Payload.To) > 0 {
			switch env.Data.Payload.To[0].Status {
			case "delivered":
				return "delivered", nil, nil
			case "delivery_failed":
				code, msg := firstTelnyxError(env.Data.Payload.Errors)
				return "delivery_failed", code, msg
			}
		}
		code, msg := firstTelnyxError(env.Data.Payload.Errors)
		return "failed", code, msg
	case "message.delivery_failed", "message.sending_failed", "message.failed":
		// message.failed is the legacy Telnyx Messaging event name; kept as
		// a defensive synonym for accounts that may still emit it.
		code, msg := firstTelnyxError(env.Data.Payload.Errors)
		return "failed", code, msg
	default:
		return "", nil, nil
	}
}

func firstTelnyxError(errs []telnyxError) (*string, *string) {
	if len(errs) == 0 {
		return nil, nil
	}
	code := errs[0].Code
	msg := errs[0].Title
	if errs[0].Detail != "" {
		msg = msg + ": " + errs[0].Detail
	}
	var codePtr, msgPtr *string
	if code != "" {
		codePtr = &code
	}
	if msg != "" {
		msgPtr = &msg
	}
	return codePtr, msgPtr
}
