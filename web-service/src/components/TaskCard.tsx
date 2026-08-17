import type { Member, Task, TaskStatus } from '../types'
import { Button, Select } from './ui'

const STATUSES: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
]

export function TaskCard({
    task, members, canUpdate, canAssign, canDelete, onStatus, onAssign, onEdit, onDelete,
}: {
    task: Task
    members: Member[]
    canUpdate: boolean
    canAssign: boolean
    canDelete: boolean
    onStatus: (id: string, status: TaskStatus) => void
    onAssign: (id: string, assigneeId: string | null) => void
    onEdit: (task: Task) => void
    onDelete: (task: Task) => void
}) {
    const assignee = members.find((m) => m.user_id === task.assignee_id)
    const assigneeLabel = assignee ? assignee.full_name || assignee.email : '—'

    return (
        <div className="rounded-lg border border-line bg-surface p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink">{task.title}</p>
                {canDelete && (
                    <button onClick={() => onDelete(task)}
                        className="text-xs text-muted hover:text-red-600" aria-label="Delete task">✕</button>
                )}
            </div>

            {task.description && <p className="mt-1 text-xs text-muted">{task.description}</p>}

            <div className="mt-3 space-y-2">
                {canUpdate ? (
                    <Select className="py-1 text-xs" value={task.status}
                        onChange={(e) => onStatus(task.id, e.target.value as TaskStatus)}>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                ) : (
                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-muted">
                        {STATUSES.find((s) => s.value === task.status)?.label ?? task.status}
                    </span>
                )}

                {canAssign ? (
                    <Select className="py-1 text-xs" value={task.assignee_id ?? ''}
                        onChange={(e) => onAssign(task.id, e.target.value || null)}>
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>
                        ))}
                    </Select>
                ) : (
                    <p className="text-xs text-muted">Assignee: {assigneeLabel}</p>
                )}
            </div>

            {canUpdate && (
                <div className="mt-3">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onEdit(task)}>
                        Edit
                    </Button>
                </div>
            )}
        </div>
    )
}
