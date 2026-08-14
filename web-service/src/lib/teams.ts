import { api } from './api';
import type { Team, Member, Role } from '../types';

export async function listTeams(): Promise<Team[]> {
    const data = await api<{ teams: Team[] }>('/auth/teams')

    return data.teams
}

export async function createTeam(name: string): Promise<Team> {
    // POST /teams returns { id, name, slug }; the creator is always the owner
    const data = await api<{ id: string; name: string; slug: string }>('/auth/teams', {
        method: 'POST',
        body: { name }
    })

    return {
        ...data,
        role: 'owner'
    }
}

export async function listMembers(teamId: string): Promise<Member[]> {
    const data = await api<{ members: Member[] }>(`/auth/teams/${teamId}/members`)

    return data.members
}

export async function addMember(teamId: string, email: string, role: Exclude<Role, 'owner'>,
): Promise<Member> {
    return api<Member>(`/auth/teams/${teamId}/members`, {
        method: 'POST',
        body: { email, role }
    })
}

export async function updateMemberRole(teamId: string, userId: string, role: Role): Promise<void> {
    await api(`/auth/teams/${teamId}/members/${userId}`, { method: 'PATCH', body: { role } })
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
    await api(`/auth/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
}
