package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWSTicketIssueAndRedeemOnce(t *testing.T) {
	store := newWSTicketStore()
	ticket, err := store.Issue(AuthUser{UserID: "user-1", OrgID: "org-1"})
	if err != nil {
		t.Fatal(err)
	}

	user, ok := store.Redeem(ticket)
	if !ok || user.UserID != "user-1" || user.OrgID != "org-1" {
		t.Fatalf("unexpected first redemption: ok=%v user=%+v", ok, user)
	}
	if _, ok := store.Redeem(ticket); ok {
		t.Fatal("ticket redeemed more than once")
	}
}

func TestWSTicketRejectsExpiredValue(t *testing.T) {
	store := newWSTicketStore()
	ticket, err := store.Issue(AuthUser{UserID: "user-1"})
	if err != nil {
		t.Fatal(err)
	}

	store.mu.Lock()
	entry := store.tickets[ticket]
	entry.expiresAt = time.Now().Add(-time.Second)
	store.tickets[ticket] = entry
	store.mu.Unlock()

	if _, ok := store.Redeem(ticket); ok {
		t.Fatal("expired ticket redeemed")
	}
}

func TestCreateWSTicketRequiresAuthAndReturnsTicket(t *testing.T) {
	server := &Server{wsTickets: newWSTicketStore()}

	unauthenticated := httptest.NewRecorder()
	server.handleCreateWSTicket(unauthenticated, httptest.NewRequest(http.MethodPost, "/api/v1/ws/ticket", nil))
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d", unauthenticated.Code)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/v1/ws/ticket", nil)
	request = request.WithContext(context.WithValue(request.Context(), authUserKey, &AuthUser{UserID: "user-1"}))
	response := httptest.NewRecorder()
	server.handleCreateWSTicket(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("authenticated status = %d body=%s", response.Code, response.Body.String())
	}

	var body struct {
		Ticket string `json:"ticket"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Ticket == "" {
		t.Fatalf("invalid response: err=%v body=%s", err, response.Body.String())
	}
}
