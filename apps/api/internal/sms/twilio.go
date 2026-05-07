package sms

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is a pure HTTP client for the Twilio REST API (no SDK dependency).
// Returns nil from NewClient if not configured (nil-safe pattern).
type Client struct {
	accountSID     string
	authToken      string
	fromNumber     string
	waFromNumber   string // WhatsApp-enabled Twilio number (may differ from SMS)
	httpClient     *http.Client
}

// NewClient creates a Twilio client. Returns nil if any param is empty.
func NewClient(sid, token, from string) *Client {
	if sid == "" || token == "" || from == "" {
		return nil
	}
	return &Client{
		accountSID: sid,
		authToken:  token,
		fromNumber: from,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// FromNumber returns the configured Twilio phone number.
func (c *Client) FromNumber() string {
	return c.fromNumber
}

// SetWhatsAppNumber sets the WhatsApp-enabled Twilio number.
func (c *Client) SetWhatsAppNumber(from string) {
	if c != nil {
		c.waFromNumber = from
	}
}

// WhatsAppNumber returns the WhatsApp-enabled number, falling back to the SMS number.
func (c *Client) WhatsAppNumber() string {
	if c.waFromNumber != "" {
		return c.waFromNumber
	}
	return c.fromNumber
}

// Send sends an SMS via the Twilio Messages API. Returns the Twilio message SID.
func (c *Client) Send(to, body string) (string, error) {
	if c == nil {
		return "", fmt.Errorf("sms: client not configured")
	}

	// Truncate body to 1600 chars (Twilio limit for multi-segment)
	if len(body) > 1600 {
		body = body[:1600]
	}

	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", c.accountSID)

	data := url.Values{}
	data.Set("From", c.fromNumber)
	data.Set("To", to)
	data.Set("Body", body)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("sms: create request: %w", err)
	}
	req.SetBasicAuth(c.accountSID, c.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("sms: send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		log.Printf("Twilio error %d: %s", resp.StatusCode, string(respBody))
		return "", fmt.Errorf("sms: twilio returned %d", resp.StatusCode)
	}

	var result struct {
		SID string `json:"sid"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("sms: parse response: %w", err)
	}

	return result.SID, nil
}

// SendWhatsApp sends a WhatsApp message via Twilio. Returns the message SID.
// The Twilio Messages API uses the same endpoint but with "whatsapp:" prefix on From/To.
func (c *Client) SendWhatsApp(to, body string) (string, error) {
	if c == nil {
		return "", fmt.Errorf("sms: client not configured")
	}

	// WhatsApp body limit is 4096 chars
	if len(body) > 4096 {
		body = body[:4096]
	}

	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", c.accountSID)

	// Ensure whatsapp: prefix on both From and To
	waFrom := "whatsapp:" + c.WhatsAppNumber()
	if !strings.HasPrefix(to, "whatsapp:") {
		to = "whatsapp:" + to
	}

	data := url.Values{}
	data.Set("From", waFrom)
	data.Set("To", to)
	data.Set("Body", body)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("sms: create whatsapp request: %w", err)
	}
	req.SetBasicAuth(c.accountSID, c.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("sms: send whatsapp request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		log.Printf("Twilio WhatsApp error %d: %s", resp.StatusCode, string(respBody))
		return "", fmt.Errorf("sms: twilio whatsapp returned %d", resp.StatusCode)
	}

	var result struct {
		SID string `json:"sid"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("sms: parse whatsapp response: %w", err)
	}

	return result.SID, nil
}
