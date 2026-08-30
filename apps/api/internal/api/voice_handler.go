package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultElevenLabsVoiceID = "EXAVITQu4vr4xnSDxMaL"

func (s *Server) handleVoiceTTS(w http.ResponseWriter, r *http.Request) {
	if GetAuthUser(r) == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	apiKey := os.Getenv("ELEVENLABS_API_KEY")
	if apiKey == "" {
		jsonError(w, "voice synthesis not configured", http.StatusServiceUnavailable)
		return
	}

	var input struct {
		Text string `json:"text"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	if err := decoder.Decode(&input); err != nil || strings.TrimSpace(input.Text) == "" {
		jsonError(w, "text required", http.StatusBadRequest)
		return
	}
	if len(input.Text) > 5000 {
		jsonError(w, "text too long", http.StatusBadRequest)
		return
	}

	voiceID := os.Getenv("ELEVENLABS_VOICE_ID")
	if voiceID == "" {
		voiceID = defaultElevenLabsVoiceID
	}
	modelID := os.Getenv("ELEVENLABS_MODEL_ID")
	if modelID == "" {
		modelID = "eleven_turbo_v2"
	}

	payload, err := json.Marshal(map[string]string{"text": input.Text, "model_id": modelID})
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	endpoint := "https://api.elevenlabs.io/v1/text-to-speech/" + url.PathEscape(voiceID)
	upstream, err := http.NewRequestWithContext(r.Context(), http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	upstream.Header.Set("xi-api-key", apiKey)
	upstream.Header.Set("Content-Type", "application/json")
	upstream.Header.Set("Accept", "audio/mpeg")

	client := &http.Client{Timeout: 30 * time.Second}
	response, err := client.Do(upstream)
	if err != nil {
		log.Printf("voice: upstream request failed: %v", err)
		jsonError(w, "voice synthesis failed", http.StatusBadGateway)
		return
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		log.Printf("voice: upstream returned status %d", response.StatusCode)
		jsonError(w, "voice synthesis failed", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Cache-Control", "no-store")
	if _, err := io.Copy(w, response.Body); err != nil {
		log.Printf("voice: response stream failed: %v", err)
	}
}
