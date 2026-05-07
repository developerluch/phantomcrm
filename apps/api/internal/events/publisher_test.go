package events

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

// fakeExecer captures ExecContext calls for assertion.
type fakeExecer struct {
	queries []fakeExec
	err     error
}

type fakeExec struct {
	query string
	args  []any
}

type fakeResult struct{}

func (fakeResult) LastInsertId() (int64, error) { return 0, nil }
func (fakeResult) RowsAffected() (int64, error) { return 1, nil }

var _ driver.Result = (*fakeResult)(nil)

func (f *fakeExecer) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	f.queries = append(f.queries, fakeExec{query: query, args: args})
	if f.err != nil {
		return nil, f.err
	}
	return fakeResult{}, nil
}

func TestPgPublisher_PublishesInsert(t *testing.T) {
	exec := &fakeExecer{}
	p := NewPgPublisher(exec)

	ctx := context.Background()
	contactID := "01H..."
	err := p.Publish(ctx, Event{
		Type:        TypeContactCreated,
		ContactID:   &contactID,
		SubjectType: "contact",
		SubjectID:   contactID,
		Payload:     map[string]any{"firstName": "John"},
	})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if len(exec.queries) != 1 {
		t.Fatalf("expected 1 query, got %d", len(exec.queries))
	}
	q := exec.queries[0].query
	if !strings.Contains(q, "INSERT INTO events") {
		t.Errorf("expected INSERT INTO events, got: %s", q)
	}

	// Args must be (type, occurred_at, actor, contactID, subjectType, subjectID, payloadJSON)
	args := exec.queries[0].args
	if len(args) != 7 {
		t.Fatalf("expected 7 args, got %d", len(args))
	}
	if args[0] != TypeContactCreated {
		t.Errorf("arg[0] type mismatch: %v", args[0])
	}
	if _, ok := args[1].(time.Time); !ok {
		t.Errorf("arg[1] occurred_at should be time.Time, got %T", args[1])
	}

	// Payload is the 7th arg as a JSON string.
	payloadJSON, ok := args[6].(string)
	if !ok {
		t.Fatalf("arg[6] payload should be string JSON, got %T", args[6])
	}
	var decoded map[string]any
	if err := json.Unmarshal([]byte(payloadJSON), &decoded); err != nil {
		t.Fatalf("payload is not valid JSON: %v", err)
	}
	if decoded["firstName"] != "John" {
		t.Errorf("payload firstName mismatch: %v", decoded["firstName"])
	}
}

func TestPgPublisher_RejectsEmptyType(t *testing.T) {
	p := NewPgPublisher(&fakeExecer{})
	err := p.Publish(context.Background(), Event{})
	if err == nil {
		t.Fatal("expected error for empty Type")
	}
}

func TestPgPublisher_DefaultsOccurredAt(t *testing.T) {
	exec := &fakeExecer{}
	p := NewPgPublisher(exec)
	before := time.Now()
	err := p.Publish(context.Background(), Event{
		Type:        TypeContactCreated,
		SubjectType: "contact",
		SubjectID:   "x",
	})
	if err != nil {
		t.Fatal(err)
	}
	after := time.Now()
	at, ok := exec.queries[0].args[1].(time.Time)
	if !ok {
		t.Fatal("occurredAt not time.Time")
	}
	if at.Before(before) || at.After(after.Add(time.Second)) {
		t.Errorf("occurredAt %v not in expected range [%v, %v]", at, before, after)
	}
}

func TestPgPublisher_NilPayloadBecomesEmptyObject(t *testing.T) {
	exec := &fakeExecer{}
	p := NewPgPublisher(exec)
	err := p.Publish(context.Background(), Event{
		Type:        TypeContactCreated,
		SubjectType: "contact",
		SubjectID:   "x",
		Payload:     nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	got := exec.queries[0].args[6].(string)
	if got != "{}" {
		t.Errorf("expected empty object, got %q", got)
	}
}

func TestPgPublisher_PropagatesExecError(t *testing.T) {
	exec := &fakeExecer{err: errors.New("db down")}
	p := NewPgPublisher(exec)
	err := p.Publish(context.Background(), Event{
		Type:        TypeContactCreated,
		SubjectType: "contact",
		SubjectID:   "x",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "db down") {
		t.Errorf("expected error to wrap 'db down', got: %v", err)
	}
}

func TestKnownTypes_NonEmpty(t *testing.T) {
	if len(KnownTypes) == 0 {
		t.Fatal("KnownTypes must contain at least the M0 events")
	}
	// Spot-check a few required entries.
	required := []string{
		TypeContactCreated,
		TypeContactTagged,
		TypeAddressCreated,
		TypeAddressPrimaryChanged,
	}
	for _, k := range required {
		if _, ok := KnownTypes[k]; !ok {
			t.Errorf("KnownTypes missing %q", k)
		}
	}
}
