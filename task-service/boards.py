import uuid

from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel

import authz
import rbac
from security import current_user_id

router = APIRouter(prefix="/boards", tags=["boards"])

# models
class CreateBoard(BaseModel):
    team_id: uuid.UUID
    name: str

class BoardOut(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    name: str
    created_by: uuid.UUID

class UpdateBoard(BaseModel):
    name: str
    
@router.post("", status_code=201)
async def create_board(
    body: CreateBoard,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
    
) -> BoardOut:
    pool = request.app.state.pool
    await authz.require_permission(pool, user_id, body.team_id, rbac.BOARD_CREATE)

    row = await pool.fetchrow(
        """
        INSERT INTO boards (team_id, name, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, team_id, name, created_by
        """,
        body.team_id,
        body.name.strip(),
        user_id,
    )
    return BoardOut(**dict(row))
    
@router.get("")
async def list_boards(
    team_id: uuid.UUID,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> dict:
    pool = request.app.state.pool
    await authz.require_permission(pool, user_id, team_id, rbac.BOARD_VIEW)

    rows = await pool.fetch(
        """
        SELECT id, team_id, name, created_by
        FROM boards
        WHERE team_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        """,
        team_id,
    )

    return {"boards": [dict(r) for r in rows]}

@router.get("/{board_id}")
async def get_board(
    board_id: uuid.UUID,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> BoardOut:
    pool = request.app.state.pool
    row = await _get_board_or_404(pool, board_id)
    await authz.require_permission(pool, user_id, row["team_id"], rbac.BOARD_VIEW)
    
    return BoardOut(**dict(row))

@router.patch("/{board_id}")
async def update_board(
    board_id: uuid.UUID,
    body: UpdateBoard,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
) -> BoardOut:
    pool = request.app.state.pool
    row = await _get_board_or_404(pool, board_id)
    await authz.require_permission(pool, user_id, row["team_id"], rbac.BOARD_UPDATE)

    name = body.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Board name is required",
        )

    row = await pool.fetchrow(
        """
        UPDATE boards
        SET name = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, team_id, name, created_by
        """,
        board_id,
        name,
    )
    
    return BoardOut(**dict(row))

@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: uuid.UUID,
    request: Request,
    user_id: uuid.UUID = Depends(current_user_id),
):
    pool = request.app.state.pool
    row = await _get_board_or_404(pool, board_id)
    await authz.require_permission(pool, user_id, row["team_id"], rbac.BOARD_DELETE)

    await pool.execute(
        """
        UPDATE boards
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        """,
        board_id,
    )
    # 204 no content is returned when a resource is deleted successfully so no need to return anything

# Helpers
async def _get_board_or_404(pool, board_id: uuid.UUID):
    """Load a live board or raise 404"""
    row = await pool.fetchrow(
        """
        SELECT id, team_id, name, created_by
        FROM boards
        WHERE id = $1 AND deleted_at IS NULL
        """,
        board_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    
    return row
