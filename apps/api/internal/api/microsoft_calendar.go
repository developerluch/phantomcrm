package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// handleMicrosoftAuthorize returns the Microsoft OAuth2 authorization URL.
func (s *Server) handleMicrosoftAuthorize(w http.ResponseWriter, _ *http.Request) {
	clientID := os.Getenv("MICROSOFT_CLIENT_ID")
	redirectURI := os.Getenv("MICROSOFT_REDIRECT_URI")
	if clientID == "" || redirectURI == "" {
		http.Error(w, "Microsoft OAuth not configured", http.StatusServiceUnavailable)
		return
	}
	scopes := "Calendars.ReadWrite offline_access"
	authURL := fmt.Sprintf("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&response_mode=query",
		url.QueryEscape(clientID), url.QueryEscape(redirectURI), url.QueryEscape(scopes))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": authURL})
}

// handleMicrosoftCallback exchanges the auth code for tokens and stores them.
func (s *Server) handleMicrosoftCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	clientID := os.Getenv("MICROSOFT_CLIENT_ID")
	clientSecret := os.Getenv("MICROSOFT_CLIENT_SECRET")
	redirectURI := os.Getenv("MICROSOFT_REDIRECT_URI")

	// Exchange code for tokens
	data := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
		"scope":         {"Calendars.ReadWrite offline_access"},
	}

	resp, err := http.Post("https://login.microsoftonline.com/common/oauth2/v2.0/token", "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		log.Printf("Microsoft token exchange error: %v", err)
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

	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	expiry := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	_, err = s.db.UpsertUserIntegration(r.Context(), user.UserID, "microsoft", tokenResp.AccessToken, tokenResp.RefreshToken, &expiry, tokenResp.Scope, "")
	if err != nil {
		log.Printf("UpsertUserIntegration error: %v", err)
		http.Error(w, "failed to store tokens", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"connected": true, "provider": "microsoft"})
}

// handleMicrosoftEvents fetches calendar events from Microsoft Graph API.
func (s *Server) handleMicrosoftEvents(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	integration, err := s.db.GetUserIntegration(r.Context(), user.UserID, "microsoft")
	if err != nil {
		http.Error(w, "Microsoft Calendar not connected", http.StatusNotFound)
		return
	}

	// Fetch events from Microsoft Graph API
	timeMin := time.Now().Format(time.RFC3339)
	timeMax := time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339)
	apiURL := fmt.Sprintf("https://graph.microsoft.com/v1.0/me/events?$filter=start/dateTime ge '%s' and start/dateTime le '%s'&$orderby=start/dateTime&$top=50",
		timeMin, timeMax)

	req, _ := http.NewRequestWithContext(r.Context(), "GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+integration.AccessTokenEnc)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Microsoft Calendar API error: %v", err)
		http.Error(w, "failed to fetch events", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

// handleMicrosoftSync pushes appointments to Microsoft Calendar.
func (s *Server) handleMicrosoftSync(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	integration, err := s.db.GetUserIntegration(r.Context(), user.UserID, "microsoft")
	if err != nil {
		http.Error(w, "Microsoft Calendar not connected", http.StatusNotFound)
		return
	}

	// Get upcoming appointments from our DB
	appointments, err := s.db.ListUpcomingAppointments(r.Context())
	if err != nil {
		log.Printf("ListUpcomingAppointments error: %v", err)
		http.Error(w, "failed to fetch appointments", http.StatusInternalServerError)
		return
	}

	synced := 0
	client := &http.Client{Timeout: 10 * time.Second}
	for _, appt := range appointments {
		event := map[string]any{
			"subject": appt.Title,
			"start": map[string]string{
				"dateTime": appt.StartTime.Format("2006-01-02T15:04:05"),
				"timeZone": "UTC",
			},
			"end": map[string]string{
				"dateTime": appt.EndTime.Format("2006-01-02T15:04:05"),
				"timeZone": "UTC",
			},
		}
		if appt.Description != nil && *appt.Description != "" {
			event["body"] = map[string]string{
				"contentType": "text",
				"content":     *appt.Description,
			}
		}
		eventJSON, _ := json.Marshal(event)

		req, _ := http.NewRequestWithContext(r.Context(), "POST", "https://graph.microsoft.com/v1.0/me/events", strings.NewReader(string(eventJSON)))
		req.Header.Set("Authorization", "Bearer "+integration.AccessTokenEnc)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Microsoft Calendar sync error: %v", err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == 200 || resp.StatusCode == 201 {
			synced++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"synced": synced, "total": len(appointments)})
}

// handleMicrosoftDisconnect removes the Microsoft Calendar integration.
func (s *Server) handleMicrosoftDisconnect(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := s.db.DeleteUserIntegration(r.Context(), user.UserID, "microsoft"); err != nil {
		log.Printf("DeleteUserIntegration error: %v", err)
		http.Error(w, "failed to disconnect", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"disconnected": true})
}

// handleMicrosoftStatus returns whether Microsoft Calendar is connected.
func (s *Server) handleMicrosoftStatus(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	integration, err := s.db.GetUserIntegration(r.Context(), user.UserID, "microsoft")
	connected := err == nil && integration != nil
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"connected": connected, "provider": "microsoft"})
}
