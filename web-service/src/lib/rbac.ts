import type { Role } from '../types'

// Mirrors the server catalogs: auth-service internal/rbac (team.*/member.*) and
// task-service rbac.py (board.*/task.*). UI gating ONLY - the API is the source of truth.
export const P = {
    TEAM_VIEW: 'team.view',
    TEAM_UPDATE: 'team.update',
    TEAM_DELETE: 'team.delete',
    MEMBER_VIEW: 'member.view',
    MEMBER_INVITE: 'member.invite',
    MEMBER_UPDATE_ROLE: 'member.update-role',
    MEMBER_REMOVE: 'member.remove',
    BOARD_VIEW: 'board.view',
    BOARD_CREATE: 'board.create',
    BOARD_UPDATE: 'board.update',
    BOARD_DELETE: 'board.delete',
    TASK_VIEW: 'task.view',
    TASK_CREATE: 'task.create',
    TASK_UPDATE: 'task.update',
    TASK_DELETE: 'task.delete',
    TASK_ASSIGN: 'task.assign',
} as const

export type Permission = (typeof P)[keyof typeof P]

const ALL_BOARD_TASKS: Permission[] = [
    P.BOARD_VIEW, P.BOARD_CREATE, P.BOARD_UPDATE, P.BOARD_DELETE,
    P.TASK_VIEW, P.TASK_CREATE, P.TASK_UPDATE, P.TASK_DELETE, P.TASK_ASSIGN,
]

const ROLE_PERMS: Record<Role, Set<Permission>> = {
    owner: new Set<Permission>([
        P.TEAM_VIEW, P.TEAM_UPDATE, P.TEAM_DELETE,
        P.MEMBER_VIEW, P.MEMBER_INVITE, P.MEMBER_UPDATE_ROLE, P.MEMBER_REMOVE,
        ...ALL_BOARD_TASKS,
    ]),
    admin: new Set<Permission>([
        P.TEAM_VIEW, P.TEAM_UPDATE,
        P.MEMBER_VIEW, P.MEMBER_INVITE, P.MEMBER_UPDATE_ROLE, P.MEMBER_REMOVE,
        ...ALL_BOARD_TASKS,
    ]),
    member: new Set<Permission>([
        P.TEAM_VIEW, P.MEMBER_VIEW,
        P.BOARD_VIEW, P.BOARD_CREATE, P.BOARD_UPDATE,
        P.TASK_VIEW, P.TASK_CREATE, P.TASK_UPDATE, P.TASK_DELETE, P.TASK_ASSIGN,
    ]),
    viewer: new Set<Permission>([
        P.TEAM_VIEW, P.MEMBER_VIEW, P.BOARD_VIEW, P.TASK_VIEW,
    ]),
}

export function can(role: Role | undefined, perm: Permission): boolean {
    if (!role) return false
    return ROLE_PERMS[role]?.has(perm) ?? false
}
