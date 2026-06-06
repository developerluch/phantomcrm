package db

import (
	"regexp"
	"testing"
)

func TestGenerateAgentIDFormatAndUniqueness(t *testing.T) {
	pattern := regexp.MustCompile(`^AGT-[A-Z0-9]{8}$`)
	seen := map[string]bool{}

	for i := 0; i < 1000; i++ {
		agentID, err := GenerateAgentID()
		if err != nil {
			t.Fatalf("GenerateAgentID returned error: %v", err)
		}
		if !pattern.MatchString(agentID) {
			t.Fatalf("GenerateAgentID returned %q, want AGT-XXXXXXXX", agentID)
		}
		if seen[agentID] {
			t.Fatalf("GenerateAgentID returned duplicate %q", agentID)
		}
		seen[agentID] = true
	}
}
