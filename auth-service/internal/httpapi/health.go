package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/store"
)

// handleLive: the process is up and serving (shallow)
func handleLive(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": service})
	}
}

// handleReady: 200 only if both DB and Redis are healthy; 503 otherwise
// Use a short context to avoid blocking startup if stores are slow to come up.
func handleReady(st *store.Store, service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		err := st.Ready(ctx)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"status":  "unavailable",
				"service": service,
				"error":   err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ready", "service": service})
	}
}
