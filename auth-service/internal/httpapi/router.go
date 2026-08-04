package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/rbac"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/store"
)

// NewRouter builds the HTTP handler for the service
func NewRouter(st *store.Store, svc *auth.Service, secret, service string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", handleLive(service))            // liveness
	mux.HandleFunc("GET /health/ready", handleReady(st, service)) // readiness
	mux.HandleFunc("POST /register", handleRegister(svc))         // ← /api/register after strip
	mux.HandleFunc("POST /login", handleLogin(svc))               // ← /api/login after strip
	mux.HandleFunc("POST /refresh", handleRefresh(svc))           // ← /api/refresh after strip
	mux.HandleFunc("POST /logout", handleLogout(svc))             // ← /api/logout after strip

	mux.HandleFunc("GET /me", requiredAuth(secret, handleMe(svc))) // ← /api/me protected by middleware

	mux.HandleFunc("POST /teams", requiredAuth(secret, handleCreateTeam(svc))) // ← /api/teams protected by middleware
	mux.HandleFunc("GET /teams/{teamID}/members", requiredAuth(secret, requirePermission(svc, rbac.MemberView, handleListMembers(svc))))
	mux.HandleFunc("POST /teams/{teamID}/members", requiredAuth(secret, requirePermission(svc, rbac.MemberInvite, handleAddMember(svc))))

	return logRequests(mux)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		// log.Printf("method=%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
		log.Printf("method=%s %s duration=%v", r.Method, r.URL.Path, time.Since(start))
	})
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{
		"error": message,
	})
}
