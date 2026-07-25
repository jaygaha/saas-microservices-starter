// Command auth-service is the identity & access service.
//
// Step 1 is intentionally tiny: a health endpoint and a root handler, using
// only the standard library. Its whole job right now is to prove that a request
// can travel client -> Traefik -> this container and back. We'll grow it into
// real auth (users, JWT, teams, RBAC) in later steps.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	service := getenv("SERVICE_NAME", "auth-service")
	port := getenv("PORT", "8000")

	mux := http.NewServeMux()
	// Go 1.22+ pattern syntax: method + path in the pattern string.
	mux.HandleFunc("GET /health", handleHealth(service))
	mux.HandleFunc("/", handleRoot(service))

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      logRequests(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Serve in a goroutine so main can block on OS signals for a clean shutdown.
	go func() {
		log.Printf("[%s] listening on :%s", service, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[%s] server error: %v", service, err)
		}
	}()

	// Wait for Ctrl-C / `docker compose down` (SIGINT / SIGTERM).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Printf("[%s] shutting down…", service)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[%s] graceful shutdown failed: %v", service, err)
	}
	log.Printf("[%s] stopped", service)
}

// handleHealth is what Docker's healthcheck (and, later, Traefik/monitoring)
// hits to confirm the process is alive.
func handleHealth(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "ok",
			"service": service,
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// handleRoot echoes the path so you can *see* prefix-stripping working:
// GET /api/auth/anything at the gateway arrives here as /anything.
func handleRoot(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service": service,
			"message": "up — this request reached the service through Traefik",
			"path":    r.URL.Path,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// logRequests is a minimal access-log middleware.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(start))
	})
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
