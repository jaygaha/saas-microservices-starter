// Register orchestration
package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/db"
)

// ErrEmailTaken is returned when the email already exists (unique violation).
var ErrEmailTaken = errors.New("email already registered")

// ErrInvalidCredentials is returned for both wrong password AND unknown email,
// so we never reveal which emails are registered.
var ErrInvalidCredentials = errors.New("invalid email or password")

type Service struct {
	q         *db.Queries // only used for read-only team lookup;
	rdb       *redis.Client
	jwtSecret string // copied from env:JWT_SECRET
}

// NewService builds a service struct that holds references
func NewService(q *db.Queries, rdb *redis.Client, jwtSecret string) *Service {
	return &Service{
		q:         q,
		rdb:       rdb,
		jwtSecret: jwtSecret,
	}
}

// AuthResult is the user + freshly minted tokens.
type AuthResult struct {
	User         db.User
	AccessToken  string
	RefreshToken string
}

// Register handles user registration, creates a new user, issues tokens and returns the result
func (s *Service) Register(ctx context.Context, email, password, fullName string) (*AuthResult, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: hash,
		FullName:     pgtype.Text{String: fullName, Valid: fullName != ""},
	})

	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, fmt.Errorf("create user: %w", err)
	}

	return s.issueTokens(ctx, user)
}

func (s *Service) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	user, err := s.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("get user: %w", err)
	}

	if err := CheckPassword(password, user.PasswordHash); err != nil {
		return nil, ErrInvalidCredentials
	}
	return s.issueTokens(ctx, user)

}

// issueTokens mints an access token and a refresh token for the user
func (s *Service) issueTokens(ctx context.Context, user db.User) (*AuthResult, error) {
	access, err := NewAccessToken(s.jwtSecret, user.ID, user.Email)
	if err != nil {
		return nil, fmt.Errorf("access token: %w", err)
	}

	refresh, err := NewRefreshToken(ctx, s.rdb, user.ID)
	if err != nil {
		return nil, fmt.Errorf("refresh token: %w", err)
	}

	return &AuthResult{
		User:         user,
		AccessToken:  access,
		RefreshToken: refresh,
	}, nil
}

// It checks if the error is a unique constraint violation.
func isUniqueViolation(err error) bool {
	var pgerr *pgconn.PgError
	return errors.As(err, &pgerr) && pgerr.Code == "23505"
}
