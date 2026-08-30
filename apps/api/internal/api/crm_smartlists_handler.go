package api

import (
	"encoding/json"
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/repo"
)

// ── List ────────────────────────────────────────────────────────────────

// handleCRMListSmartLists serves GET /api/v1/crm/smartlists. Returns every
// smart list visible to scope (owner + shared).
func (s *Server) handleCRMListSmartLists(w http.ResponseWriter, r *http.Request) {
	lists, err := s.smartListRepo.List(r.Context(), buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "list smart lists")
		return
	}
	jsonOK(w, map[string]any{
		"smartlists": lists,
		"total":      len(lists),
	})
}

// ── Detail ──────────────────────────────────────────────────────────────

// handleCRMGetSmartList serves GET /api/v1/crm/smartlists/{id}.
func (s *Server) handleCRMGetSmartList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sl, err := s.smartListRepo.Get(r.Context(), id, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "get smart list")
		return
	}
	jsonOK(w, sl)
}

// ── Create ──────────────────────────────────────────────────────────────

type smartListCreateBody struct {
	Name               string          `json:"name"`
	Description        *string         `json:"description,omitempty"`
	SharedWithAgentIDs []string        `json:"sharedWithAgentIds,omitempty"`
	Filter             json.RawMessage `json:"filter"`
	IsPinned           bool            `json:"isPinned,omitempty"`
}

// handleCRMCreateSmartList serves POST /api/v1/crm/smartlists. Owner is
// forced to the caller; the payload can't spoof it.
func (s *Server) handleCRMCreateSmartList(w http.ResponseWriter, r *http.Request) {
	var body smartListCreateBody
	if err := decodeJSONBody(r, &body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(body.Filter) > maxSmartListFilter {
		jsonError(w, "filter exceeds 32 KiB cap", http.StatusRequestEntityTooLarge)
		return
	}
	if err := filterJSONGuard(body.Filter); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	created, err := s.smartListRepo.Create(r.Context(), repo.SmartList{
		Name:               body.Name,
		Description:        body.Description,
		SharedWithAgentIDs: body.SharedWithAgentIDs,
		FilterJSON:         body.Filter,
		IsPinned:           body.IsPinned,
	}, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "create smart list")
		return
	}
	w.Header().Set("Location", "/api/v1/crm/smartlists/"+created.ID)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, created)
}

// ── Update ──────────────────────────────────────────────────────────────

// handleCRMUpdateSmartList serves PATCH /api/v1/crm/smartlists/{id}.
func (s *Server) handleCRMUpdateSmartList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var patch map[string]any
	if err := decodeJSONBody(r, &patch); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Re-guard filter if the patch touches it. The repo validates JSON shape
	// again on write, but catching depth/width here saves a round trip.
	if raw, ok := patch["filter"]; ok {
		bytes, err := encodeToBytes(raw)
		if err != nil {
			jsonError(w, "filter: "+err.Error(), http.StatusBadRequest)
			return
		}
		if len(bytes) > maxSmartListFilter {
			jsonError(w, "filter exceeds 32 KiB cap", http.StatusRequestEntityTooLarge)
			return
		}
		if err := filterJSONGuard(bytes); err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		patch["filter"] = bytes
	}
	updated, err := s.smartListRepo.Update(r.Context(), id, patch, buildActorScope(r))
	if err != nil {
		crmWriteErr(w, err, "update smart list")
		return
	}
	jsonOK(w, updated)
}

// ── Delete ──────────────────────────────────────────────────────────────

// handleCRMDeleteSmartList serves DELETE /api/v1/crm/smartlists/{id}.
func (s *Server) handleCRMDeleteSmartList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.smartListRepo.Delete(r.Context(), id, buildActorScope(r)); err != nil {
		crmWriteErr(w, err, "delete smart list")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Pin ─────────────────────────────────────────────────────────────────

type pinBody struct {
	Pinned bool `json:"pinned"`
}

// handleCRMPinSmartList serves POST /api/v1/crm/smartlists/{id}/pin.
func (s *Server) handleCRMPinSmartList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body pinBody
	if err := decodeJSONBody(r, &body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.smartListRepo.SetPinned(r.Context(), id, body.Pinned, buildActorScope(r)); err != nil {
		crmWriteErr(w, err, "pin smart list")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Execute ─────────────────────────────────────────────────────────────

// handleCRMExecuteSmartList serves POST /api/v1/crm/smartlists/{id}/execute.
// Loads the saved filter, runs it through the contacts list, returns the
// same shape as GET /crm/contacts.
func (s *Server) handleCRMExecuteSmartList(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	scope := buildActorScope(r)

	sl, err := s.smartListRepo.Get(r.Context(), id, scope)
	if err != nil {
		crmWriteErr(w, err, "execute smart list")
		return
	}
	if err := filterJSONGuard(sl.FilterJSON); err != nil {
		crmWriteErr(w, err, "execute smart list filter")
		return
	}
	filter, err := parseFilterNode(sl.FilterJSON)
	if err != nil {
		crmWriteErr(w, err, "execute smart list filter")
		return
	}

	page, err := s.contactRepo.List(r.Context(), repo.ListQuery{
		Filter: filter,
		Scope:  scope,
	})
	if err != nil {
		crmWriteErr(w, err, "execute smart list")
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

// ── Helpers ─────────────────────────────────────────────────────────────

// encodeToBytes converts any marshalable value to its canonical JSON bytes.
// Used by PATCH handlers that receive filter payloads as generic interface{}.
func encodeToBytes(v any) ([]byte, error) {
	return json.Marshal(v)
}
