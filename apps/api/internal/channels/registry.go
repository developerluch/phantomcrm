package channels

import (
	"fmt"
	"sync"
)

// Registry holds ChannelSender implementations indexed by (Channel, Provider).
// It is safe for concurrent use; senders are typically registered once at
// process startup and looked up by handlers per request.
type Registry struct {
	mu      sync.RWMutex
	senders map[Channel]map[string]ChannelSender
}

// NewRegistry returns an empty Registry.
func NewRegistry() *Registry {
	return &Registry{senders: make(map[Channel]map[string]ChannelSender)}
}

// Register stores s under (s.Name(), s.Provider()), overwriting any prior
// sender registered under the same key.
func (r *Registry) Register(s ChannelSender) {
	if r == nil || s == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	c := s.Name()
	if r.senders[c] == nil {
		r.senders[c] = make(map[string]ChannelSender)
	}
	r.senders[c][s.Provider()] = s
}

// For returns the sender registered for (channel, provider). Returns
// ErrUnsupported (wrapped) if none is registered.
func (r *Registry) For(channel Channel, provider string) (ChannelSender, error) {
	if r == nil {
		return nil, fmt.Errorf("%w: %s/%s", ErrUnsupported, channel, provider)
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if byProv, ok := r.senders[channel]; ok {
		if s, ok := byProv[provider]; ok {
			return s, nil
		}
	}
	return nil, fmt.Errorf("%w: %s/%s", ErrUnsupported, channel, provider)
}

// Providers returns the providers registered for the given channel.
// Order is unspecified.
func (r *Registry) Providers(channel Channel) []string {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	byProv := r.senders[channel]
	out := make([]string, 0, len(byProv))
	for p := range byProv {
		out = append(out, p)
	}
	return out
}
