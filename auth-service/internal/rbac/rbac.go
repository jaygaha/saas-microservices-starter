package rbac

import "github.com/jaygaha/saas-microservices-starter/auth-service/internal/db"

// Permission is a "resource.action" capability string, e.g. "teams.member.invite" or "users.read.all"
type Permission string

const (
	TeamView   Permission = "team.view"
	TeamUpdate Permission = "team.update"
	TeamDelete Permission = "team.delete"

	MemberView       Permission = "member.view"
	MemberInvite     Permission = "member.invite"
	MemberUpdateRole Permission = "member.update-role"
	MemberRemove     Permission = "member.remove"
)

// rolePermissions is THE catalog: which permissios each role holds.
// (Owner-protection rules are business invariants enforced in handlers)
var rolePermissions = map[db.TeamRole]map[Permission]struct{}{
	db.TeamRoleOwner: setOf(
		TeamView,
		TeamUpdate,
		TeamDelete,
		MemberView,
		MemberInvite,
		MemberUpdateRole,
		MemberRemove,
	),
	db.TeamRoleAdmin: setOf(
		TeamView,
		TeamUpdate,
		MemberView,
		MemberInvite,
		MemberUpdateRole,
		MemberRemove,
	),
	db.TeamRoleMember: setOf(TeamView, MemberView),
	db.TeamRoleViewer: setOf(TeamView, MemberView),
}

// Can reports whether a role holds a permission.
func Can(role db.TeamRole, perm Permission) bool {
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	_, has := perms[perm]

	return has
}

// setOf is a helper to create a map[Permission]struct{} from a list of Permissions.
func setOf(perms ...Permission) map[Permission]struct{} {
	m := make(map[Permission]struct{}, len(perms))
	for _, p := range perms {
		m[p] = struct{}{}
	}

	return m
}
