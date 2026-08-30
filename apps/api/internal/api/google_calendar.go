package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

// ──────────────────────────────────────────────────────────────
// Google API response structs (for parsing raw JSON)
// ──────────────────────────────────────────────────────────────

type googleEventsResponse struct {
	Items []googleEventItem `json:"items"`
}

type googleEventItem struct {
	Id               string                `json:"id"`
	Summary          string                `json:"summary"`
	Description      string                `json:"description"`
	Location         string                `json:"location"`
	Status           string                `json:"status"`
	HtmlLink         string                `json:"htmlLink"`
	ColorId          string                `json:"colorId"`
	RecurringEventId string                `json:"recurringEventId"`
	HangoutLink      string                `json:"hangoutLink"`
	Start            *googleEventDateTime  `json:"start"`
	End              *googleEventDateTime  `json:"end"`
	Attendees        []googleEventAttendee `json:"attendees"`
	ConferenceData   *googleConferenceData `json:"conferenceData"`
}

type googleEventDateTime struct {
	DateTime string `json:"dateTime"`
	Date     string `json:"date"`
	TimeZone string `json:"timeZone"`
}

type googleEventAttendee struct {
	Email          string `json:"email"`
	DisplayName    string `json:"displayName"`
	ResponseStatus string `json:"responseStatus"`
}

type googleConferenceData struct {
	EntryPoints []googleEntryPoint `json:"entryPoints"`
}

type googleEntryPoint struct {
	EntryPointType string `json:"entryPointType"`
	Uri            string `json:"uri"`
}

// ──────────────────────────────────────────────────────────────
// HMAC state helpers (secure OAuth state param)
// ──────────────────────────────────────────────────────────────

func (s *Server) signOAuthState(userID string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	mac.Write([]byte(userID))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(userID)) + "." + sig
}

func (s *Server) verifyOAuthState(state string) (string, error) {
	parts := strings.SplitN(state, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid state format")
	}
	userIDBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("invalid state encoding")
	}
	userID := string(userIDBytes)

	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	mac.Write([]byte(userID))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(parts[1]), []byte(expectedSig)) {
		return "", fmt.Errorf("invalid state signature")
	}
	return userID, nil
}

// ──────────────────────────────────────────────────────────────
// Token refresh helper
// ──────────────────────────────────────────────────────────────

func (s *Server) ensureValidGoogleToken(ctx context.Context, integration *db.UserIntegration) (*db.UserIntegration, error) {
	if integration.TokenExpiry != nil && time.Until(*integration.TokenExpiry) > 5*time.Minute {
		return integration, nil // still valid
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if integration.RefreshTokenEnc == "" {
		return nil, fmt.Errorf("no refresh token available")
	}

	data := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {integration.RefreshTokenEnc},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
	}

	resp, err := http.Post("https://oauth2.googleapis.com/token", "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("token refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token refresh failed (%d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse refresh response: %w", err)
	}

	expiry := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	integration.AccessTokenEnc = tokenResp.AccessToken
	integration.TokenExpiry = &expiry

	// Persist refreshed token
	_, err = s.db.UpsertUserIntegration(ctx, integration.UserID, "google", tokenResp.AccessToken, integration.RefreshTokenEnc, &expiry, integration.Scopes, "")
	if err != nil {
		log.Printf("failed to persist refreshed google token: %v", err)
	}

	return integration, nil
}

func (s *Server) getGoogleIntegration(ctx context.Context, userID string) (*db.UserIntegration, error) {
	integration, err := s.db.GetUserIntegration(ctx, userID, "google")
	if err != nil {
		return nil, fmt.Errorf("Google Calendar not connected")
	}
	return s.ensureValidGoogleToken(ctx, integration)
}

// ──────────────────────────────────────────────────────────────
// Response transformer
// ──────────────────────────────────────────────────────────────

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func transformGoogleEvent(e googleEventItem) map[string]any {
	startTime := e.Start.DateTime
	if startTime == "" {
		startTime = e.Start.Date
	}
	endTime := e.End.DateTime
	if endTime == "" {
		endTime = e.End.Date
	}

	var meetLink string
	if e.ConferenceData != nil {
		for _, ep := range e.ConferenceData.EntryPoints {
			if ep.EntryPointType == "video" {
				meetLink = ep.Uri
				break
			}
		}
	}
	if meetLink == "" {
		meetLink = e.HangoutLink
	}

	attendees := make([]map[string]any, 0, len(e.Attendees))
	for _, a := range e.Attendees {
		attendees = append(attendees, map[string]any{
			"email":          a.Email,
			"displayName":    nullableString(a.DisplayName),
			"responseStatus": a.ResponseStatus,
		})
	}

	return map[string]any{
		"id":               e.Id,
		"googleEventId":    e.Id,
		"summary":          e.Summary,
		"description":      nullableString(e.Description),
		"location":         nullableString(e.Location),
		"startTime":        startTime,
		"endTime":          endTime,
		"status":           e.Status,
		"attendees":        attendees,
		"meetingLink":      nullableString(meetLink),
		"recurringEventId": nullableString(e.RecurringEventId),
		"colorId":          nullableString(e.ColorId),
		"htmlLink":         e.HtmlLink,
	}
}

// ──────────────────────────────────────────────────────────────
// Raw HTTP helper for Google Calendar API
// ──────────────────────────────────────────────────────────────

func googleAPIRequest(ctx context.Context, method, url, accessToken string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	client := &http.Client{Timeout: 15 * time.Second}
	return client.Do(req)
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/integrations/google/authorize
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleAuthorize(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	redirectURI := os.Getenv("GOOGLE_REDIRECT_URI")
	if clientID == "" || redirectURI == "" {
		jsonError(w, "Google OAuth not configured", http.StatusServiceUnavailable)
		return
	}

	state := s.signOAuthState(user.UserID)
	scopes := "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email"
	authURL := fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&access_type=offline&prompt=consent&state=%s",
		url.QueryEscape(clientID), url.QueryEscape(redirectURI), url.QueryEscape(scopes), url.QueryEscape(state))

	jsonOK(w, map[string]string{"url": authURL})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/integrations/google/callback (NO auth middleware)
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	userID, err := s.verifyOAuthState(state)
	if err != nil {
		log.Printf("Google OAuth invalid state: %v", err)
		http.Error(w, "invalid state parameter", http.StatusBadRequest)
		return
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURI := os.Getenv("GOOGLE_REDIRECT_URI")

	// Exchange code for tokens
	data := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.Post("https://oauth2.googleapis.com/token", "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		log.Printf("Google token exchange error: %v", err)
		http.Error(w, "token exchange failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		http.Error(w, "failed to parse token response", http.StatusInternalServerError)
		return
	}

	if tokenResp.AccessToken == "" {
		http.Error(w, "no access token received", http.StatusBadGateway)
		return
	}

	// Fetch user's Google email
	var googleEmail string
	emailResp, err := googleAPIRequest(r.Context(), "GET", "https://www.googleapis.com/oauth2/v2/userinfo", tokenResp.AccessToken, nil)
	if err == nil {
		defer emailResp.Body.Close()
		var info struct {
			Email string `json:"email"`
		}
		if json.NewDecoder(emailResp.Body).Decode(&info) == nil {
			googleEmail = info.Email
		}
	}

	expiry := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	_, err = s.db.UpsertUserIntegration(r.Context(), userID, "google", tokenResp.AccessToken, tokenResp.RefreshToken, &expiry, tokenResp.Scope, googleEmail)
	if err != nil {
		log.Printf("UpsertUserIntegration error: %v", err)
		http.Error(w, "failed to store tokens", http.StatusInternalServerError)
		return
	}

	// Return self-closing HTML page (this is a browser redirect, not an API call)
	successHTML := `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff;">
<div style="text-align:center;">
<h2 style="color:#DEFF9A;">Google Calendar Connected!</h2>
<p>You can close this window and return to the app.</p>
<script>
if (window.opener) { window.opener.postMessage('google-connected', '*'); window.close(); }
else { setTimeout(function(){ window.close(); }, 3000); }
</script>
</div></body></html>`
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(successHTML))
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/integrations/google/status
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleStatus(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	integration, err := s.db.GetUserIntegration(r.Context(), user.UserID, "google")
	connected := err == nil && integration != nil
	resp := map[string]any{"connected": connected, "provider": "google"}
	if connected && integration.GoogleEmail != "" {
		resp["email"] = integration.GoogleEmail
	}
	jsonOK(w, resp)
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/integrations/google/accounts
// ──────────────────────────────────────────────────────────────
// The frontend was updated to a multi-account contract (see
// src/types/portal.ts:GoogleCalendarAccount) but the backend still tracks
// one google integration per user via user_integrations. Until the multi-
// account schema lands, expose the single integration (if connected) as a
// one-element array so the frontend renders the existing account instead
// of 404ing.
func (s *Server) handleGoogleAccounts(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	integration, err := s.db.GetUserIntegration(r.Context(), user.UserID, "google")
	if err != nil || integration == nil {
		jsonOK(w, []map[string]any{})
		return
	}

	jsonOK(w, []map[string]any{{
		"id":          integration.ID,
		"googleEmail": integration.GoogleEmail,
		"displayName": nil,
		"calendarId":  "primary",
		"color":       "#7dd3fc",
		"isPrimary":   true,
		"createdAt":   integration.CreatedAt,
	}})
}

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/integrations/google
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleDisconnect(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Best-effort revoke token at Google
	integration, _ := s.db.GetUserIntegration(r.Context(), user.UserID, "google")
	if integration != nil {
		revokeURL := "https://oauth2.googleapis.com/revoke?token=" + url.QueryEscape(integration.AccessTokenEnc)
		http.Post(revokeURL, "application/x-www-form-urlencoded", nil)
	}

	if err := s.db.DeleteUserIntegration(r.Context(), user.UserID, "google"); err != nil {
		log.Printf("DeleteUserIntegration error: %v", err)
		jsonError(w, "failed to disconnect", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"disconnected": true})
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/integrations/google/sync
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleSync(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	integration, err := s.getGoogleIntegration(r.Context(), user.UserID)
	if err != nil {
		jsonError(w, "Google Calendar not connected", http.StatusNotFound)
		return
	}

	appointments, err := s.db.ListUpcomingAppointments(r.Context())
	if err != nil {
		log.Printf("ListUpcomingAppointments error: %v", err)
		jsonError(w, "failed to fetch appointments", http.StatusInternalServerError)
		return
	}

	synced := 0
	for _, appt := range appointments {
		event := map[string]any{
			"summary": appt.Title,
			"start":   map[string]string{"dateTime": appt.StartTime.Format(time.RFC3339)},
			"end":     map[string]string{"dateTime": appt.EndTime.Format(time.RFC3339)},
		}
		if appt.Description != nil && *appt.Description != "" {
			event["description"] = *appt.Description
		}
		eventJSON, _ := json.Marshal(event)

		resp, err := googleAPIRequest(r.Context(), "POST", "https://www.googleapis.com/calendar/v3/calendars/primary/events", integration.AccessTokenEnc, strings.NewReader(string(eventJSON)))
		if err != nil {
			log.Printf("Google Calendar sync error: %v", err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == 200 || resp.StatusCode == 201 {
			synced++
		}
	}

	jsonOK(w, map[string]any{"synced": synced})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/integrations/google/events
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleEvents(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	integration, err := s.getGoogleIntegration(r.Context(), user.UserID)
	if err != nil {
		jsonError(w, "Google Calendar not connected", http.StatusNotFound)
		return
	}

	timeMin := r.URL.Query().Get("timeMin")
	timeMax := r.URL.Query().Get("timeMax")
	if timeMin == "" {
		timeMin = time.Now().Format(time.RFC3339)
	}
	if timeMax == "" {
		timeMax = time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339)
	}

	apiURL := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=%s&timeMax=%s&singleEvents=true&orderBy=startTime&maxResults=250",
		url.QueryEscape(timeMin), url.QueryEscape(timeMax))

	resp, err := googleAPIRequest(r.Context(), "GET", apiURL, integration.AccessTokenEnc, nil)
	if err != nil {
		log.Printf("Google Calendar API error: %v", err)
		jsonError(w, "failed to fetch events", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Google Calendar API error (%d): %s", resp.StatusCode, string(body))
		jsonError(w, "Google Calendar API error", http.StatusBadGateway)
		return
	}

	var eventsResp googleEventsResponse
	if err := json.NewDecoder(resp.Body).Decode(&eventsResp); err != nil {
		jsonError(w, "failed to parse Google response", http.StatusInternalServerError)
		return
	}

	result := make([]map[string]any, 0, len(eventsResp.Items))
	for _, e := range eventsResp.Items {
		result = append(result, transformGoogleEvent(e))
	}
	jsonOK(w, result)
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/integrations/google/events
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleCreateEvent(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Summary        string   `json:"summary"`
		Description    string   `json:"description"`
		Location       string   `json:"location"`
		StartTime      string   `json:"startTime"`
		EndTime        string   `json:"endTime"`
		AttendeeEmails []string `json:"attendeeEmails"`
		AddGoogleMeet  bool     `json:"addGoogleMeet"`
		Recurrence     []string `json:"recurrence"`
		Reminders      []struct {
			Method  string `json:"method"`
			Minutes int    `json:"minutes"`
		} `json:"reminders"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Summary == "" || req.StartTime == "" || req.EndTime == "" {
		jsonError(w, "summary, startTime, and endTime are required", http.StatusBadRequest)
		return
	}

	integration, err := s.getGoogleIntegration(r.Context(), user.UserID)
	if err != nil {
		jsonError(w, "Google Calendar not connected", http.StatusNotFound)
		return
	}

	// Build Google Calendar event
	event := map[string]any{
		"summary": req.Summary,
		"start":   map[string]string{"dateTime": req.StartTime, "timeZone": "UTC"},
		"end":     map[string]string{"dateTime": req.EndTime, "timeZone": "UTC"},
	}
	if req.Description != "" {
		event["description"] = req.Description
	}
	if req.Location != "" {
		event["location"] = req.Location
	}
	if len(req.Recurrence) > 0 {
		event["recurrence"] = req.Recurrence
	}

	// Attendees
	if len(req.AttendeeEmails) > 0 {
		attendees := make([]map[string]string, 0, len(req.AttendeeEmails))
		for _, email := range req.AttendeeEmails {
			attendees = append(attendees, map[string]string{"email": email})
		}
		event["attendees"] = attendees
	}

	// Google Meet
	if req.AddGoogleMeet {
		event["conferenceData"] = map[string]any{
			"createRequest": map[string]any{
				"requestId":             fmt.Sprintf("vipa-%d", time.Now().UnixNano()),
				"conferenceSolutionKey": map[string]string{"type": "hangoutsMeet"},
			},
		}
	}

	// Reminders
	if len(req.Reminders) > 0 {
		overrides := make([]map[string]any, 0, len(req.Reminders))
		for _, rem := range req.Reminders {
			overrides = append(overrides, map[string]any{
				"method":  rem.Method,
				"minutes": rem.Minutes,
			})
		}
		event["reminders"] = map[string]any{
			"useDefault": false,
			"overrides":  overrides,
		}
	}

	eventJSON, _ := json.Marshal(event)

	// conferenceDataVersion=1 required for Meet creation
	apiURL := "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all"
	if req.AddGoogleMeet {
		apiURL += "&conferenceDataVersion=1"
	}

	resp, err := googleAPIRequest(r.Context(), "POST", apiURL, integration.AccessTokenEnc, strings.NewReader(string(eventJSON)))
	if err != nil {
		log.Printf("Google Calendar create error: %v", err)
		jsonError(w, "failed to create event", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Google Calendar create error (%d): %s", resp.StatusCode, string(body))
		jsonError(w, "Google Calendar API error", http.StatusBadGateway)
		return
	}

	var created googleEventItem
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		jsonError(w, "failed to parse created event", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(transformGoogleEvent(created))
}

// ──────────────────────────────────────────────────────────────
// PUT /api/v1/integrations/google/events/{eventId}
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	eventId := r.PathValue("eventId")
	if eventId == "" {
		jsonError(w, "missing eventId", http.StatusBadRequest)
		return
	}

	var req struct {
		Summary     string `json:"summary"`
		Description string `json:"description"`
		Location    string `json:"location"`
		StartTime   string `json:"startTime"`
		EndTime     string `json:"endTime"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	integration, err := s.getGoogleIntegration(r.Context(), user.UserID)
	if err != nil {
		jsonError(w, "Google Calendar not connected", http.StatusNotFound)
		return
	}

	// Fetch existing event from Google
	getURL := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events/%s", url.PathEscape(eventId))
	getResp, err := googleAPIRequest(r.Context(), "GET", getURL, integration.AccessTokenEnc, nil)
	if err != nil {
		jsonError(w, "failed to fetch event", http.StatusBadGateway)
		return
	}
	defer getResp.Body.Close()

	if getResp.StatusCode == 404 {
		jsonError(w, "event not found", http.StatusNotFound)
		return
	}
	if getResp.StatusCode != 200 {
		jsonError(w, "Google Calendar API error", http.StatusBadGateway)
		return
	}

	// Parse existing event as raw JSON and merge updates
	var existing map[string]any
	if err := json.NewDecoder(getResp.Body).Decode(&existing); err != nil {
		jsonError(w, "failed to parse existing event", http.StatusInternalServerError)
		return
	}

	if req.Summary != "" {
		existing["summary"] = req.Summary
	}
	if req.Description != "" {
		existing["description"] = req.Description
	}
	if req.Location != "" {
		existing["location"] = req.Location
	}
	if req.StartTime != "" {
		existing["start"] = map[string]string{"dateTime": req.StartTime}
	}
	if req.EndTime != "" {
		existing["end"] = map[string]string{"dateTime": req.EndTime}
	}

	updatedJSON, _ := json.Marshal(existing)

	putURL := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events/%s?sendUpdates=all", url.PathEscape(eventId))
	putResp, err := googleAPIRequest(r.Context(), "PUT", putURL, integration.AccessTokenEnc, strings.NewReader(string(updatedJSON)))
	if err != nil {
		jsonError(w, "failed to update event", http.StatusBadGateway)
		return
	}
	defer putResp.Body.Close()

	if putResp.StatusCode != 200 {
		body, _ := io.ReadAll(putResp.Body)
		log.Printf("Google Calendar update error (%d): %s", putResp.StatusCode, string(body))
		jsonError(w, "Google Calendar API error", http.StatusBadGateway)
		return
	}

	var updated googleEventItem
	if err := json.NewDecoder(putResp.Body).Decode(&updated); err != nil {
		jsonError(w, "failed to parse updated event", http.StatusInternalServerError)
		return
	}
	jsonOK(w, transformGoogleEvent(updated))
}

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/integrations/google/events/{eventId}
// ──────────────────────────────────────────────────────────────

func (s *Server) handleGoogleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	eventId := r.PathValue("eventId")
	if eventId == "" {
		jsonError(w, "missing eventId", http.StatusBadRequest)
		return
	}

	integration, err := s.getGoogleIntegration(r.Context(), user.UserID)
	if err != nil {
		jsonError(w, "Google Calendar not connected", http.StatusNotFound)
		return
	}

	deleteURL := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events/%s?sendUpdates=all", url.PathEscape(eventId))
	resp, err := googleAPIRequest(r.Context(), "DELETE", deleteURL, integration.AccessTokenEnc, nil)
	if err != nil {
		jsonError(w, "failed to delete event", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 204 && resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Google Calendar delete error (%d): %s", resp.StatusCode, string(body))
		jsonError(w, "Google Calendar API error", http.StatusBadGateway)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
