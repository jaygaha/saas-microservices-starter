// src/lib/boards.ts: board API (task-service)
import { api } from './api';
import type { Board } from '../types';


export async function listBoards(teamId: string): Promise<Board[]> {
    const data = await api<{ boards: Board[] }>(`/tasks/boards?team_id=${teamId}`);

    return data.boards;
}

export async function createBoard(teamId: string, name: string): Promise<Board> {
    return api<Board>('/tasks/boards', { method: 'POST', body: { team_id: teamId, name } });
}

export async function getBoard(boardId: string): Promise<Board> {
    return api<Board>(`/tasks/boards/${boardId}`);
}

export async function updateBoard(boardId: string, name: string): Promise<Board> {
    return api<Board>(`/tasks/boards/${boardId}`, { method: 'PATCH', body: { name } });
}

export async function deleteBoard(boardId: string): Promise<void> {
    await api(`/tasks/boards/${boardId}`, { method: 'DELETE' });
}
