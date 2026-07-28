// handler + DTOs
package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jaygaha/saas-microservices-starter/auth-service/internal/auth"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userDTO struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
}

type authResponse struct {
	User         userDTO `json:"user"`
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	TokenType    string  `json:"token_type"`
	ExpiresIn    int     `json:"expires_in"`
}

func handleRegister(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		// Basic validation
		req.Email = strings.TrimSpace(req.Email)
		if !strings.Contains(req.Email, "@") {
			writeError(w, http.StatusBadRequest, "a valid email is required")
			return
		}

		if len(req.Password) < 8 {
			writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
			return
		}

		result, err := svc.Register(r.Context(), req.Email, req.Password, req.FullName)
		if err != nil {
			if errors.Is(err, auth.ErrEmailTaken) {
				writeError(w, http.StatusConflict, "email already registered")
				return
			}
			writeError(w, http.StatusInternalServerError, "register failed")
			return
		}

		writeJSON(w, http.StatusCreated, toAuthResponse(result))
	}
}

func handleLogin(svc *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		req.Email = strings.TrimSpace(req.Email)
		if req.Email == "" || req.Password == "" {
			writeError(w, http.StatusBadRequest, "email and password are required")
			return
		}

		res, err := svc.Login(r.Context(), req.Email, req.Password)
		if err != nil {
			if errors.Is(err, auth.ErrInvalidCredentials) {
				writeError(w, http.StatusUnauthorized, "invalid email or password")
				return
			}
			writeError(w, http.StatusInternalServerError, "could not log in")
			return
		}

		writeJSON(w, http.StatusOK, toAuthResponse(res)) // 200, not 201
	}
}

func toAuthResponse(res *auth.AuthResult) authResponse {
	return authResponse{
		User: userDTO{
			ID:       res.User.ID.String(),
			Email:    res.User.Email,
			FullName: res.User.FullName.String,
		},
		AccessToken:  res.AccessToken,
		RefreshToken: res.RefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(auth.AccessTTL.Seconds()),
	}
}
