package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/store"
)

// NewRouter builds the HTTP handler for the service
func NewRouter(st *store.Store, service string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", handleLive(service))            // liveness
	mux.HandleFunc("GET /health/ready", handleReady(st, service)) // readiness

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
