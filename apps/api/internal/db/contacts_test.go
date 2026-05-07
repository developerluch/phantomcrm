package db

import "testing"

func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"", ""},
		{"5551234567", "5551234567"},
		{"(555) 123-4567", "5551234567"},
		{"+1 555 123 4567", "15551234567"},
		{"+1-555-123-4567 ext 42", "1555123456742"},
		{"abcdef", ""},
	}
	for _, c := range cases {
		if got := normalizePhone(c.in); got != c.want {
			t.Errorf("normalizePhone(%q) = %q; want %q", c.in, got, c.want)
		}
	}
}

func TestSplitClientName(t *testing.T) {
	cases := []struct {
		in, wantFirst, wantLast string
	}{
		{"", "", ""},
		{"  ", "", ""},
		{"Cher", "Cher", ""},
		{"John Smith", "John", "Smith"},
		{"John Q Smith", "John", "Q Smith"},
		{"   Maria   Del   Rio   ", "Maria", "Del Rio"},
	}
	for _, c := range cases {
		first, last := SplitClientName(c.in)
		if first != c.wantFirst || last != c.wantLast {
			t.Errorf("SplitClientName(%q) = (%q, %q); want (%q, %q)", c.in, first, last, c.wantFirst, c.wantLast)
		}
	}
}

func TestBuildFullName(t *testing.T) {
	cases := []struct {
		first, last, want string
	}{
		{"", "", ""},
		{"John", "", "John"},
		{"", "Smith", "Smith"},
		{"John", "Smith", "John Smith"},
		{"  John  ", "  Smith  ", "John Smith"}, // each part trimmed, joined with single space
	}
	for _, c := range cases {
		if got := buildFullName(c.first, c.last); got != c.want {
			t.Errorf("buildFullName(%q, %q) = %q; want %q", c.first, c.last, got, c.want)
		}
	}
}

func TestNullIfEmpty(t *testing.T) {
	if nullIfEmpty("") != nil {
		t.Errorf("nullIfEmpty(\"\") should be nil")
	}
	if got := nullIfEmpty("x"); got == nil || *got != "x" {
		t.Errorf("nullIfEmpty(\"x\") should be *\"x\"")
	}
}

func TestDerefOr(t *testing.T) {
	s := "value"
	if derefOr(nil, "fallback") != "fallback" {
		t.Errorf("derefOr(nil, fallback) should be fallback")
	}
	if derefOr(&s, "fallback") != "value" {
		t.Errorf("derefOr(&value, fallback) should be value")
	}
}

func TestHasAddress(t *testing.T) {
	cases := []struct {
		src  SourceRow
		want bool
	}{
		{SourceRow{}, false},
		{SourceRow{FirstName: "x"}, false},
		{SourceRow{AddressLine1: "1 Main St"}, true},
		{SourceRow{City: "Phoenix"}, true},
		{SourceRow{State: "AZ"}, true},
		{SourceRow{PostalCode: "85001"}, true},
		{SourceRow{AddressLine2: "Apt 3"}, true},
	}
	for i, c := range cases {
		if got := hasAddress(c.src); got != c.want {
			t.Errorf("case %d hasAddress() = %v; want %v", i, got, c.want)
		}
	}
}
