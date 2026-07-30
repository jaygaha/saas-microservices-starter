package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
)

type ctxKey string

const userIDKey ctxKey = "userID"

// requiredAuth verifies the Bearer access token and stashes the user_id in the context.
func requiredAuth(secret string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			writeError(w, http.StatusUnauthorized, "missing or invalid authorization header")
			return
		}

		claims, err := auth.ParseAccessToken(secret, token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		userID, err := uuid.Parse(claims.Subject)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid token subject")
			return
		}

		r = r.WithContext(context.WithValue(r.Context(), userIDKey, userID))
		next(w, r)
	}
}

// userIDFromContext is a helper function to extract userID from context
func userIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(userIDKey).(uuid.UUID)
	return userID, ok
}
