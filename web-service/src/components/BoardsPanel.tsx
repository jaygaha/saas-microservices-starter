import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listBoards, createBoard, updateBoard, deleteBoard } from '../lib/boards'
import { can, P } from '../lib/rbac'
import { ApiError } from '../lib/api'
import type { Role } from '../types'
import { Button, Card, Input } from './ui'

export function BoardsPanel({ teamId, role }: { teamId: string; role: Role | undefined }) {
    const qc = useQueryClient()
    const { data: boards, isLoading } = useQuery({
        queryKey: ["boards", teamId],
        queryFn: () => listBoards(teamId)
    })


    const canCreate = can(role, P.BOARD_CREATE)
    const canUpdate = can(role, P.BOARD_UPDATE)
    const canDelete = can(role, P.BOARD_DELETE)

    const [name, setName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const invalidated = () => qc.invalidateQueries({ queryKey: ["boards", teamId] })
    const msg = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f)

    const create = useMutation({
        mutationFn: () => createBoard(teamId, name.trim()),
        onSuccess: () => { setName(''); setError(null); invalidated() },
        onError: (e) => { setError(msg(e, 'Could not create board. Please try again.')) }
    })

    const update = useMutation({
        mutationFn: (v: { id: string, name: string }) => updateBoard(v.id, v.name),
        onSuccess: () => { setError(null); invalidated() },
        onError: (e) => { setError(msg(e, 'Could not rename board. Please try again.')) }
    })

    const remove = useMutation({
        mutationFn: (id: string) => deleteBoard(id),
        onSuccess: () => { setError(null); invalidated() },
        onError: (e) => { setError(msg(e, 'Could not delete board. Please try again.')) }
    })

    function onCreate(ev: SubmitEvent) {
        ev.preventDefault()
        if (name.trim()) create.mutate()
    }

    function onUpdate(id: string, currentName: string) {
        const next = window.prompt('Board name', currentName);
        if (next && next.trim() && next.trim() !== currentName) update.mutate({ id, name: next.trim() })
    }

    function onDelete(id: string, name: string) {
        if (window.confirm(`Delete board "${name}"? This can't be undone.`)) remove.mutate(id);
    }

    return (
        <Card>
            <h2 className="text-sm font-semibold text-ink">Boards</h2>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            {canCreate && (
                <form onSubmit={onCreate} className="mt-3 flex items-end gap-2">
                    <div className="flex-1">
                        <Input label="New board" placeholder="e.g. Roadmap"
                            value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={create.isPending || !name.trim()}>
                        {create.isPending ? 'Creating…' : 'Create'}
                    </Button>
                </form>
            )}

            {isLoading ? (
                <p className="mt-3 text-sm text-muted">Loading…</p>
            ) : boards && boards.length > 0 ? (
                <ul className="mt-3 divide-y divide-line">
                    {boards.map((b) => (
                        <li key={b.id} className="flex items-center justify-between py-3">
                            <Link to={`/teams/${teamId}/boards/${b.id}`}
                                className="text-sm font-medium text-ink hover:text-brand">
                                {b.name}
                            </Link>
                            <div className="flex items-center gap-2">
                                {canUpdate && (
                                    <Button variant="ghost" className="px-2 py-1 text-xs"
                                        onClick={() => onUpdate(b.id, b.name)}>Rename</Button>
                                )}
                                {canDelete && (
                                    <Button variant="ghost" className="px-2 py-1 text-xs"
                                        onClick={() => onDelete(b.id, b.name)}>Delete</Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-sm text-muted">No boards yet.</p>
            )}
        </Card>
    )
}