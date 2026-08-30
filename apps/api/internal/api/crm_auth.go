package api

import (
	"net/http"

	"github.com/developerluch/phantomcrm/apps/api/internal/repo"
)

// isCRMAdmin reports whether the authed user has unrestricted CRM access —
// wildcard "*" in their permissions, or the specific "crm.admin" permission.
// Unauthenticated users are never admins.
func isCRMAdmin(au *AuthUser) bool {
	if au == nil {
		return false
	}
	for _, p := range au.Permissions {
		if p == "*" || p == "crm.admin" {
			return true
		}
	}
	return false
}

// buildActorScope extracts a repo.ActorScope from the request context. The
// scope drives every visibility predicate in the repo layer — handlers never
// construct their own WHERE clauses.
//
// An unauthenticated request returns a zero-value ActorScope (empty discord
// id, not admin), which the repo layer treats as "sees nothing visible."
// CRM routes are always wrapped in authMiddleware so this path shouldn't
// fire in practice, but the zero-value keeps the contract safe.
func buildActorScope(r *http.Request) repo.ActorScope {
	au := GetAuthUser(r)
	if au == nil {
		return repo.ActorScope{}
	}
	return repo.ActorScope{
		ActorDiscordID: au.DiscordID,
		IsAdmin:        isCRMAdmin(au),
	}
}
