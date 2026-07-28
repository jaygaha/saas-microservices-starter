package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	pgxuuid "github.com/vgarvardt/pgx-google-uuid/v5"
)

// pgxpool is a connection pool(not a single conn): the right default for a web service.
// This same pool is what sqlc's generated queries expects as its DB argument, so it fits perfectly.

// Store bundles the datastores the service depends on
type Store struct {
	DB    *pgxpool.Pool
	Redis *redis.Client
}

// New connects to Postgres + Redis and verifies both are reachable before returning
func New(ctx context.Context, databaseURL, redisURL string) (*Store, error) {
	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("postgres parse config: %w", err)
	}

	// Register the google/uuid codec on every pooled connection so pgx can
	// scan/encode Postgres uuid columns as uuid.UUID (what sqlc generates).
	poolCfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		pgxuuid.Register(conn.TypeMap())
		return nil
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("postgres connect failed: %w", err)
	}

	// Verify DB connectivity
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err = pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	// Connect to Redis
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("redis parse: %w", err)
	}

	rClient := redis.NewClient(opts)
	if err := rClient.Ping(pingCtx).Err(); err != nil {
		pool.Close()
		_ = rClient.Close()
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &Store{
		DB:    pool,
		Redis: rClient,
	}, nil
}

// Ready reports whether both datastores are connected.
func (s *Store) Ready(ctx context.Context) error {
	if err := s.DB.Ping(ctx); err != nil {
		return fmt.Errorf("postgres down: %w", err)
	}
	if err := s.Redis.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis down: %w", err)
	}
	return nil
}

// Close releases both connections
func (s *Store) Close() {
	if s != nil {
		if s.Redis != nil {
			s.Redis.Close()
		}
		if s.DB != nil {
			s.DB.Close()
		}
	}
}
