package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

// handleParseTranscript extracts policy and client information from a sales call transcript using Claude AI.
// POST /api/v1/portal/sales/parse-transcript
// Body: { "transcript": "..." }
// Response: { "clientName": "...", "policyType": "...", ... }
func (s *Server) handleParseTranscript(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Transcript string `json:"transcript"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Transcript) == "" {
		jsonError(w, "transcript is required", http.StatusBadRequest)
		return
	}

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		jsonError(w, "AI not configured", http.StatusServiceUnavailable)
		return
	}

	// Truncate to 15k chars to stay within token limits
	transcript := req.Transcript
	if len(transcript) > 15000 {
		transcript = transcript[:15000]
	}

	systemPrompt := `You are a data extraction assistant for an insurance CRM.
You will be given a sales call transcript. Extract all policy and client information you can find.

Return ONLY valid JSON with this exact structure (use null for fields you cannot find):
{
  "clientName": "string or null",
  "clientDOB": "YYYY-MM-DD or null",
  "clientAddress": "full address string or null",
  "clientPhone": "phone string or null",
  "clientEmail": "email string or null",
  "policyType": "life, health, auto, home, medicare, final_expense, annuity, or null",
  "carrier": "insurance company name or null",
  "premium": number or null,
  "faceAmount": number or null,
  "paymentMode": "monthly, annual, quarterly, semi-annual, or null",
  "policyNumber": "string or null",
  "commission": number or null,
  "notes": "brief summary of key points from the call, or null"
}

Rules:
- For premium and faceAmount, extract the numeric value only (no $ signs)
- For policyType, normalize to one of: life, health, auto, home, medicare, final_expense, annuity
- For DOB, convert to YYYY-MM-DD format
- For address, combine street, city, state, zip into one string
- If a field is mentioned but ambiguous, make your best guess and note it in the notes
- Return ONLY the JSON object, no markdown, no explanation`

	messages := []any{
		map[string]string{
			"role":    "user",
			"content": "Extract policy and client information from this sales call transcript:\n\n" + transcript,
		},
	}

	resp, err := s.callClaudeAPI(r.Context(), apiKey, systemPrompt, messages, nil)
	if err != nil {
		log.Printf("sales-ai: Claude API error: %v", err)
		jsonError(w, "AI processing failed", http.StatusInternalServerError)
		return
	}

	// Extract text content from response
	for _, block := range resp.Content {
		if block.Type == "text" && block.Text != "" {
			// Strip markdown code fences if present (same pattern as ai_import_handler.go)
			cleaned := strings.TrimSpace(block.Text)
			cleaned = strings.TrimPrefix(cleaned, "```json")
			cleaned = strings.TrimPrefix(cleaned, "```")
			cleaned = strings.TrimSuffix(cleaned, "```")
			cleaned = strings.TrimSpace(cleaned)

			var parsed map[string]interface{}
			if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
				log.Printf("sales-ai: failed to parse Claude response as JSON: %v", err)
				jsonError(w, "failed to parse AI response", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(parsed)
			return
		}
	}

	jsonError(w, "no response from AI", http.StatusInternalServerError)
}
