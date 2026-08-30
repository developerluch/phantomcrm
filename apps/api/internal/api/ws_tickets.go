package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

const wsTicketTTL = 30 * time.Second

type wsTicket struct {
	user      AuthUser
	expiresAt time.Time
}

type wsTicketStore struct {
	mu      sync.Mutex
	tickets map[string]wsTicket
}

func newWSTicketStore() *wsTicketStore {
	return &wsTicketStore{tickets: make(map[string]wsTicket)}
}

func (st *wsTicketStore) Issue(user AuthUser) (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	ticket := hex.EncodeToString(value)

	st.mu.Lock()
	defer st.mu.Unlock()

	now := time.Now()
	for key, entry := range st.tickets {
		if now.After(entry.expiresAt) {
			delete(st.tickets, key)
		}
	}
	st.tickets[ticket] = wsTicket{user: user, expiresAt: now.Add(wsTicketTTL)}

	return ticket, nil
}

func (st *wsTicketStore) Redeem(ticket string) (*AuthUser, bool) {
	if ticket == "" {
		return nil, false
	}

	st.mu.Lock()
	defer st.mu.Unlock()

	entry, ok := st.tickets[ticket]
	if !ok {
		return nil, false
	}
	delete(st.tickets, ticket)
	if time.Now().After(entry.expiresAt) {
		return nil, false
	}

	user := entry.user
	return &user, true
}

func (s *Server) handleCreateWSTicket(w http.ResponseWriter, r *http.Request) {
	user := GetAuthUser(r)
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ticket, err := s.wsTickets.Issue(*user)
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{
		"ticket":           ticket,
		"expiresInSeconds": int(wsTicketTTL.Seconds()),
	})
}
