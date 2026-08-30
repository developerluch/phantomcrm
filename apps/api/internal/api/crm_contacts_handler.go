package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
	"github.com/developerluch/phantomcrm/apps/api/internal/repo"
)

const (
	maxRequestBody = 1 << 20 // 1 MiB cap on every CRM request body
)

// ── List ────────────────────────────────────────────────────────────────

// handleCRMListContacts serves GET /api/v1/crm/contacts.
//
// Filter source: either ?filter=<base64 JSON FilterNode> OR
// ?smartList=<id>. smartList takes priority when both are set. Unfiltered
// lists return every visible contact (page-bounded).
//
// Response: {contacts: [...], total, nextCursor?}.
func (s *Server) handleCRMListContacts(w http.ResponseWriter, r *http.Request) {
	scope := buildActorScope(r)
	q := r.URL.Query()

	var filter filters.FilterNode
	if slID := q.Get("smartList"); slID != "" {
		sl, err := s.smartListRepo.Get(r.Context(), slID, scope)
		if err != nil {
			crmWriteErr(w, err, "smart list")
			return
		}
		if err := filterJSONGuard(sl.FilterJSON); err != nil {
			crmWriteErr(w, err, "smart list filter")
			return
		}
		node, err := parseFilterNode(sl.FilterJSON)
		if err != nil {
			crmWriteErr(w, err, "smart list filter")
			return
		}
		filter = node
	} else if b64 := q.Get("filter"); b64 != "" {
		raw, err := decodeBase64Filter(b64)
		if err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := filterJSONGuard(raw); err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		node, err := parseFilterNode(raw)
		if err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		filter = node
	}

	sortFields, err := parseSortParam(q.Get("sort"))
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	page, err := s.contactRepo.List(r.Context(), repo.ListQuery{
		Filter: filter,
		Sort:   sortFields,
		Cursor: q.Get("cursor"),
		Limit:  limit,
		Scope:  scope,
	})
	if err != nil {
		crmWriteErr(w, err, "list contacts")
		return
	}
	resp := map[string]any{
		"contacts": page.Items,
		"total":    len(page.Items),
	}
	if page.NextCursor != "" {
		resp["nextCursor"] = page.NextCursor
	}
	jsonOK(w, resp)
}

// parseSortParam accepts "field:asc,field2:desc". Unknown fields are
// rejected inside the repo's sort whitelist — this helper only splits.
func parseSortParam(raw string) ([]repo.SortField, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	out := make([]repo.SortField, 0, len(parts))
	for _, p := range parts {
		segs := strings.SplitN(strings.TrimSpace(p), ":", 2)
		f := repo.SortField{Field: strings.TrimSpace(segs[0])}
		if len(segs) == 2 {
			f.Dir = strings.TrimSpace(segs[1])
		}
		if f.Field == "" {
			return nil, errors.New("sort: empty field")
		}
		out = append(out, f)
	}
	return out, nil
}

// ── Detail ──────────────────────────────────────────────────────────────

// ContactDetail bundles the contact row with its addresses for the drawer.
// Subtype profile (linked recruit / sale / agent_lead fields) is served by
// a dedicated endpoint in a later slice.
type ContactDetail struct {
	repo.Contact
	Addresses []repo.Address `json:"addresses"`
}

// handleCRMGetContact serves GET /api/v1/crm/contacts/{id}.
func (s *Server) handleCRMGetContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	scope := buildActorScope(r)
	c, err := s.contactRepo.Get(r.Context(), id, scope)
	if err != nil {
		crmWriteErr(w, err, "contact")
		return
	}
	addrs, err := repo.ListAddressesForContact(r.Context(), s.db.Pool(), c.ID)
	if err != nil {
		log.Printf("crm: list addresses %s: %v", c.ID, err)
		addrs = []repo.Address{}
	}
	jsonOK(w, ContactDetail{Contact: c, Addresses: addrs})
}

// ── Create ──────────────────────────────────────────────────────────────

// handleCRMCreateContact serves POST /api/v1/crm/contacts.
func (s *Server) handleCRMCreateContact(w http.ResponseWriter, r *http.Request) {
	var body repo.Contact
	if err := decodeJSONBody(r, &body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Caller cannot invent ownership if not admin — default to self.
	scope := buildActorScope(r)
	if body.OwnerAgentDiscordID == nil || *body.OwnerAgentDiscordID == "" {
		if scope.ActorDiscordID != "" {
			id := scope.ActorDiscordID
			body.OwnerAgentDiscordID = &id
		}
	} else if !scope.IsAdmin && *body.OwnerAgentDiscordID != scope.ActorDiscordID {
		jsonError(w, "ownerAgentDiscordId: only admins can create for another agent", http.StatusForbidden)
		return
	}
	created, err := s.contactRepo.Create(r.Context(), body)
	if err != nil {
		crmWriteErr(w, err, "create contact")
		return
	}
	w.Header().Set("Location", "/api/v1/crm/contacts/"+created.ID)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, created)
}

// ── Update ──────────────────────────────────────────────────────────────

// handleCRMUpdateContact serves PATCH /api/v1/crm/contacts/{id}.
func (s *Server) handleCRMUpdateContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var patch map[string]any
	if err := decodeJSONBody(r, &patch); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := s.contactRepo.Update(r.Context(), id, patch, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "update contact")
		return
	}
	jsonOK(w, updated)
}

// ── Archive / Restore ───────────────────────────────────────────────────

// handleCRMArchiveContact serves POST /api/v1/crm/contacts/{id}/archive.
func (s *Server) handleCRMArchiveContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	n, err := s.contactRepo.Archive(r.Context(), []string{id}, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "archive contact")
		return
	}
	if n == 0 {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleCRMRestoreContact serves POST /api/v1/crm/contacts/{id}/restore.
// The handler itself does not gate admin — the route does via requirePermission.
func (s *Server) handleCRMRestoreContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	n, err := s.contactRepo.Restore(r.Context(), []string{id}, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "restore contact")
		return
	}
	if n == 0 {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Tags ────────────────────────────────────────────────────────────────

type tagBody struct {
	Tag string `json:"tag"`
}

// handleCRMAddTag serves POST /api/v1/crm/contacts/{id}/tags.
func (s *Server) handleCRMAddTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body tagBody
	if err := decodeJSONBody(r, &body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	err := s.tagRepo.AddTag(r.Context(), id, body.Tag, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "add tag")
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// handleCRMRemoveTag serves DELETE /api/v1/crm/contacts/{id}/tags/{tag}.
func (s *Server) handleCRMRemoveTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tag := r.PathValue("tag")
	err := s.tagRepo.RemoveTag(r.Context(), id, tag, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "remove tag")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Bulk ────────────────────────────────────────────────────────────────

type bulkBody struct {
	Filter  json.RawMessage `json:"filter"`
	Action  string          `json:"action"`
	Payload map[string]any  `json:"payload"`
}

// handleCRMBulkContacts serves POST /api/v1/crm/contacts/bulk. All bulk
// mutations (set lifecycle/owner/DNC, archive/restore, add/remove tag) go
// through here; action kind is in the body.
func (s *Server) handleCRMBulkContacts(w http.ResponseWriter, r *http.Request) {
	var body bulkBody
	if err := decodeJSONBody(r, &body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := filterJSONGuard(body.Filter); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	filter, err := parseFilterNode(body.Filter)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	n, err := s.contactRepo.Bulk(r.Context(), repo.BulkRequest{
		Action:  repo.BulkActionKind(body.Action),
		Filter:  filter,
		Payload: body.Payload,
		Scope:   buildActorScope(r),
	})
	if err != nil {
		crmWriteErr(w, err, "bulk contacts")
		return
	}
	jsonOK(w, map[string]int{"affected": n})
}

// ── Shared helpers ──────────────────────────────────────────────────────

// decodeJSONBody reads ≤ maxRequestBody, rejects unknown keys, and decodes
// into dst. Empty body returns io.EOF (mapped to "invalid body" by caller).
func decodeJSONBody(r *http.Request, dst any) error {
	if r.Body == nil {
		return errors.New("invalid body: empty")
	}
	r.Body = http.MaxBytesReader(nil, r.Body, maxRequestBody)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("invalid body: empty")
		}
		return crmMapDecodeErr(err)
	}
	return nil
}

func crmMapDecodeErr(err error) error {
	msg := err.Error()
	if strings.Contains(msg, "http: request body too large") {
		return errors.New("request body too large")
	}
	return errors.New("invalid body: " + msg)
}

// crmWriteErr maps repo + filter sentinels to HTTP status codes and writes
// the response. Any other error is logged and reported as 500 — internals
// are NEVER echoed to the client.
func crmWriteErr(w http.ResponseWriter, err error, what string) {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		jsonError(w, "not found", http.StatusNotFound)
	case errors.Is(err, repo.ErrScoped):
		jsonError(w, "forbidden", http.StatusForbidden)
	case errors.Is(err, repo.ErrInvalidPayload):
		jsonError(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, repo.ErrTooManyAffected):
		jsonError(w, "bulk exceeds 500 rows", http.StatusRequestEntityTooLarge)
	case strings.Contains(err.Error(), "unknown field"):
		jsonError(w, err.Error(), http.StatusUnprocessableEntity)
	case strings.Contains(err.Error(), "not allowed on field"):
		jsonError(w, err.Error(), http.StatusUnprocessableEntity)
	case errors.Is(err, errFilterTooDeep), errors.Is(err, errFilterTooWide),
		errors.Is(err, errFilterMalformed), errors.Is(err, errUnknownFilterKey):
		jsonError(w, err.Error(), http.StatusBadRequest)
	default:
		log.Printf("crm %s: %v", what, err)
		jsonError(w, "internal error", http.StatusInternalServerError)
	}
}

// Compile-time guard to keep the context import used when future handlers
// may call into cancellation-aware helpers.
var _ = context.Background
