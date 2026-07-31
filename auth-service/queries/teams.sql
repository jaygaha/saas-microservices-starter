-- name: CreateTeam :one
INSERT INTO teams (name, slug, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddTeamMember :one
INSERT INTO team_members (team_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;
