# Board/task permissions: mirror of auth-service's internal/rbac catalog.
BOARD_VIEW = "board.view"
BOARD_CREATE = "board.create"
BOARD_UPDATE = "board.update"
BOARD_DELETE = "board.delete"
TASK_VIEW = "task.view"
TASK_CREATE = "task.create"
TASK_UPDATE = "task.update"
TASK_DELETE = "task.delete"
TASK_ASSIGN = "task.assign"

_ALL = {
    BOARD_VIEW,
    BOARD_CREATE,
    BOARD_UPDATE,
    BOARD_DELETE,
    TASK_VIEW,
    TASK_CREATE,
    TASK_UPDATE,
    TASK_DELETE,
    TASK_ASSIGN,
}

_ROLE_PERMS: dict[str, set[str]] = {
    "owner": _ALL,
    "admin": _ALL,
    "member": {BOARD_VIEW, BOARD_CREATE, BOARD_UPDATE,
               TASK_VIEW, TASK_CREATE, TASK_UPDATE, TASK_DELETE, TASK_ASSIGN},
    "viewer": {BOARD_VIEW, TASK_VIEW,}
}

def can(role: str, permission: str) -> bool:
    return permission in _ROLE_PERMS.get(role, set())
