import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/useAuth'
import { listTeams, listMembers, addMember, updateMemberRole, removeMember } from '../lib/teams'
import { can, P } from '../lib/rbac'
import { ApiError } from '../lib/api'
import type { Role } from '../types'
import { Button, Card, Input, Select } from '../components/ui'
import { BoardsPanel } from '../components/BoardsPanel'

const ASSIGNABLE: Role[] = ['admin', 'member', 'viewer']

const roleColor: Record<string, string> = {
    owner: 'bg-brand/10 text-brand',
    admin: 'bg-brand/10 text-brand',
    member: 'bg-gray-100 text-ink',
    viewer: 'bg-gray-100 text-muted',
}

export function TeamDetail() {
    const { id = '' } = useParams();
    const { user } = useAuth()
    const qc = useQueryClient()

    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: listTeams })
    const team = teams?.find((t) => t.id === id)
    const myRole = team?.role

    const { data: members, isLoading } = useQuery({
        queryKey: ['members', id],
        queryFn: () => listMembers(id),
        enabled: !!id,
    })


    const canInvite = can(myRole, P.MEMBER_INVITE)
    const canUpdate = can(myRole, P.MEMBER_UPDATE_ROLE)
    const canRemove = can(myRole, P.MEMBER_REMOVE)

    const [email, setEmail] = useState('')
    const [role, setRole] = useState<Role>('member')
    const [formError, setFormError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const invalidate = () => qc.invalidateQueries({ queryKey: ['members', id] })
    const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

    // useMutation hooks: use of this hook is to mutate data and in react query we can provide onSuccess, onError and onSettled callback.
    const add = useMutation({
        mutationFn: () => addMember(id, email.trim(), role as Exclude<Role, 'owner'>),
        onSuccess: () => { setEmail(''); setFormError(null); invalidate() },
        onError: (e) => setFormError(errMsg(e, 'Could not add member')),
    })

    const changeRole = useMutation({
        mutationFn: (v: { userId: string; role: Role }) => updateMemberRole(id, v.userId, v.role),
        onSuccess: () => { setActionError(null); invalidate() },
        onError: (e) => setActionError(errMsg(e, 'Could not update role')),
    })

    const remove = useMutation({
        mutationFn: (userId: string) => removeMember(id, userId),
        onSuccess: () => { setActionError(null); invalidate() },
        onError: (e) => setActionError(errMsg(e, 'Could not remove member')),
    })

    function onAdd(e: SubmitEvent) {
        e.preventDefault()
        if (email.trim()) add.mutate()
    }

    if (teams && !team) {
        return <p className="text-sm text-red-600">Team not found, or you don't have access.</p>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-ink">{team?.name ?? 'Team'}</h1>
                {myRole && <p className="mt-1 text-sm text-muted">Your role: {myRole}</p>}
            </div>

            {canInvite && (
                <Card>
                    <h2 className="text-sm font-semibold text-ink">Add member</h2>
                    <form onSubmit={onAdd} className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                            <Input label="Email" type="email" placeholder="person@example.com"
                                value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="w-32">
                            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                                {ASSIGNABLE.map((r) => <option key={r} value={r}>{r}</option>)}
                            </Select>
                        </div>
                        <Button type="submit" disabled={add.isPending || !email.trim()}>
                            {add.isPending ? 'Adding…' : 'Add'}
                        </Button>
                    </form>
                    {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
                </Card>
            )}

            <Card>
                <h2 className="text-sm font-semibold text-ink">Members</h2>
                {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
                {isLoading ? (
                    <p className="mt-3 text-sm text-muted">Loading…</p>
                ) : (
                    <ul className="mt-3 divide-y divide-line">
                        {members?.map((m) => (
                            <li key={m.user_id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium text-ink">
                                        {m.full_name || m.email}
                                        {m.user_id === user?.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                                    </p>
                                    <p className="text-xs text-muted">{m.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canUpdate && m.role !== 'owner' ? (
                                        <Select
                                            className="py-1"
                                            value={m.role}
                                            onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value as Role })}
                                        >
                                            {ASSIGNABLE.map((r) => <option key={r} value={r}>{r}</option>)}
                                        </Select>
                                    ) : (
                                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${roleColor[m.role] ?? ''}`}>
                                            {m.role}
                                        </span>
                                    )}
                                    {canRemove && m.role !== 'owner' && (
                                        <Button variant="ghost" className="px-2 py-1 text-xs"
                                            onClick={() => remove.mutate(m.user_id)}>
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card>
                <h2 className="text-sm font-semibold text-ink">Members</h2>
                {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
                {isLoading ? (
                    <p className="mt-3 text-sm text-muted">Loading…</p>
                ) : (
                    <ul className="mt-3 divide-y divide-line">
                        {members?.map((m) => (
                            <li key={m.user_id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium text-ink">
                                        {m.full_name || m.email}
                                        {m.user_id === user?.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                                    </p>
                                    <p className="text-xs text-muted">{m.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canUpdate && m.role !== 'owner' ? (
                                        <Select
                                            className="py-1"
                                            value={m.role}
                                            onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value as Role })}
                                        >
                                            {ASSIGNABLE.map((r) => <option key={r} value={r}>{r}</option>)}
                                        </Select>
                                    ) : (
                                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${roleColor[m.role] ?? ''}`}>
                                            {m.role}
                                        </span>
                                    )}
                                    {canRemove && m.role !== 'owner' && (
                                        <Button variant="ghost" className="px-2 py-1 text-xs"
                                            onClick={() => remove.mutate(m.user_id)}>
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <BoardsPanel teamId={id} role={myRole} />
        </div>
    )
}


