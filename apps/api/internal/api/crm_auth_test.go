package api

import (
	"context"
	"net/http/httptest"
	"testing"
)

func TestIsCRMAdmin_NilUser(t *testing.T) {
	if isCRMAdmin(nil) {
		t.Fatal("nil AuthUser must not be admin")
	}
}

func TestIsCRMAdmin_Wildcard(t *testing.T) {
	au := &AuthUser{Permissions: []string{"*"}}
	if !isCRMAdmin(au) {
		t.Fatal("wildcard permission should grant admin")
	}
}

func TestIsCRMAdmin_CRMSpecific(t *testing.T) {
	au := &AuthUser{Permissions: []string{"unrelated.perm", "crm.admin", "other"}}
	if !isCRMAdmin(au) {
		t.Fatal("crm.admin permission should grant admin")
	}
}

func TestIsCRMAdmin_NoMatch(t *testing.T) {
	au := &AuthUser{Permissions: []string{"recruits.read", "sales.write"}}
	if isCRMAdmin(au) {
		t.Fatal("unrelated permissions should NOT grant admin")
	}
}

func TestIsCRMAdmin_EmptyPerms(t *testing.T) {
	au := &AuthUser{Permissions: nil}
	if isCRMAdmin(au) {
		t.Fatal("empty permissions should NOT grant admin")
	}
}

func TestBuildActorScope_NoAuth(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	scope := buildActorScope(req)
	if scope.ActorDiscordID != "" || scope.IsAdmin {
		t.Fatalf("unauthenticated request should produce zero scope, got %+v", scope)
	}
}

func TestBuildActorScope_AuthedAgent(t *testing.T) {
	au := &AuthUser{DiscordID: "123", Permissions: []string{"agents.read"}}
	req := httptest.NewRequest("GET", "/", nil)
	ctx := context.WithValue(req.Context(), authUserKey, au)
	scope := buildActorScope(req.WithContext(ctx))
	if scope.ActorDiscordID != "123" {
		t.Fatalf("expected ActorDiscordID=123, got %q", scope.ActorDiscordID)
	}
	if scope.IsAdmin {
		t.Fatal("non-admin user should not have IsAdmin=true")
	}
}

func TestBuildActorScope_AdminUser(t *testing.T) {
	au := &AuthUser{DiscordID: "boss", Permissions: []string{"*"}}
	req := httptest.NewRequest("GET", "/", nil)
	ctx := context.WithValue(req.Context(), authUserKey, au)
	scope := buildActorScope(req.WithContext(ctx))
	if !scope.IsAdmin || scope.ActorDiscordID != "boss" {
		t.Fatalf("expected admin scope for boss, got %+v", scope)
	}
}
