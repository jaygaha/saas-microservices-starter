import uuid

from fastapi import status, HTTPException
from asyncpg import Pool

import rbac

async def role_in_team(pool: Pool, team_id: uuid.UUID, user_id: uuid.UUID) -> str | None:
    """
    Caller's role in the team, or None. THE one place task-service reads auth-service's team_members table
    """
    role = await pool.fetchval(
        """
        SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2
        """,
        team_id,
        user_id
    )

    return role

async def require_permission(pool, user_id: uuid.UUID, team_id: uuid.UUID, perm: str) -> str:
    """
    Resolve role + enforce a permission (403 if not a member or not allowed).
    """
    role = await role_in_team(pool, team_id, user_id)
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a member of this team")
    if not rbac.can(role, perm):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "insufficient permissions")
    
    return role


    