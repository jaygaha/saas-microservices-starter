export type Role = 'owner' | 'admin' | 'member' | 'viewer'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface User {
    id: string
    email: string
    full_name: string
}

export interface AuthResponse {
    user: User
    access_token: string
    refresh_token: string
    token_type: string,
    expires_in: number
}

export interface Team {
    id: string
    name: string
    slug: string
    role: Role // caller's role, from GET /auth/teams
}

export interface Member {
    user_id: string
    email: string
    full_name: string
    role: Role
}

export interface Board {
    id: string
    team_id: string
    name: string
    created_by: string
}

export interface Task {
    id: string
    board_id: string
    title: string
    description: string | null
    status: TaskStatus
    assignee_id: string | null
    created_by: string
}