package api

import "testing"

func TestNormalizeSalesCSVRowDefaultsAgentIDAndCoercesFields(t *testing.T) {
	row, confidence := normalizeSalesCSVRow(map[string]string{
		"Client Name":    " Luciano Cutaj ",
		"Policy Type":    "Final Expense",
		"Carrier":        "Mutual of Omaha",
		"Annual Premium": "$1,200.50",
		"Policy #":       "ABC123",
	}, "AGT-TEST1234")

	if row.AgentID != "AGT-TEST1234" {
		t.Fatalf("AgentID = %q, want default", row.AgentID)
	}
	if row.ClientName != "Luciano Cutaj" {
		t.Fatalf("ClientName = %q", row.ClientName)
	}
	if row.PolicyType != "final_expense" {
		t.Fatalf("PolicyType = %q", row.PolicyType)
	}
	if row.Premium == nil || *row.Premium != 1200.50 {
		t.Fatalf("Premium = %v, want 1200.50", row.Premium)
	}
	if row.PolicyNumber == nil || *row.PolicyNumber != "ABC123" {
		t.Fatalf("PolicyNumber = %v, want ABC123", row.PolicyNumber)
	}
	if confidence["agentId"] == 0 {
		t.Fatalf("expected defaulted agentId confidence")
	}
}

func TestNormalizeSalesTextExtractsCommonFields(t *testing.T) {
	row, confidence := normalizeSalesText(`
Client: Jane Doe
Carrier: Aetna
Policy Type: Medicare Advantage
Premium: $89.99
Phone: (904) 555-1212
Email: jane@example.com
`, "AGT-TEST1234")

	if row.AgentID != "AGT-TEST1234" {
		t.Fatalf("AgentID = %q, want default", row.AgentID)
	}
	if row.ClientName != "Jane Doe" {
		t.Fatalf("ClientName = %q", row.ClientName)
	}
	if row.PolicyType != "medicare" {
		t.Fatalf("PolicyType = %q", row.PolicyType)
	}
	if row.Premium == nil || *row.Premium != 89.99 {
		t.Fatalf("Premium = %v, want 89.99", row.Premium)
	}
	if row.ClientPhone == nil || *row.ClientPhone != "(904) 555-1212" {
		t.Fatalf("ClientPhone = %v", row.ClientPhone)
	}
	if row.ClientEmail == nil || *row.ClientEmail != "jane@example.com" {
		t.Fatalf("ClientEmail = %v", row.ClientEmail)
	}
	if confidence["premium"] == 0 {
		t.Fatalf("expected premium confidence")
	}
}
