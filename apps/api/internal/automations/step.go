// Package automations defines the AutomationStep contract. Shipped as a
// LOCKED INTERFACE STUB by M1 so M5 (automations runner) has a stable shape
// to implement against.
//
// NO concrete step executors and NO runner live in M1.
package automations

import (
	"context"
	"encoding/json"
	"time"
)

// StepKind identifies a step's type, e.g. "send_sms", "wait", "add_tag".
type StepKind string

// StepResult is the outcome of one step execution.
type StepResult struct {
	// NextStepID is the workflow's next step, or nil to follow the default
	// outgoing edge.
	NextStepID *string

	// WaitUntil, if non-nil, suspends the run until that time.
	WaitUntil *time.Time

	// Status is one of "completed" | "waiting" | "failed" | "skipped".
	Status string

	// Events is the list of events this step produced to be published by the
	// runner after a successful commit.
	Events []any // events.Event — kept as any here to avoid a package import cycle
}

// AutomationRun is the per-run state object. Full shape fleshed out in M5.
type AutomationRun struct {
	ID         string
	ContactID  string
	WorkflowID string
	State      json.RawMessage
}

// Step is one node in a workflow. Full shape fleshed out in M5.
type Step struct {
	ID     string
	Kind   StepKind
	Config json.RawMessage
}

// AutomationStep is the plug-in interface every step type implements in M5.
type AutomationStep interface {
	Kind() StepKind
	Validate(config json.RawMessage) error
	Execute(ctx context.Context, run *AutomationRun, step *Step) (StepResult, error)
}
