import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBoard } from '../lib/boards'
import { listTeams, listMembers } from '../lib/teams'
import { listTasks, createTask, updateTask, assignTask, deleteTask } from '../lib/tasks'
import type { TaskPatch } from '../lib/tasks'
import { can, P } from '../lib/rbac'
import { ApiError } from '../lib/api'
import type { Task, TaskStatus } from '../types'
import { Button, Card, Input, Modal, ConfirmModal } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const COLUMNS: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
]

export function BoardDetail() {

    const { teamId = '', boardId = '' } = useParams()
    const qc = useQueryClient()

    const { data: board, isLoading, error } = useQuery({
        queryKey: ['board', boardId],
        queryFn: () => getBoard(boardId),
        enabled: !!boardId,
    })

    useDocumentTitle(board?.name ?? 'Board')

    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: listTeams })
    const role = teams?.find((t) => t.id === board?.team_id)?.role


    const { data: members } = useQuery({
        queryKey: ['members', board?.team_id],
        queryFn: () => listMembers(board!.team_id),
        enabled: !!board?.team_id,
    })

    const { data: tasks } = useQuery({
        queryKey: ['tasks', boardId],
        queryFn: () => listTasks(boardId),
        enabled: !!boardId,
    })

    const canCreate = can(role, P.TASK_CREATE)
    const canUpdate = can(role, P.TASK_UPDATE)
    const canAssign = can(role, P.TASK_ASSIGN)
    const canDelete = can(role, P.TASK_DELETE)

    const [title, setTitle] = useState('')
    const [desc, setDesc] = useState('')
    const [actionError, setActionError] = useState<string | null>(null)
    const [editing, setEditing] = useState<Task | null>(null)
    const [deletingTask, setDeletingTask] = useState<Task | null>(null)

    const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks', boardId] })
    const onErr = (e: unknown, f: string) => setActionError(e instanceof ApiError ? e.message : f)

    const create = useMutation({
        mutationFn: () => createTask(boardId, title.trim(), desc.trim() || undefined),
        onSuccess: () => { setTitle(''); setDesc(''); setActionError(null); invalidate() },
        onError: (e) => onErr(e, 'Could not create task'),
    })
    const patch = useMutation({
        mutationFn: (v: { id: string; patch: TaskPatch }) => updateTask(v.id, v.patch),
        onSuccess: () => { setActionError(null); invalidate() },
        onError: (e) => onErr(e, 'Could not update task'),
    })
    const assign = useMutation({
        mutationFn: (v: { id: string; assigneeId: string | null }) => assignTask(v.id, v.assigneeId),
        onSuccess: () => { setActionError(null); invalidate() },
        onError: (e) => onErr(e, 'Could not assign task'),
    })
    const remove = useMutation({
        mutationFn: (id: string) => deleteTask(id),
        onSuccess: () => { setActionError(null); invalidate() },
        onError: (e) => onErr(e, 'Could not delete task'),
    })

    function onCreate(e: SubmitEvent) {
        e.preventDefault()
        if (title.trim()) create.mutate()
    }

    if (isLoading) return <p className="text-sm text-muted">Loading…</p>
    if (error) return <p className="text-sm text-red-600">Board not found, or you don't have access.</p>

    const byStatus = (s: TaskStatus) => (tasks ?? []).filter((t) => t.status === s)

    return (
        <div className="space-y-6">
            <div>
                <Link to={`/teams/${teamId}`} className="text-sm text-muted hover:text-brand">← Back to team</Link>
                <h1 className="mt-1 text-xl font-semibold text-ink">{board?.name}</h1>
            </div>

            {canCreate && (
                <Card>
                    <h2 className="text-sm font-semibold text-ink">New task</h2>
                    <form onSubmit={onCreate} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Input label="Title" placeholder="e.g. Draft the spec"
                                value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>
                        <div className="flex-1">
                            <Input label="Description (optional)" placeholder="Details…"
                                value={desc} onChange={(e) => setDesc(e.target.value)} />
                        </div>
                        <Button type="submit" disabled={create.isPending || !title.trim()}>
                            {create.isPending ? 'Adding…' : 'Add task'}
                        </Button>
                    </form>
                </Card>
            )}

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            <div className="grid gap-4 sm:grid-cols-3">
                {COLUMNS.map((col) => {
                    const items = byStatus(col.value)
                    return (
                        <div key={col.value} className="rounded-lg bg-canvas p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-ink">{col.label}</h3>
                                <span className="text-xs text-muted">{items.length}</span>
                            </div>
                            <div className="space-y-2">
                                {items.map((t) => (
                                    <TaskCard
                                        key={t.id}
                                        task={t}
                                        members={members ?? []}
                                        canUpdate={canUpdate}
                                        canAssign={canAssign}
                                        canDelete={canDelete}
                                        onStatus={(id, status) => patch.mutate({ id, patch: { status } })}
                                        onAssign={(id, assigneeId) => assign.mutate({ id, assigneeId })}
                                        onEdit={(t) => setEditing(t)}
                                        onDelete={(t) => setDeletingTask(t)}
                                    />
                                ))}
                                {items.length === 0 && <p className="text-xs text-muted">No tasks.</p>}
                            </div>
                        </div>
                    )
                })}
            </div>

            {editing && (
                <EditTaskModal
                    task={editing}
                    saving={patch.isPending}
                    onClose={() => setEditing(null)}
                    onSave={(p) =>
                        patch.mutate({ id: editing.id, patch: p }, { onSuccess: () => setEditing(null) })
                    }
                />
            )}

            {deletingTask && (
                <ConfirmModal
                    open
                    danger
                    title="Delete task"
                    message={`Delete task "${deletingTask.title}"? This action cannot be undone.`}
                    busy={remove.isPending}
                    onClose={() => setDeletingTask(null)}
                    onConfirm={() => remove.mutate(deletingTask.id, { onSuccess: () => setDeletingTask(null) })}
                />
            )}

        </div>
    )
}

function EditTaskModal({
    task,
    saving,
    onClose,
    onSave,
}: {
    task: Task
    saving: boolean
    onClose: () => void
    onSave: (patch: TaskPatch) => void
}) {
    const [title, setTitle] = useState(task.title)
    const [desc, setDesc] = useState(task.description ?? '')

    function submit(e: SubmitEvent) {
        e.preventDefault()
        if (!title.trim()) return
        onSave({ title: title.trim(), description: desc.trim() })
    }

    return (
        <Modal open onClose={onClose} title="Edit task">
            <form onSubmit={submit} className="space-y-3">
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                <Input label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={saving || !title.trim()}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
