import uuid

from fastapi import APIRouter, Depends, Request
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
    
