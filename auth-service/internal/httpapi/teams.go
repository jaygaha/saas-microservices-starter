package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
)

type createTeamRequest struct {
	Name string `json:"name"`
}

type teamDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type memberDTO struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

func handleCreateTeam(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := userIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		var req createTeamRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			writeError(w, http.StatusBadRequest, "team name is required")
			return
		}

		team, err := svc.CreateTeam(r.Context(), userID, req.Name)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrSlugTaken):
				writeError(w, http.StatusConflict, "a team with a similar name already exists")
			case errors.Is(err, auth.ErrInvalidTeamName):
				writeError(w, http.StatusBadRequest, "team name must contain letters or numbers")
			default:
				writeError(w, http.StatusInternalServerError, "could not create team")
			}
			return
		}

		writeJSON(w, http.StatusCreated, teamDTO{ID: team.ID.String(), Name: team.Name, Slug: team.Slug})
	}
}

func handleListMembers(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamID, err := uuid.Parse(r.PathValue("teamID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid team id")
			return
		}

		rows, err := svc.ListMembers(r.Context(), teamID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not list team members")
			return
		}

		out := make([]memberDTO, 0, len(rows))
		for _, row := range rows {
			out = append(out, memberDTO{
				UserID:   row.UserID.String(),
				Email:    row.Email,
				FullName: row.FullName.String,
				Role:     string(row.Role),
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"members": out})
	}
}
