package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"

	"phantomcrm-api/internal/db"
	"phantomcrm-api/internal/sms"
)

// ParsedLead holds structured lead data extracted from free text.
type ParsedLead struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	City      string `json:"city"`
	State     string `json:"state"`
	Source    string `json:"source"`
	Notes     string `json:"notes"`
}

// handleAIImportParse parses free-text lead info using Claude AI.
// POST /api/v1/recruits/ai-import/parse
// Body: { "text": "John Doe 555-123-4567 Texas" }
// Response: { "parsed": {...}, "existing": null | Recruit }
func (s *Server) handleAIImportParse(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Text) == "" {
		http.Error(w, "text is required", http.StatusBadRequest)
		return
	}

	// Parse the text
	parsed, err := s.parseLeadText(r.Context(), req.Text)
	if err != nil {
		log.Printf("ai-import: parse error: %v", err)
		http.Error(w, "failed to parse lead text", http.StatusInternalServerError)
		return
	}

	// Normalize phone if present
	if parsed.Phone != "" {
		parsed.Phone = sms.NormalizePhone(parsed.Phone)
	}

	// Normalize email
	parsed.Email = strings.ToLower(strings.TrimSpace(parsed.Email))

	// Dedup check
	var existing *db.Recruit
	if parsed.Email != "" {
		existing, _ = s.db.FindRecruitByEmail(r.Context(), parsed.Email)
	}
	if existing == nil && parsed.Phone != "" {
		existing, _ = s.db.FindRecruitByPhone(r.Context(), parsed.Phone)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"parsed":   parsed,
		"existing": existing,
	})
}

// handleAIImportConfirm creates a recruit from AI-parsed data.
// POST /api/v1/recruits/ai-import/confirm
// Body: { "firstName": "...", "lastName": "...", "email": "...", "phone": "...", ... }
func (s *Server) handleAIImportConfirm(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		City      string `json:"city"`
		Source    string `json:"source"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.FirstName == "" || req.LastName == "" {
		http.Error(w, "firstName and lastName are required", http.StatusBadRequest)
		return
	}

	// Normalize
	if req.Phone != "" {
		req.Phone = sms.NormalizePhone(req.Phone)
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Final dedup check
	if req.Email != "" {
		if existing, _ := s.db.FindRecruitByEmail(r.Context(), req.Email); existing != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "existing",
				"recruit": existing,
			})
			return
		}
	}
	if req.Phone != "" {
		if existing, _ := s.db.FindRecruitByPhone(r.Context(), req.Phone); existing != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "existing",
				"recruit": existing,
			})
			return
		}
	}

	// Create recruit
	recruit := &db.Recruit{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Stage:     "NEW_LEAD",
	}
	if req.Phone != "" {
		recruit.Phone = &req.Phone
	}
	if req.City != "" {
		recruit.City = &req.City
	}
	source := "ai_import"
	if req.Source != "" {
		source = req.Source
	}
	recruit.Source = &source

	id, err := s.db.CreateRecruit(r.Context(), recruit)
	if err != nil {
		log.Printf("ai-import: create recruit: %v", err)
		http.Error(w, "failed to create recruit", http.StatusInternalServerError)
		return
	}

	created, _ := s.db.GetRecruit(r.Context(), id)
	if created != nil {
		go s.onRecruitStageChange(context.Background(), created, "", "NEW_LEAD")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "created",
		"recruit": created,
	})
}

// parseLeadText uses Claude API to extract structured data from free text, with regex fallback.
func (s *Server) parseLeadText(ctx context.Context, text string) (*ParsedLead, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		// Fallback to regex
		return parseLeadRegex(text), nil
	}

	systemPrompt := "You extract structured contact/lead data from raw text. Return ONLY valid JSON with no explanation or markdown. If a field cannot be determined, use an empty string."

	userMsg := `Extract lead information from this text. Return JSON with these exact fields:
{"firstName": "", "lastName": "", "phone": "", "email": "", "city": "", "state": "", "source": "", "notes": ""}

Text: "` + text + `"`

	messages := []any{
		map[string]string{"role": "user", "content": userMsg},
	}

	resp, err := s.callClaudeAPI(ctx, apiKey, systemPrompt, messages, nil)
	if err != nil {
		log.Printf("ai-import: Claude API error: %v, falling back to regex", err)
		return parseLeadRegex(text), nil
	}

	// Extract text content from response
	for _, block := range resp.Content {
		if block.Type == "text" && block.Text != "" {
			var parsed ParsedLead
			// Try to parse the response as JSON
			cleaned := strings.TrimSpace(block.Text)
			// Strip markdown code fences if present
			cleaned = strings.TrimPrefix(cleaned, "```json")
			cleaned = strings.TrimPrefix(cleaned, "```")
			cleaned = strings.TrimSuffix(cleaned, "```")
			cleaned = strings.TrimSpace(cleaned)

			if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
				log.Printf("ai-import: failed to parse Claude response as JSON: %v", err)
				return parseLeadRegex(text), nil
			}
			return &parsed, nil
		}
	}

	return parseLeadRegex(text), nil
}

// parseLeadRegex is a fallback parser using regex patterns.
func parseLeadRegex(text string) *ParsedLead {
	parsed := &ParsedLead{}

	// Extract phone: various US formats
	phoneRe := regexp.MustCompile(`(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})`)
	if match := phoneRe.FindStringSubmatch(text); len(match) > 0 {
		parsed.Phone = match[0]
	}

	// Extract email
	emailRe := regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
	if match := emailRe.FindString(text); match != "" {
		parsed.Email = match
	}

	// Extract name: first two capitalized words (crude heuristic)
	// Remove phone and email from text first
	cleanText := text
	if parsed.Phone != "" {
		cleanText = strings.Replace(cleanText, parsed.Phone, "", 1)
	}
	if parsed.Email != "" {
		cleanText = strings.Replace(cleanText, parsed.Email, "", 1)
	}

	nameRe := regexp.MustCompile(`\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b`)
	if match := nameRe.FindStringSubmatch(cleanText); len(match) >= 3 {
		parsed.FirstName = match[1]
		parsed.LastName = match[2]
	}

	// Extract state: two-letter codes
	stateRe := regexp.MustCompile(`\b([A-Z]{2})\b`)
	if match := stateRe.FindStringSubmatch(text); len(match) >= 2 {
		parsed.State = match[1]
	}

	return parsed
}
