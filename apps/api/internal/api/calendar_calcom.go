package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"
)

const calcomBaseURL = "https://api.cal.com/v2"

// calcomRequest makes an authenticated request to the Cal.com v2 API.
// It returns the raw response body, HTTP status code, and any error.
func (s *Server) calcomRequest(ctx context.Context, method, endpoint string, query url.Values, apiVersion string) ([]byte, int, error) {
	apiKey := s.cfg.CalComAPIKey
	if apiKey == "" {
		return nil, http.StatusServiceUnavailable, fmt.Errorf("CALCOM_API_KEY not configured")
	}

	u := calcomBaseURL + endpoint
	if len(query) > 0 {
		u += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, method, u, nil)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	if apiVersion == "" {
		apiVersion = "2024-08-13"
	}
	req.Header.Set("cal-api-version", apiVersion)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}

	return body, resp.StatusCode, nil
}

// handleCalcomStatus checks whether Cal.com is connected and returns the username/booking URL.
func (s *Server) handleCalcomStatus(w http.ResponseWriter, r *http.Request) {
	if s.cfg.CalComAPIKey == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"connected": false})
		return
	}

	body, statusCode, err := s.calcomRequest(r.Context(), "GET", "/me", nil, "")
	if err != nil || statusCode != 200 {
		log.Printf("Cal.com /me error: status=%d err=%v", statusCode, err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"connected": false})
		return
	}

	var result struct {
		Status string `json:"status"`
		Data   struct {
			Username string `json:"username"`
			TimeZone string `json:"timeZone"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("Cal.com /me parse error: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"connected": false})
		return
	}

	bookingURL := ""
	if result.Data.Username != "" {
		bookingURL = "https://cal.com/" + result.Data.Username
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"connected":  true,
		"username":   result.Data.Username,
		"bookingUrl": bookingURL,
		"timeZone":   result.Data.TimeZone,
	})
}

// handleCalcomEventTypes proxies to GET /v2/event-types.
func (s *Server) handleCalcomEventTypes(w http.ResponseWriter, r *http.Request) {
	body, statusCode, err := s.calcomRequest(r.Context(), "GET", "/event-types", r.URL.Query(), "")
	if err != nil {
		log.Printf("Cal.com event-types error: %v", err)
		jsonError(w, "failed to fetch event types", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}

// handleCalcomBookings proxies to GET /v2/bookings with optional query params.
func (s *Server) handleCalcomBookings(w http.ResponseWriter, r *http.Request) {
	body, statusCode, err := s.calcomRequest(r.Context(), "GET", "/bookings", r.URL.Query(), "")
	if err != nil {
		log.Printf("Cal.com bookings error: %v", err)
		jsonError(w, "failed to fetch bookings", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}

// handleCalcomBookingDetail proxies to GET /v2/bookings/{uid}.
func (s *Server) handleCalcomBookingDetail(w http.ResponseWriter, r *http.Request) {
	uid := r.PathValue("uid")
	if uid == "" {
		jsonError(w, "missing booking uid", http.StatusBadRequest)
		return
	}

	body, statusCode, err := s.calcomRequest(r.Context(), "GET", "/bookings/"+uid, nil, "")
	if err != nil {
		log.Printf("Cal.com booking detail error: %v", err)
		jsonError(w, "failed to fetch booking", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}

// handleCalcomSlots proxies to GET /v2/slots.
// Note: slots endpoint uses a different API version (2024-09-04).
func (s *Server) handleCalcomSlots(w http.ResponseWriter, r *http.Request) {
	body, statusCode, err := s.calcomRequest(r.Context(), "GET", "/slots", r.URL.Query(), "2024-09-04")
	if err != nil {
		log.Printf("Cal.com slots error: %v", err)
		jsonError(w, "failed to fetch slots", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	w.Write(body)
}
