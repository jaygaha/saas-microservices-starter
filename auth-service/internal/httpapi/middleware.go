package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/db"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/rbac"
)

type ctxKey string

const userIDKey ctxKey = "userID"
const roleKey ctxKey = "role"

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

// requirePermission runs AFTER requiredAuth: it resolves the caller's role in the
// {teamID} team and checks the permission catalog. 403 if not a member or not allowed.
func requirePermission(svc *auth.Service, perm rbac.Permission, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := userIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthenticated user")
			return
		}

		teamID, err := uuid.Parse(r.PathValue("teamID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid team id path parameter")
			return
		}

		role, err := svc.MemberRole(r.Context(), teamID, userID)
		if err != nil {
			if errors.Is(err, auth.ErrNotMember) {
				writeError(w, http.StatusForbidden, "not a member of this team")
				return
			}
			writeError(w, http.StatusInternalServerError, "authorization faild")
			return
		}

		if !rbac.Can(role, perm) {
			writeError(w, http.StatusForbidden, "permission denied")
			return
		}

		// stash the role: handlers need it for the owner guards
		next(w, r.WithContext(context.WithValue(r.Context(), roleKey, role)))
	}
}

// roleFromContext is a helper function to extract role from context
func roleFromContext(ctx context.Context) (db.TeamRole, bool) {
	role, ok := ctx.Value(roleKey).(db.TeamRole)
	return role, ok
}
