package sms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// TelnyxClient is a pure HTTP client for the Telnyx Messaging v2 API (no SDK
// dependency). Returns nil from NewTelnyx if not configured (nil-safe
// pattern, matches *sms.Client).
type TelnyxClient struct {
	apiKey             string
	fromNumber         string
	messagingProfileID string
	httpClient         *http.Client
}

// NewTelnyx creates a Telnyx client. Returns nil if apiKey is empty so the
// server boots without Telnyx creds and the channel registry falls back to
// ErrUnsupported for (sms, telnyx).
func NewTelnyx(apiKey, from, profileID string) *TelnyxClient {
	if apiKey == "" {
		return nil
	}
	return &TelnyxClient{
		apiKey:             apiKey,
		fromNumber:         from,
		messagingProfileID: profileID,
		httpClient:         &http.Client{Timeout: 15 * time.Second},
	}
}

// FromNumber returns the configured Telnyx sender number.
func (c *TelnyxClient) FromNumber() string {
	if c == nil {
		return ""
	}
	return c.fromNumber
}

// Send sends an SMS via the Telnyx Messaging API. Returns the Telnyx
// message ID (data.id). Satisfies channels.SMSTransport.
func (c *TelnyxClient) Send(to, body string) (string, error) {
	if c == nil {
		return "", fmt.Errorf("sms: client not configured")
	}

	// Telnyx caps single-segment SMS bodies; 1600 matches Twilio's cap and
	// is well within Telnyx's accepted range for concatenated messages.
	if len(body) > 1600 {
		body = body[:1600]
	}

	payload := map[string]string{
		"from": c.fromNumber,
		"to":   to,
		"text": body,
	}
	if c.messagingProfileID != "" {
		payload["messaging_profile_id"] = c.messagingProfileID
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("sms: encode telnyx payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.telnyx.com/v2/messages", bytes.NewReader(encoded))
	if err != nil {
		return "", fmt.Errorf("sms: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("sms: send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		log.Printf("Telnyx error %d: %s", resp.StatusCode, string(respBody))
		return "", fmt.Errorf("sms: telnyx returned %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("sms: parse response: %w", err)
	}

	return result.Data.ID, nil
}
