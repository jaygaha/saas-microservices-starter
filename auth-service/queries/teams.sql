-- name: CreateTeam :one
INSERT INTO teams (name, slug, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddTeamMember :one
INSERT INTO team_members (team_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetTeamMember :one
SELECT * FROM team_members
WHERE team_id = $1 AND user_id = $2;

-- name: ListTeamMembers :many
SELECT tm.user_id, u.email, u.full_name, tm.role, tm.created_at 
FROM team_members tm
INNER JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = $1 AND u.deleted_at IS NULL
ORDER BY tm.created_at;

-- name: UpdateTeamMemberRole :exec
UPDATE team_members SET role = $3, updated_at = now()
WHERE team_id = $1 AND user_id = $2;

-- name: RemoveTeamMember :exec
DELETE FROM team_members
WHERE team_id = $1 AND user_id = $2;

-- name: CountTeamOwners :one
SELECT count(*) FROM team_members
WHERE team_id = $1 AND role = 'owner';

-- name: ListTeamsForUser :many
SELECT t.id, t.name, t.slug, tm.role
FROM team_members tm
INNER JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = $1 AND t.deleted_at IS NULL
ORDER BY t.created_at;