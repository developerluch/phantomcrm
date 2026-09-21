package api

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

const (
	accessTokenDuration  = 15 * time.Minute
	refreshTokenDuration = 7 * 24 * time.Hour
)

// --- Request / response types ---

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type discordAuthRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirectUri"`
}

type googleAuthRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirectUri"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type authResponse struct {
	AccessToken  string   `json:"accessToken"`
	RefreshToken string   `json:"refreshToken"`
	User         authUser `json:"user"`
}

type authUser struct {
	ID          string   `json:"id"`
	AgentID     string   `json:"agentId"`
	Email       string   `json:"email"`
	DiscordID   string   `json:"discordId"`
	DisplayName string   `json:"displayName"`
	AvatarURL   string   `json:"avatarUrl"`
	OrgID       string   `json:"orgId"`
	RoleID      string   `json:"roleId"`
	Permissions []string `json:"permissions"`
}

// --- Handlers ---

// handleLogin authenticates via email/password and returns JWT tokens.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		jsonError(w, "email and password required", http.StatusBadRequest)
		return
	}

	user, err := s.db.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("auth: login db error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if user == nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if !user.IsActive {
		jsonError(w, "account disabled", http.StatusForbidden)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	s.db.UpdateLastLogin(r.Context(), user.ID)
	s.issueTokens(w, r, user)
}

// handleRegister creates a new user and returns JWT tokens.
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		jsonError(w, "email and password required", http.StatusBadRequest)
		return
	}

	existing, err := s.db.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		log.Printf("auth: register db error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if existing != nil {
		jsonError(w, "email already registered", http.StatusConflict)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("auth: bcrypt error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Default to "agent" role
	agentRole, err := s.db.GetRoleByName(r.Context(), "agent")
	if err != nil || agentRole == nil {
		log.Printf("auth: failed to get agent role: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = strings.Split(req.Email, "@")[0]
	}

	newUser := db.User{
		ID:           generateUUID(),
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  displayName,
		RoleID:       agentRole.ID,
		IsActive:     true,
	}

	if err := s.db.CreateUser(r.Context(), newUser); err != nil {
		log.Printf("auth: create user error: %v", err)
		jsonError(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	created, err := s.db.GetUserByID(r.Context(), newUser.ID)
	if err != nil || created == nil {
		log.Printf("auth: refetch user error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	s.issueTokens(w, r, created)
}

// handleDiscordAuth exchanges a Discord OAuth2 code for JWT tokens.
func (s *Server) handleDiscordAuth(w http.ResponseWriter, r *http.Request) {
	if s.cfg.DiscordClientID == "" || s.cfg.DiscordClientSecret == "" {
		jsonError(w, "Discord sign-in is not configured on this server", http.StatusServiceUnavailable)
		return
	}
	var req discordAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Code == "" {
		jsonError(w, "code required", http.StatusBadRequest)
		return
	}

	// Exchange code for Discord access token
	tokenResp, err := s.exchangeDiscordCode(req.Code, req.RedirectURI)
	if err != nil {
		log.Printf("auth: discord token exchange error (redirectURI=%s, codeLen=%d): %v", req.RedirectURI, len(req.Code), err)
		jsonError(w, "discord authentication failed", http.StatusUnauthorized)
		return
	}

	// Fetch Discord user info
	discordUser, err := s.fetchDiscordUser(tokenResp.AccessToken)
	if err != nil {
		log.Printf("auth: discord user fetch error: %v", err)
		jsonError(w, "failed to fetch discord user", http.StatusInternalServerError)
		return
	}

	// Verify guild membership
	isMember, err := s.checkGuildMembership(discordUser.ID)
	if err != nil {
		log.Printf("auth: guild membership check error: %v", err)
		jsonError(w, "Unable to verify server membership. Please try again later.", http.StatusInternalServerError)
		return
	}
	if !isMember {
		jsonError(w, "You must join the VIPA Discord server to access this dashboard.", http.StatusForbidden)
		return
	}

	// Find or create user
	user, err := s.db.GetUserByDiscordID(r.Context(), discordUser.ID)
	if err != nil {
		log.Printf("auth: discord db error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	if user == nil {
		// Create new user from Discord profile
		agentRole, err := s.db.GetRoleByName(r.Context(), "agent")
		if err != nil || agentRole == nil {
			log.Printf("auth: failed to get agent role: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}

		displayName := discordUser.GlobalName
		if displayName == "" {
			displayName = discordUser.Username
		}

		var avatarURL string
		if discordUser.Avatar != "" {
			avatarURL = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", discordUser.ID, discordUser.Avatar)
		}

		newUser := db.User{
			ID:          generateUUID(),
			Email:       discordUser.Email,
			DiscordID:   discordUser.ID,
			DisplayName: displayName,
			AvatarURL:   avatarURL,
			RoleID:      agentRole.ID,
			IsActive:    true,
		}

		if err := s.db.CreateUser(r.Context(), newUser); err != nil {
			log.Printf("auth: create discord user error: %v", err)
			jsonError(w, "failed to create user", http.StatusInternalServerError)
			return
		}

		user, err = s.db.GetUserByID(r.Context(), newUser.ID)
		if err != nil || user == nil {
			log.Printf("auth: refetch discord user error: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
	} else {
		// Update existing user with latest Discord info
		displayName := discordUser.GlobalName
		if displayName == "" {
			displayName = discordUser.Username
		}
		var avatarURL string
		if discordUser.Avatar != "" {
			avatarURL = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", discordUser.ID, discordUser.Avatar)
		}

		updates := db.UserUpdate{
			DisplayName: &displayName,
			AvatarURL:   &avatarURL,
		}
		if discordUser.Email != "" {
			updates.Email = &discordUser.Email
		}
		_ = s.db.UpdateUser(r.Context(), user.ID, updates)
		// Re-fetch to get updated data
		user, _ = s.db.GetUserByID(r.Context(), user.ID)
	}

	if !user.IsActive {
		jsonError(w, "account disabled", http.StatusForbidden)
		return
	}

	s.db.UpdateLastLogin(r.Context(), user.ID)
	s.issueTokens(w, r, user)
}

// handleGoogleAuth exchanges a Google OAuth2 code for JWT tokens.
// Mirrors the Discord flow: code exchange → userinfo endpoint → find-or-create user → issueTokens.
// Links to an existing account (by email) when a user's first non-Google sign-in was Discord or email/password.
func (s *Server) handleGoogleAuth(w http.ResponseWriter, r *http.Request) {
	var req googleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Code == "" {
		jsonError(w, "code required", http.StatusBadRequest)
		return
	}

	tokenResp, err := s.exchangeGoogleCode(req.Code, req.RedirectURI)
	if err != nil {
		log.Printf("auth: google token exchange error (redirectURI=%s, codeLen=%d): %v", req.RedirectURI, len(req.Code), err)
		jsonError(w, "google authentication failed", http.StatusUnauthorized)
		return
	}

	googleUser, err := s.fetchGoogleUser(tokenResp.AccessToken)
	if err != nil {
		log.Printf("auth: google user fetch error: %v", err)
		jsonError(w, "failed to fetch google user", http.StatusInternalServerError)
		return
	}

	if !googleUser.EmailVerified {
		jsonError(w, "Google email is not verified.", http.StatusForbidden)
		return
	}
	if googleUser.Sub == "" || googleUser.Email == "" {
		jsonError(w, "google returned incomplete profile", http.StatusBadGateway)
		return
	}

	// 1) Match on google_id first
	user, err := s.db.GetUserByGoogleID(r.Context(), googleUser.Sub)
	if err != nil {
		log.Printf("auth: google db error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	// 2) Otherwise match on email and link
	if user == nil {
		existing, err := s.db.GetUserByEmail(r.Context(), googleUser.Email)
		if err != nil {
			log.Printf("auth: google email lookup error: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existing != nil {
			sub := googleUser.Sub
			updates := db.UserUpdate{GoogleID: &sub}
			if googleUser.Name != "" {
				name := googleUser.Name
				updates.DisplayName = &name
			}
			if googleUser.Picture != "" {
				avatar := googleUser.Picture
				updates.AvatarURL = &avatar
			}
			if err := s.db.UpdateUser(r.Context(), existing.ID, updates); err != nil {
				log.Printf("auth: google link user error: %v", err)
				jsonError(w, "failed to link account", http.StatusInternalServerError)
				return
			}
			user, _ = s.db.GetUserByID(r.Context(), existing.ID)
		}
	} else {
		// Refresh profile fields on existing google-linked user
		updates := db.UserUpdate{}
		if googleUser.Name != "" && googleUser.Name != user.DisplayName {
			name := googleUser.Name
			updates.DisplayName = &name
		}
		if googleUser.Picture != "" && googleUser.Picture != user.AvatarURL {
			avatar := googleUser.Picture
			updates.AvatarURL = &avatar
		}
		if updates.DisplayName != nil || updates.AvatarURL != nil {
			_ = s.db.UpdateUser(r.Context(), user.ID, updates)
			user, _ = s.db.GetUserByID(r.Context(), user.ID)
		}
	}

	// 3) Create a new user if neither google_id nor email matched
	if user == nil {
		agentRole, err := s.db.GetRoleByName(r.Context(), "agent")
		if err != nil || agentRole == nil {
			log.Printf("auth: failed to get agent role: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}

		displayName := googleUser.Name
		if displayName == "" {
			displayName = strings.Split(googleUser.Email, "@")[0]
		}

		newUser := db.User{
			ID:          generateUUID(),
			Email:       googleUser.Email,
			GoogleID:    googleUser.Sub,
			DisplayName: displayName,
			AvatarURL:   googleUser.Picture,
			RoleID:      agentRole.ID,
			IsActive:    true,
		}

		if err := s.db.CreateUser(r.Context(), newUser); err != nil {
			log.Printf("auth: create google user error: %v", err)
			jsonError(w, "failed to create user", http.StatusInternalServerError)
			return
		}

		user, err = s.db.GetUserByID(r.Context(), newUser.ID)
		if err != nil || user == nil {
			log.Printf("auth: refetch google user error: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	if !user.IsActive {
		jsonError(w, "account disabled", http.StatusForbidden)
		return
	}

	s.db.UpdateLastLogin(r.Context(), user.ID)
	s.issueTokens(w, r, user)
}

// handleRefresh exchanges a refresh token for a new access token.
func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.RefreshToken == "" {
		jsonError(w, "refreshToken required", http.StatusBadRequest)
		return
	}

	tokenHash := HashRefreshToken(req.RefreshToken)
	storedToken, err := s.db.GetRefreshTokenByHash(r.Context(), tokenHash)
	if err != nil {
		log.Printf("auth: refresh db error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if storedToken == nil {
		jsonError(w, "invalid refresh token", http.StatusUnauthorized)
		return
	}

	if time.Now().After(storedToken.ExpiresAt) {
		_ = s.db.DeleteRefreshToken(r.Context(), storedToken.ID)
		jsonError(w, "refresh token expired", http.StatusUnauthorized)
		return
	}

	user, err := s.db.GetUserByID(r.Context(), storedToken.UserID)
	if err != nil || user == nil {
		jsonError(w, "user not found", http.StatusUnauthorized)
		return
	}
	if !user.IsActive {
		jsonError(w, "account disabled", http.StatusForbidden)
		return
	}

	// Re-check guild membership on token refresh (Discord OAuth users only)
	if user.DiscordID != "" {
		isMember, err := s.checkGuildMembership(user.DiscordID)
		if err != nil {
			log.Printf("auth: refresh guild check error: %v", err)
			// Don't block on transient Discord API errors during refresh
		} else if !isMember {
			_ = s.db.DeleteRefreshToken(r.Context(), storedToken.ID)
			jsonError(w, "You are no longer a member of the VIPA Discord server.", http.StatusForbidden)
			return
		}
	}

	// Rotate: delete old refresh token, issue new pair
	_ = s.db.DeleteRefreshToken(r.Context(), storedToken.ID)
	s.issueTokens(w, r, user)
}

// handleLogout invalidates a refresh token.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.RefreshToken == "" {
		jsonError(w, "refreshToken required", http.StatusBadRequest)
		return
	}

	tokenHash := HashRefreshToken(req.RefreshToken)
	storedToken, err := s.db.GetRefreshTokenByHash(r.Context(), tokenHash)
	if err == nil && storedToken != nil {
		_ = s.db.DeleteRefreshToken(r.Context(), storedToken.ID)
	}

	jsonOK(w, map[string]string{"status": "ok"})
}

// handleMe returns the current authenticated user.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	au := GetAuthUser(r)
	if au == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := s.db.GetUserByID(r.Context(), au.UserID)
	if err != nil || user == nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}
	if user.AgentID == "" {
		agentID, err := s.db.EnsureUserAgentID(r.Context(), user.ID)
		if err != nil {
			log.Printf("auth: ensure agent id: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
		user.AgentID = agentID
	}

	role, _ := s.db.GetRoleByID(r.Context(), user.RoleID)
	var perms []string
	if role != nil {
		perms = role.Permissions
	}

	jsonOK(w, authUser{
		ID:          user.ID,
		AgentID:     user.AgentID,
		Email:       user.Email,
		DiscordID:   user.DiscordID,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		OrgID:       user.OrgID,
		RoleID:      user.RoleID,
		Permissions: perms,
	})
}

// handleUpdateMe updates the authenticated user's profile.
func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	au := GetAuthUser(r)
	if au == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		DisplayName *string `json:"displayName"`
		Email       *string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	updates := db.UserUpdate{}
	if req.DisplayName != nil {
		updates.DisplayName = req.DisplayName
	}
	if req.Email != nil {
		updates.Email = req.Email
	}

	if err := s.db.UpdateUser(r.Context(), au.UserID, updates); err != nil {
		log.Printf("updateMe: %v", err)
		jsonError(w, "failed to update profile", http.StatusInternalServerError)
		return
	}

	user, err := s.db.GetUserByID(r.Context(), au.UserID)
	if err != nil || user == nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}
	if user.AgentID == "" {
		agentID, err := s.db.EnsureUserAgentID(r.Context(), user.ID)
		if err != nil {
			log.Printf("auth: ensure agent id: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
		user.AgentID = agentID
	}

	role, _ := s.db.GetRoleByID(r.Context(), user.RoleID)
	var perms []string
	if role != nil {
		perms = role.Permissions
	}

	jsonOK(w, authUser{
		ID:          user.ID,
		AgentID:     user.AgentID,
		Email:       user.Email,
		DiscordID:   user.DiscordID,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		OrgID:       user.OrgID,
		RoleID:      user.RoleID,
		Permissions: perms,
	})
}

// verificationState is the unified GET/POST response shape for NPN verification.
type verificationState struct {
	NPNVerified   bool       `json:"npn_verified"`
	NPN           *string    `json:"npn"`
	CanonicalName *string    `json:"canonical_name"`
	VerifiedAt    *time.Time `json:"verified_at"`
}

// handleVerificationStatus returns the current user's NPN verification state.
func (s *Server) handleVerificationStatus(w http.ResponseWriter, r *http.Request) {
	au := GetAuthUser(r)
	if au == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	user, err := s.db.GetUserByID(r.Context(), au.UserID)
	if err != nil || user == nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}
	jsonOK(w, verificationState{
		NPNVerified:   user.NPNVerifiedAt != nil,
		NPN:           user.NPN,
		CanonicalName: user.CanonicalName,
		VerifiedAt:    user.NPNVerifiedAt,
	})
}

// handleVerifyNpn persists the NIPR-extracted NPN + canonical name for the current user.
// The UID is validated but NOT persisted (it's NIPR's session identifier, not durable state).
func (s *Server) handleVerifyNpn(w http.ResponseWriter, r *http.Request) {
	au := GetAuthUser(r)
	if au == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		NPN           string `json:"npn"`
		CanonicalName string `json:"canonical_name"`
		UID           string `json:"uid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	npn := strings.TrimSpace(req.NPN)
	canonical := strings.TrimSpace(req.CanonicalName)
	uid := strings.TrimSpace(req.UID)

	if !regexp.MustCompile(`^\d{5,10}$`).MatchString(npn) {
		jsonError(w, "invalid npn format", http.StatusBadRequest)
		return
	}
	if canonical == "" {
		jsonError(w, "canonical_name required", http.StatusBadRequest)
		return
	}
	if !regexp.MustCompile(`^P:I:\d+$`).MatchString(uid) {
		jsonError(w, "invalid uid format", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	if err := s.db.UpdateUser(r.Context(), au.UserID, db.UserUpdate{
		NPN:           &npn,
		CanonicalName: &canonical,
		NPNVerifiedAt: &now,
	}); err != nil {
		log.Printf("verifyNpn: %v", err)
		jsonError(w, "failed to persist verification", http.StatusInternalServerError)
		return
	}

	user, err := s.db.GetUserByID(r.Context(), au.UserID)
	if err != nil || user == nil {
		jsonError(w, "user not found after write", http.StatusInternalServerError)
		return
	}

	jsonOK(w, verificationState{
		NPNVerified:   user.NPNVerifiedAt != nil,
		NPN:           user.NPN,
		CanonicalName: user.CanonicalName,
		VerifiedAt:    user.NPNVerifiedAt,
	})
}

// --- Internal helpers ---

// issueTokens generates and responds with access + refresh tokens.
func (s *Server) issueTokens(w http.ResponseWriter, r *http.Request, user *db.User) {
	if user.AgentID == "" {
		agentID, err := s.db.EnsureUserAgentID(r.Context(), user.ID)
		if err != nil {
			log.Printf("auth: ensure token agent id: %v", err)
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
		user.AgentID = agentID
	}
	role, _ := s.db.GetRoleByID(r.Context(), user.RoleID)
	var perms []string
	if role != nil {
		perms = role.Permissions
	}

	au := AuthUser{
		UserID:      user.ID,
		AgentID:     user.AgentID,
		Email:       user.Email,
		DiscordID:   user.DiscordID,
		OrgID:       user.OrgID,
		RoleID:      user.RoleID,
		Permissions: perms,
	}

	accessToken, err := GenerateAccessToken(s.cfg.JWTSecret, au, accessTokenDuration)
	if err != nil {
		log.Printf("auth: generate access token error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		log.Printf("auth: generate refresh token error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	tokenHash := HashRefreshToken(refreshToken)
	expiresAt := time.Now().Add(refreshTokenDuration)
	if _, err := s.db.CreateRefreshToken(r.Context(), user.ID, tokenHash, expiresAt); err != nil {
		log.Printf("auth: store refresh token error: %v", err)
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	jsonOK(w, authResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: authUser{
			ID:          user.ID,
			AgentID:     user.AgentID,
			Email:       user.Email,
			DiscordID:   user.DiscordID,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			OrgID:       user.OrgID,
			RoleID:      user.RoleID,
			Permissions: perms,
		},
	})
}

// --- Discord OAuth helpers ---

type discordTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
}

type discordUserResponse struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"global_name"`
	Avatar     string `json:"avatar"`
	Email      string `json:"email"`
}

func (s *Server) exchangeDiscordCode(code, redirectURI string) (*discordTokenResponse, error) {
	// Use url.Values for proper form encoding (redirect_uri contains special chars)
	formData := url.Values{
		"client_id":     {s.cfg.DiscordClientID},
		"client_secret": {s.cfg.DiscordClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}

	log.Printf("auth: exchanging discord code, redirect_uri=%s, client_id=%s", redirectURI, s.cfg.DiscordClientID)

	req, err := http.NewRequest("POST", "https://discord.com/api/oauth2/token", strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discord token exchange failed (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp discordTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("decode discord token response: %w", err)
	}
	return &tokenResp, nil
}

func (s *Server) fetchDiscordUser(accessToken string) (*discordUserResponse, error) {
	req, err := http.NewRequest("GET", "https://discord.com/api/users/@me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discord user fetch failed (status %d): %s", resp.StatusCode, string(body))
	}

	var user discordUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("decode discord user response: %w", err)
	}
	return &user, nil
}

// DiscordConfigured reports whether the bot token and guild needed for the
// membership check are present. When they are not, Discord features are
// disabled rather than blocking startup.
func (s *Server) discordConfigured() bool {
	return s.cfg.DiscordToken != "" && s.cfg.GuildID != ""
}

// checkGuildMembership verifies that a Discord user is a member of the configured guild.
// Uses the bot token for reliability (no user OAuth scope required).
// When Discord is not configured the check is skipped and the user is allowed.
func (s *Server) checkGuildMembership(discordUserID string) (bool, error) {
	if !s.discordConfigured() {
		return true, nil
	}
	url := fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/%s", s.cfg.GuildID, discordUserID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", "Bot "+s.cfg.DiscordToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	body, _ := io.ReadAll(resp.Body)
	return false, fmt.Errorf("discord API error %d: %s", resp.StatusCode, string(body))
}

// --- Google OAuth helpers ---

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
	IDToken      string `json:"id_token"`
	TokenType    string `json:"token_type"`
}

type googleUserResponse struct {
	Sub           string `json:"sub"`
	ID            string `json:"id"` // v2 userinfo returns "id" (= sub); kept for older endpoints
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	VerifiedEmail bool   `json:"verified_email"` // v2 userinfo uses this spelling
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (s *Server) exchangeGoogleCode(code, redirectURI string) (*googleTokenResponse, error) {
	formData := url.Values{
		"client_id":     {s.cfg.GoogleClientID},
		"client_secret": {s.cfg.GoogleClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}

	log.Printf("auth: exchanging google code, redirect_uri=%s, client_id=%s", redirectURI, s.cfg.GoogleClientID)

	req, err := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google token exchange failed (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp googleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("decode google token response: %w", err)
	}
	return &tokenResp, nil
}

func (s *Server) fetchGoogleUser(accessToken string) (*googleUserResponse, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google user fetch failed (status %d): %s", resp.StatusCode, string(body))
	}

	var user googleUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("decode google user response: %w", err)
	}
	// v2 userinfo returns "id" and "verified_email" instead of "sub"/"email_verified"
	if user.Sub == "" {
		user.Sub = user.ID
	}
	if !user.EmailVerified && user.VerifiedEmail {
		user.EmailVerified = true
	}
	return &user, nil
}

// generateUUID returns a v4 UUID string using crypto/rand.
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
