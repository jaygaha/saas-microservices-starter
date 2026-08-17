import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listBoards, createBoard, updateBoard, deleteBoard } from '../lib/boards'
import { can, P } from '../lib/rbac'
import { ApiError } from '../lib/api'
import type { Board, Role } from '../types'
import { Button, Card, Input, Modal, ConfirmModal } from './ui'

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
    const [renaming, setRenaming] = useState<Board | null>(null)
    const [deleting, setDeleting] = useState<Board | null>(null)
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
                                        onClick={() => setRenaming(b)}>Rename</Button>
                                )}
                                {canDelete && (
                                    <Button variant="danger" className="px-2 py-1 text-xs"
                                        onClick={() => setDeleting(b)}>Delete</Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-sm text-muted">No boards yet.</p>
            )}

            {renaming && (
                <RenameBoardModal
                    board={renaming}
                    saving={update.isPending}
                    onClose={() => setRenaming(null)}
                    onSave={(nm) => update.mutate({ id: renaming.id, name: nm }, { onSuccess: () => setRenaming(null) })}
                />
            )}
            {deleting && (
                <ConfirmModal
                    open
                    danger
                    title="Delete board"
                    message={`Delete "${deleting.name}"? This can't be undone.`}
                    confirmLabel="Delete"
                    busy={remove.isPending}
                    onClose={() => setDeleting(null)}
                    onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
                />
            )}
        </Card>
    )
}

function RenameBoardModal({
    board,
    saving,
    onClose,
    onSave,
}: {
    board: Board
    saving: boolean
    onClose: () => void
    onSave: (name: string) => void
}) {
    const [name, setName] = useState(board.name)
    const ok = name.trim() && name.trim() !== board.name

    function onSubmit(ev: SubmitEvent) {
        ev.preventDefault()
        if (ok) onSave(name.trim())
        else onClose()
    }

    return (
        <Modal open title="Rename board" onClose={onClose}>
            <form onSubmit={onSubmit}>
                <Input
                    autoFocus
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Roadmap"
                    disabled={saving}
                />
                <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={!ok || saving}>
                        {saving ? 'Saving…' : 'Rename'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}