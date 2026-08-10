import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import authz
import rbac
from security import current_user_id

# Global router instance
router = APIRouter(prefix="/tasks",tags=["tasks"])

# MODELS
class CreateTask(BaseModel):
    board_id: uuid.UUID
    title: str
    description: str | None = None
    

class UpdateTask(BaseModel):
    title: str | None = None
    description: str | None = None
    status: Literal["todo", "in_progress", "done"] | None = None


class AssignTask(BaseModel):
    assignee_id: uuid.UUID | None = None # null means unassign


# response format
class TaskOut(BaseModel):
    id: uuid.UUID
    board_id: uuid.UUID
    title: str
    description: str | None
    status: str
    assignee_id: uuid.UUID | None
    created_by: uuid.UUID


#  HELPERS

async def _board_team_id_or_404(pool, board_id: uuid.UUID) -> uuid.UUID:
    """team_id of a LIVE board, else 404 not found"""
    team_id = await pool.fetchval(
        "SELECT team_id FROM boards WHERE id = $1 AND deleted_at IS NULL",
        board_id,
    )
    if team_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )
    return team_id

async def _task_or_404(pool, task_id: uuid.UUID):
    """
    Load a live task + Its board's team_id, or 404 if either is missing.
    A task under a solf deleted board is treated as gone.
    """
    row = await pool.fetchrow(
        """
        SELECT t.id, t.board_id, t.title, t.description, t.status, t.assignee_id, t.created_by, b.team_id
        FROM tasks t
        JOIN boards b ON t.board_id = b.id
        WHERE t.id = $1 AND t.deleted_at IS NULL AND b.deleted_at IS NULL
        """, task_id
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return row

def _to_out(row) -> TaskOut:
    d = dict(row)
    d.pop('team_id', None) # Internal; not part of the API shape

    return TaskOut(**d)


# ENDPOINTS
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    body: CreateTask,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> TaskOut:
    pool = request.app.state.pool

    team_id = await _board_team_id_or_404(pool, body.board_id)

    await authz.require_permission(pool, user_id, team_id, rbac.TASK_CREATE)

    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")

    row = await pool.fetchrow(
        """
        INSERT INTO tasks (board_id, title, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, board_id, title, description, status, assignee_id, created_by
        """,
        body.board_id, title, body.description, user_id,
    )

    return _to_out(row)

@router.get("")
async def list_tasks(
    board_id: uuid.UUID,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> dict:
    pool = request.app.state.pool # postgres pool
    team_id = await _board_team_id_or_404(pool, board_id)

    await authz.require_permission(pool, user_id, team_id, rbac.TASK_VIEW)

    # List active tasks for this board
    rows = await pool.fetch(
        """
        SELECT id, board_id, title, description, status, assignee_id, created_by
        FROM tasks
        WHERE board_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        """, board_id
    )

    return {"tasks": [dict(r) for r in rows]}
    
@router.get("/{task_id}")
async def get_task(
    task_id: uuid.UUID,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> TaskOut:
    pool = request.app.state.pool

    row = await _task_or_404(pool, task_id)

    team_id = row["team_id"]
    await authz.require_permission(pool, user_id, team_id, rbac.TASK_VIEW)

    return _to_out(row)

@router.patch("/{task_id}")
async def update_task(
    task_id: uuid.UUID,
    body: UpdateTask,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> TaskOut:
    pool = request.app.state.pool

    row = await _task_or_404(pool, task_id)

    team_id = row["team_id"]
    await authz.require_permission(pool, user_id, team_id, rbac.TASK_UPDATE)

    title = body.title.strip() if body.title is not None else None
    if title is not None and not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title cannot be empty")

    
    updated = await pool.fetchrow(
        """
        UPDATE tasks
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4::task_status, status),
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, board_id, title, description, status, assignee_id, created_by    
        """,
        task_id, title, body.description, body.status,
    )

    return _to_out(updated)

@router.patch("/{task_id}/assign")
async def assign_task(
    task_id: uuid.UUID,
    body: AssignTask,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> TaskOut:
    pool = request.app.state.pool

    row = await _task_or_404(pool, task_id)

    team_id = row["team_id"]
    await authz.require_permission(pool, user_id, team_id, rbac.TASK_ASSIGN)

    # business rule: assignee must belong to the task's team (skip when unassigning)
    assignee_id = body.assignee_id
    if assignee_id is not None:
        assignee_role = await authz.role_in_team(pool, team_id, assignee_id)
        if assignee_role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee is not a member of this team",
            )

    updated = await pool.fetchrow(
        """
        UPDATE tasks
        SET assignee_id = $2,
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, board_id, title, description, status, assignee_id, created_by    
        """,
        task_id, assignee_id,
    )

    return _to_out(updated)

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> None:
    pool = request.app.state.pool

    row = await _task_or_404(pool, task_id)

    team_id = row["team_id"]
    await authz.require_permission(pool, user_id, team_id, rbac.TASK_DELETE)

    await pool.execute(
        """
        UPDATE tasks
        SET deleted_at = now(), 
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        """, task_id,
    )