import uuid

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)

def current_user_id (
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer)
) -> uuid.UUID:
    """
    Verify the Bearer access token(same JWT_SECRET as auth-service) -> user id
    """
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Auth token is required")

    try:
        claims = jwt.decode(
            creds.credentials,
            request.app.state.config.jwt_secret,
            algorithms=["HS256"]
            )
    except jwt.PyJWTError as ex:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {ex}")
    
    try:
        return uuid.UUID(claims["sub"])
    except (KeyError, ValueError, TypeError) as ex:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {ex}")



