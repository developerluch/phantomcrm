package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVoiceTTSRequiresAuth(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", nil)
	response := httptest.NewRecorder()
	(&Server{}).handleVoiceTTS(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestVoiceTTSIsDisabledWithoutServerKey(t *testing.T) {
	t.Setenv("ELEVENLABS_API_KEY", "")
	request := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", nil)
	request = request.WithContext(context.WithValue(request.Context(), authUserKey, &AuthUser{UserID: "user-1"}))
	response := httptest.NewRecorder()
	(&Server{}).handleVoiceTTS(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d body=%s", response.Code, response.Body.String())
	}
}
