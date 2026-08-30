package api

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // requests per window
	window   time.Duration // window duration
}

type visitor struct {
	count    int
	lastSeen time.Time
}

func newRateLimiter(rate int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}
	// Cleanup old entries every minute
	go func() {
		for {
			time.Sleep(time.Minute)
			rl.mu.Lock()
			for ip, v := range rl.visitors {
				if time.Since(v.lastSeen) > rl.window*2 {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}

	// Reset if window expired
	if time.Since(v.lastSeen) > rl.window {
		v.count = 1
		v.lastSeen = time.Now()
		return true
	}

	v.count++
	v.lastSeen = time.Now()
	return v.count <= rl.rate
}

// exemptPaths are paths that should never be rate-limited.
// Auth endpoints must always be reachable (login flow), and health
// checks are used by load balancers / uptime monitors.
var exemptPaths = []string{
	"/api/v1/auth/",
	"/api/v1/health",
	"/api/v1/ws",
	"/api/v1/recruits/apply",               // public website form
	"/api/v1/integrations/google/callback", // Google OAuth redirect (no JWT)
}

func isExempt(path string) bool {
	for _, prefix := range exemptPaths {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Never rate-limit exempt paths (auth, health, websocket, public forms)
		if isExempt(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		ip := r.RemoteAddr
		// Use X-Forwarded-For if behind proxy (Railway, etc.)
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			// X-Forwarded-For can be comma-separated; use first (client) IP
			if idx := strings.Index(xff, ","); idx != -1 {
				ip = strings.TrimSpace(xff[:idx])
			} else {
				ip = strings.TrimSpace(xff)
			}
		}

		if !rl.allow(ip) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}
