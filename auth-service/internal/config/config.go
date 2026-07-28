package config

import (
	"fmt"
	"os"
)

// Config holds the configuration for the application.
type Config struct {
	ServiceName string
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
}

// Load reads config from the environment and fails fast if a required var is missing
func Load() (Config, error) {
	cfg := Config{
		ServiceName: getenv("SERVICE_NAME", "auth-service"),
		Port:        getenv("PORT", "8000"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
	}

	// Validate required fields
	for name, val := range map[string]string{
		"DATABASE_URL": cfg.DatabaseURL,
		"REDIS_URL":    cfg.RedisURL,
		"JWT_SECRET":   cfg.JWTSecret,
	} {
		if val == "" {
			return cfg, fmt.Errorf("missing required env var: %s", name)
		}
	}
	return cfg, nil
}

func getenv(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}
