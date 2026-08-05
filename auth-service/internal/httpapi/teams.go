package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/db"
)

type createTeamRequest struct {
	Name string `json:"name"`
}

type addMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type updateMemberRequest struct {
	Role string `json:"role"`
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

func handleAddMember(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamID, err := uuid.Parse(r.PathValue("teamID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid team id")
			return
		}

		var req addMemberRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		req.Email = strings.TrimSpace(req.Email)
		if !strings.Contains(req.Email, "@") {
			writeError(w, http.StatusBadRequest, "a valid email is required")
			return
		}

		role := db.TeamRole(req.Role)
		if role != db.TeamRoleAdmin && role != db.TeamRoleMember && role != db.TeamRoleViewer {
			writeError(w, http.StatusBadRequest, "invalid role; role must be admin, member, or viewer")
			return
		}

		user, err := svc.AddMember(r.Context(), teamID, req.Email, role)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrUserNotFound):
				writeError(w, http.StatusNotFound, "no user with that email")
			case errors.Is(err, auth.ErrAlreadyMember):
				writeError(w, http.StatusConflict, "user is already a member")
			default:
				writeError(w, http.StatusInternalServerError, "could not add member")
			}
			return
		}

		writeJSON(w, http.StatusCreated, memberDTO{
			UserID:   user.ID.String(),
			Email:    user.Email,
			FullName: user.FullName.String,
			Role:     string(role),
		})
	}
}

func handleUpdateMemberRole(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamID, err := uuid.Parse(r.PathValue("teamID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid team id")
			return
		}

		targetID, err := uuid.Parse(r.PathValue("userID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid user id")
			return
		}

		var req updateMemberRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		newRole := db.TeamRole(req.Role)
		if !isValidRole(newRole) {
			writeError(w, http.StatusBadRequest, "invalid role; role must be admin, member, or viewer")
			return
		}

		callerRole, _ := roleFromContext(r.Context())
		if err := svc.UpdateMemberRole(r.Context(), teamID, targetID, newRole, callerRole); err != nil {
			writeMemberErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleRemoveMember(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamID, err := uuid.Parse(r.PathValue("teamID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid team id")
			return
		}

		targetID, err := uuid.Parse(r.PathValue("userID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid user id")
			return
		}

		callerRole, _ := roleFromContext(r.Context())
		if err := svc.RemoveMember(r.Context(), teamID, targetID, callerRole); err != nil {
			writeMemberErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func isValidRole(role db.TeamRole) bool {
	switch role {
	case db.TeamRoleAdmin, db.TeamRoleMember, db.TeamRoleViewer:
		return true
	}

	return false
}

func writeMemberErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrTargetNotMember):
		writeError(w, http.StatusNotFound, "user is not a member of this team")
	case errors.Is(err, auth.ErrCannotModifyOwner):
		writeError(w, http.StatusForbidden, "only owner can modify owner")
	case errors.Is(err, auth.ErrOwnerGrant):
		writeError(w, http.StatusForbidden, "owner can not be removed or demoted")
	case errors.Is(err, auth.ErrLastOwner):
		writeError(w, http.StatusConflict, "the team must keep at least one owner")
	default:
		writeError(w, http.StatusInternalServerError, "could not update membership")
	}
}
