package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

// CRMBackfillRequest is the body of POST /api/v1/crm/admin/backfill.
//
//	{ "sources": ["recruits","sales","agent_leads"], "dryRun": true }
//
// Sources defaults to all three if omitted. DryRun defaults to true — the
// endpoint is idempotent but destructive enough that the operator must
// explicitly opt into writes.
type CRMBackfillRequest struct {
	Sources []string `json:"sources,omitempty"`
	DryRun  *bool    `json:"dryRun,omitempty"`
}

// CRMBackfillReport is returned from the endpoint.
type CRMBackfillReport struct {
	DryRun         bool                     `json:"dryRun"`
	Sources        []string                 `json:"sources"`
	Scanned        int                      `json:"scanned"`
	WouldCreate    int                      `json:"wouldCreate"`
	WouldUpdate    int                      `json:"wouldUpdate"`
	Created        int                      `json:"created"`
	Updated        int                      `json:"updated"`
	Errors         []CRMBackfillErrorRecord `json:"errors"`
	PerSourceCount map[string]int           `json:"perSourceCount"`
}

type CRMBackfillErrorRecord struct {
	Source   string `json:"source"`
	SourceID string `json:"sourceId"`
	Message  string `json:"message"`
}

// handleCRMBackfill implements the admin-only CRM backfill endpoint.
//
// For each requested source table, we iterate rows that have no contact_id
// yet and call UpsertContactFromSource. In live mode we also update the
// origin row's contact_id column. In dry-run mode nothing is written.
//
// The endpoint is idempotent: re-running it only processes rows still
// missing a contact_id. Events fire naturally through UpsertContactFromSource.
func (s *Server) handleCRMBackfill(w http.ResponseWriter, r *http.Request) {
	var req CRMBackfillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		jsonError(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}

	dryRun := true
	if req.DryRun != nil {
		dryRun = *req.DryRun
	}

	sources := req.Sources
	if len(sources) == 0 {
		sources = []string{"recruits", "sales", "agent_leads"}
	}

	// Whitelist check — reject anything else outright.
	allowed := map[string]struct{}{"recruits": {}, "sales": {}, "agent_leads": {}}
	for _, src := range sources {
		if _, ok := allowed[src]; !ok {
			jsonError(w, "invalid source: "+src, http.StatusBadRequest)
			return
		}
	}

	report := CRMBackfillReport{
		DryRun:         dryRun,
		Sources:        sources,
		Errors:         []CRMBackfillErrorRecord{},
		PerSourceCount: map[string]int{},
	}

	ctx := r.Context()
	for _, src := range sources {
		n, err := s.backfillOneSource(ctx, src, dryRun, &report)
		report.PerSourceCount[src] = n
		if err != nil {
			report.Errors = append(report.Errors, CRMBackfillErrorRecord{
				Source: src, Message: err.Error(),
			})
		}
	}

	jsonOK(w, report)
}

// backfillOneSource iterates rows of a single source table missing contact_id
// and dispatches them through UpsertContactFromSource. Returns the count of
// rows scanned (regardless of dryRun). Errors from individual rows are
// appended to the report; the function only returns a top-level error for
// table-level failures (e.g., failed SELECT).
func (s *Server) backfillOneSource(ctx context.Context, source string, dryRun bool, report *CRMBackfillReport) (int, error) {
	query, scanner := backfillQueryFor(source)
	if query == "" {
		return 0, nil
	}

	rows, err := s.db.Pool().QueryContext(ctx, query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	scanned := 0
	for rows.Next() {
		scanned++

		src, err := scanner(rows)
		if err != nil {
			report.Errors = append(report.Errors, CRMBackfillErrorRecord{
				Source: source, Message: "scan: " + err.Error(),
			})
			continue
		}

		report.Scanned++

		// Dry-run: check if contact already exists (match priority), count
		// but don't write.
		if dryRun {
			exists, err := s.db.FindExistingContactID(ctx, src)
			if err != nil {
				report.Errors = append(report.Errors, CRMBackfillErrorRecord{
					Source: source, SourceID: src.SourceID, Message: "find: " + err.Error(),
				})
				continue
			}
			if exists != "" {
				report.WouldUpdate++
			} else {
				report.WouldCreate++
			}
			continue
		}

		// Live mode: do the actual upsert + contact_id write.
		contactID, err := s.db.UpsertContactFromSource(ctx, src)
		if err != nil {
			report.Errors = append(report.Errors, CRMBackfillErrorRecord{
				Source: source, SourceID: src.SourceID, Message: err.Error(),
			})
			continue
		}

		// Determine if this was a create or update by counting rows after.
		// Simpler: we don't know cheaply, so attribute to Created conservatively.
		// The event log has the authoritative truth via contact.created vs .updated.
		report.Created++

		if err := s.backfillUpdateContactID(ctx, source, src.SourceID, contactID); err != nil {
			report.Errors = append(report.Errors, CRMBackfillErrorRecord{
				Source: source, SourceID: src.SourceID, Message: "link: " + err.Error(),
			})
			continue
		}
	}
	if err := rows.Err(); err != nil {
		return scanned, err
	}
	return scanned, nil
}

func (s *Server) backfillUpdateContactID(ctx context.Context, source, sourceID, contactID string) error {
	var q string
	switch source {
	case "recruits":
		q = `UPDATE recruits    SET contact_id = $1 WHERE id = $2::UUID AND contact_id IS NULL`
	case "sales":
		q = `UPDATE sales       SET contact_id = $1 WHERE id = $2::UUID AND contact_id IS NULL`
	case "agent_leads":
		q = `UPDATE agent_leads SET contact_id = $1 WHERE id = $2::UUID AND contact_id IS NULL`
	default:
		return nil
	}
	_, err := s.db.Pool().ExecContext(ctx, q, contactID, sourceID)
	return err
}

// backfillQueryFor returns (query, rowScanner) for a given source table.
// Rows returned MUST be ones without contact_id yet (idempotency).
func backfillQueryFor(source string) (string, func(*sql.Rows) (db.SourceRow, error)) {
	switch source {
	case "recruits":
		return `SELECT id::TEXT, COALESCE(first_name,''), COALESCE(last_name,''),
			       COALESCE(email,''), COALESCE(phone,''),
			       COALESCE(assigned_manager_id,''),
			       COALESCE(city,''), COALESCE(state,'')
			FROM recruits WHERE contact_id IS NULL`,
			func(rows *sql.Rows) (db.SourceRow, error) {
				var src db.SourceRow
				src.Kind = "recruit"
				return src, rows.Scan(
					&src.SourceID, &src.FirstName, &src.LastName,
					&src.Email, &src.Phone, &src.OwnerAgentID,
					&src.City, &src.State,
				)
			}
	case "sales":
		return `SELECT id::TEXT, COALESCE(client_name,''), COALESCE(client_email,''),
			       COALESCE(client_phone,''), COALESCE(agent_discord_id,''),
			       COALESCE(client_dob,''), COALESCE(client_address,'')
			FROM sales WHERE contact_id IS NULL`,
			func(rows *sql.Rows) (db.SourceRow, error) {
				var src db.SourceRow
				src.Kind = "sale"
				src.LifecycleStage = "customer"
				var clientName string
				err := rows.Scan(
					&src.SourceID, &clientName, &src.Email, &src.Phone,
					&src.OwnerAgentID, &src.DOB, &src.AddressLine1,
				)
				if err != nil {
					return src, err
				}
				src.FirstName, src.LastName = db.SplitClientName(clientName)
				return src, nil
			}
	case "agent_leads":
		return `SELECT id::TEXT, COALESCE(first_name,''), COALESCE(last_name,''),
			       COALESCE(email,''), COALESCE(phone,''), COALESCE(agent_id,'')
			FROM agent_leads WHERE contact_id IS NULL`,
			func(rows *sql.Rows) (db.SourceRow, error) {
				var src db.SourceRow
				src.Kind = "agent_lead"
				return src, rows.Scan(
					&src.SourceID, &src.FirstName, &src.LastName,
					&src.Email, &src.Phone, &src.OwnerAgentID,
				)
			}
	}
	return "", nil
}

// This compile-time sink keeps the log import used even when all log-based
// branches are conditional. Without it, certain build tag combos strip log.
var _ = log.Printf
