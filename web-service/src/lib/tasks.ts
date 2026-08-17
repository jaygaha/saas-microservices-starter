import { api } from './api';
import type { Task, TaskStatus } from '../types';

export async function listTasks(boardId: string): Promise<Task[]> {
    const res = await api<{ tasks: Task[] }>(`/tasks/tasks?board_id=${boardId}`)

    return res.tasks
}

export async function createTask(
    boardId: string, title: string, description?: string,
): Promise<Task> {
    return api<Task>('/tasks/tasks', {
        method: 'POST',
        body: { board_id: boardId, title, description: description || null },
    })
}

export interface TaskPatch {
    title?: string
    description?: string | null
    status?: TaskStatus
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
    return api<Task>(`/tasks/tasks/${id}`, { method: 'PATCH', body: patch })
}

export async function assignTask(id: string, assigneeId: string | null): Promise<Task> {
    return api<Task>(`/tasks/tasks/${id}/assign`, {
        method: 'PATCH', body: { assignee_id: assigneeId },
    })
}

export async function deleteTask(id: string): Promise<void> {
    await api(`/tasks/tasks/${id}`, { method: 'DELETE' })
}