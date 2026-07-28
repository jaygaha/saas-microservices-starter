package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const AccessTTL = 15 * time.Minute

// AccessClaims is what we put in the access token.
type AccessClaims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// NewAccessToken signs a short-lived access token for the user
func NewAccessToken(secret string, userID uuid.UUID, email string) (string, error) {
	now := time.Now()
	claims := AccessClaims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			ID:        uuid.NewString(), // jti: unique per token
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(AccessTTL)),
			Issuer:    "auth-service",
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}
