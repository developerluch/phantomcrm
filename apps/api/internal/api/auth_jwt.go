package api

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// AuthUser holds the identity extracted from a JWT or synthesized from an API key.
type AuthUser struct {
	UserID      string   `json:"userId"`
	AgentID     string   `json:"agentId"`
	Email       string   `json:"email"`
	DiscordID   string   `json:"discordId"`
	OrgID       string   `json:"orgId"`
	RoleID      string   `json:"roleId"`
	Permissions []string `json:"permissions"`
}

// AuthClaims is the JWT payload.
type AuthClaims struct {
	AuthUser
	ExpiresAt int64 `json:"exp"`
	IssuedAt  int64 `json:"iat"`
}

// jwtHeader is the fixed HS256 header.
var jwtHeader = mustBase64JSON(map[string]string{"alg": "HS256", "typ": "JWT"})

func mustBase64JSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// GenerateAccessToken creates an HS256 JWT with the given user claims.
func GenerateAccessToken(secret string, user AuthUser, duration time.Duration) (string, error) {
	now := time.Now()
	claims := AuthClaims{
		AuthUser:  user,
		ExpiresAt: now.Add(duration).Unix(),
		IssuedAt:  now.Unix(),
	}

	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("marshal claims: %w", err)
	}
	payload := base64.RawURLEncoding.EncodeToString(payloadBytes)

	sigInput := jwtHeader + "." + payload
	sig := signHS256(sigInput, secret)

	return sigInput + "." + sig, nil
}

// GenerateRefreshToken returns a cryptographically random 32-byte hex string.
func GenerateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate refresh token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// ValidateAccessToken parses an HS256 JWT and returns the embedded AuthUser.
func ValidateAccessToken(secret, tokenStr string) (*AuthUser, error) {
	parts := strings.SplitN(tokenStr, ".", 3)
	if len(parts) != 3 {
		return nil, errors.New("malformed token")
	}

	sigInput := parts[0] + "." + parts[1]
	expectedSig := signHS256(sigInput, secret)
	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, errors.New("invalid signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}

	var claims AuthClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("unmarshal claims: %w", err)
	}

	if time.Now().Unix() > claims.ExpiresAt {
		return nil, errors.New("token expired")
	}

	return &claims.AuthUser, nil
}

// HashRefreshToken returns the SHA-256 hex digest of the token.
func HashRefreshToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// signHS256 returns the base64url-encoded HMAC-SHA256 signature.
func signHS256(input, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(input))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
