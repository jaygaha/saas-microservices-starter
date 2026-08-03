// Register orchestration
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/db"
)

// Errors

// ErrEmailTaken is returned when the email already exists (unique violation).
var ErrEmailTaken = errors.New("email already registered")
var (
	ErrInvalidTeamName = errors.New("team name must contain letters or numbers")
	ErrSlugTaken       = errors.New("team slug already exists")
)

// ErrInvalidCredentials is returned for both wrong password AND unknown email,
// so we never reveal which emails are registered.
var ErrInvalidCredentials = errors.New("invalid email or password")

// ErrInvalidToken is returned for a missing/expired/rotated refresh token
var ErrInvalidToken = errors.New("invalid or expired token")

// ErrNotMember is returned when the user is not a member of the team
var ErrNotMember = errors.New("user is not a member of the team")

// Service struct

type Service struct {
	q         *db.Queries // only used for read-only team lookup;
	pool      *pgxpool.Pool
	rdb       *redis.Client
	jwtSecret string // copied from env:JWT_SECRET
}

// NewService builds a service struct that holds references
func NewService(pool *pgxpool.Pool, rdb *redis.Client, jwtSecret string) *Service {
	return &Service{
		q:         db.New(pool),
		pool:      pool,
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

// Refresh rotates a refresh token: verify -> delete old -> issue new access+refresh.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (*AuthResult, error) {
	userID, err := lookupRefresh(ctx, s.rdb, refreshToken)
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("lookup refresh: %w", err)
	}

	// Rotate: the presented token is single-use
	if err := RevokeRefreshToken(ctx, s.rdb, refreshToken); err != nil {
		return nil, fmt.Errorf("revoke old refresh: %w", err)
	}

	// Re-load the user (also confirms they still exist/ aren't soft deleted).
	user, err := s.q.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("get user: %w", err)
	}

	return s.issueTokens(ctx, user)
}

// Logout revokes a refresh token (idempotent)
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return RevokeRefreshToken(ctx, s.rdb, refreshToken)
}

// UserByID loads a current user by ID
func (s *Service) UserByID(ctx context.Context, userID uuid.UUID) (db.User, error) {
	return s.q.GetUserByID(ctx, userID)
}

// CreateTeam creates a team and the creator's owner membership in ONE transaction.
func (s *Service) CreateTeam(ctx context.Context, ownerID uuid.UUID, name string) (db.Team, error) {
	slug := slugify(name)
	if slug == "" {
		return db.Team{}, ErrInvalidTeamName
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return db.Team{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	qtx := s.q.WithTx(tx)

	team, err := qtx.CreateTeam(ctx, db.CreateTeamParams{Name: name, Slug: slug, CreatedBy: ownerID})
	if err != nil {
		if isUniqueViolation(err) {
			return db.Team{}, ErrSlugTaken
		}
		return db.Team{}, fmt.Errorf("create team: %w", err)
	}

	if _, err := qtx.AddTeamMember(ctx, db.AddTeamMemberParams{
		TeamID: team.ID, UserID: ownerID, Role: db.TeamRoleOwner,
	}); err != nil {
		return db.Team{}, fmt.Errorf("add owner member: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return db.Team{}, fmt.Errorf("commit transaction: %w", err)
	}

	return team, nil
}

// MemberRole returns the caller's role in a team, or ErrrNotMember
func (s *Service) MemberRole(ctx context.Context, teamID, userID uuid.UUID) (db.TeamRole, error) {
	m, err := s.q.GetTeamMember(ctx, db.GetTeamMemberParams{TeamID: teamID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotMember
		}
		return "", fmt.Errorf("get team member: %w", err)
	}

	return m.Role, nil
}

func (s *Service) ListMembers(ctx context.Context, teamID uuid.UUID) ([]db.ListTeamMembersRow, error) {
	return s.q.ListTeamMembers(ctx, teamID)
}

// Helper functions

// It checks if the error is a unique constraint violation.
func isUniqueViolation(err error) bool {
	var pgerr *pgconn.PgError
	return errors.As(err, &pgerr) && pgerr.Code == "23505"
}

// slugify lowercases and turns any run of non-alphanumerics into a single hyphen.
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))

	var b strings.Builder
	hyphen := false

	for _, r := range s {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
			hyphen = false
		} else if !hyphen && b.Len() > 0 {
			b.WriteByte('-')
			hyphen = true
		}
	}

	return strings.Trim(b.String(), "-")
}
