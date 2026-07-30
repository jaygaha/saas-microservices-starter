// refresh token in Redis
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const RefreshTTL = 7 * 24 * time.Hour

// NewRefreshToken mints an opaque token, stores its SHA-256 in Redis mapped to
// the user, and returns the raw token (shown to the client once).
func NewRefreshToken(ctx context.Context, rdb *redis.Client, userID uuid.UUID) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}

	// 32 random bytes → base64 ASCII → Redis key + short expiry
	token := base64.RawURLEncoding.EncodeToString(raw)

	if err := rdb.Set(ctx, refreshKey(token), userID.String(), RefreshTTL).Err(); err != nil {
		return "", err
	}

	return token, nil
}

// lookupRefresh returns the user id a refresh token maps to (redis.Nil if absent).
func lookupRefresh(ctx context.Context, rdb *redis.Client, token string) (uuid.UUID, error) {
	val, err := rdb.Get(ctx, refreshKey(token)).Result()
	if err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(val)
}

// RevokeRefreshToken deletes a refresh token (logout / rotation). No-op if absent.
func RevokeRefreshToken(ctx context.Context, rdb *redis.Client, token string) error {
	return rdb.Del(ctx, refreshKey(token)).Err()
}

// refreshKey hashes the token so a Redis dump never exposes usable tokens.
func refreshKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return "refresh:" + hex.EncodeToString(sum[:])
}

// ClearRefreshToken removes a token from Redis (e.g. on logout or rotation).
func ClearRefreshToken(ctx context.Context, rdb *redis.Client, token string) error {
	return rdb.Del(ctx, refreshKey(token)).Err()
}
