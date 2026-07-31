// Command auth-service is the identity & access service for the Task Manager SaaS:
// users, authentication (JWT), teams, and RBAC, backed by PostgreSQL and Redis
// and served behind Traefik at /api/auth/*.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/config"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/httpapi"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("cannot load config: %v", err)
	}

	ctx := context.Background()
	st, err := store.New(ctx, cfg.DatabaseURL, cfg.RedisURL)
	if err != nil {
		log.Fatalf("cannot init store: %v", err)
	}

	defer st.Close()

	authSvc := auth.NewService(st.DB, st.Redis, cfg.JWTSecret)

	log.Printf("[%s] connected to postgres and redis", cfg.ServiceName)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           httpapi.NewRouter(st, authSvc, cfg.JWTSecret, cfg.ServiceName),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       10 * time.Second,
	}

	go func() {
		log.Printf("[%s] HTTP listening on %s", cfg.ServiceName, srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[%s] server failed: %v", cfg.ServiceName, err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	<-stop

	log.Printf("[%s] shutting down gracefully...", cfg.ServiceName)

	shutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Printf("[%s] forced shutdown: %v", cfg.ServiceName, err)
	}

	log.Printf("[%s] server exited", cfg.ServiceName)
}
