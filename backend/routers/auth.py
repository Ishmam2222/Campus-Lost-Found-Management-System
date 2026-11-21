from typing import Annotated, Optional
from fastapi import APIRouter, Cookie, Request, Response, status

import crud
from database import SessionDep
from models import AuthResponse, SessionRead, UserCreate, UserLogin
from security import (
    ACCESS_TOKEN_EXPIRE_SECONDS,
    REFRESH_TOKEN_EXPIRE_SECONDS,
    CurrentUserDep,
    OptionalUserDep,
    hash_refresh_token,
)
import service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_SECONDS,
        path="/",
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_SECONDS,
        path="/",
        httponly=True,
        samesite="lax",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new campus user account",
)
def register(
    data: UserCreate,
    request: Request,
    response: Response,
    session: SessionDep,
) -> AuthResponse:
    auth_res, raw_refresh = service.register_user(session, data, request)
    _set_auth_cookies(response, auth_res.access_token, raw_refresh)
    return auth_res


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sign up a new campus user account (alias)",
)
def signup(
    data: UserCreate,
    request: Request,
    response: Response,
    session: SessionDep,
) -> AuthResponse:
    auth_res, raw_refresh = service.register_user(session, data, request)
    _set_auth_cookies(response, auth_res.access_token, raw_refresh)
    return auth_res


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in with email and password",
)
def login(
    credentials: UserLogin,
    request: Request,
    response: Response,
    session: SessionDep,
) -> AuthResponse:
    auth_res, raw_refresh = service.authenticate_user(
        session, credentials, request
    )
    _set_auth_cookies(response, auth_res.access_token, raw_refresh)
    return auth_res


@router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Rotate refresh token cookie and issue a new short-lived JWT",
)
def refresh_token(
    request: Request,
    response: Response,
    session: SessionDep,
    refresh_cookie: Annotated[
        Optional[str], Cookie(alias="refresh_token")
    ] = None,
) -> AuthResponse:
    auth_res, new_raw_refresh = service.refresh_user_session(
        session, refresh_cookie, request
    )
    _set_auth_cookies(response, auth_res.access_token, new_raw_refresh)
    return auth_res


@router.post(
    "/logout",
    summary="Log out and revoke the active session",
)
def logout(
    request: Request,
    response: Response,
    session: SessionDep,
    current_user: OptionalUserDep = None,
    refresh_cookie: Annotated[
        Optional[str], Cookie(alias="refresh_token")
    ] = None,
) -> dict[str, str]:
    service.logout_session(session, refresh_cookie, current_user, request)
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get(
    "/sessions",
    response_model=list[SessionRead],
    summary="List active login sessions for the current user",
)
def list_sessions(
    session: SessionDep,
    current_user: CurrentUserDep,
    refresh_cookie: Annotated[
        Optional[str], Cookie(alias="refresh_token")
    ] = None,
) -> list[SessionRead]:
    return service.get_active_sessions_for_user(
        session, current_user, refresh_cookie
    )


@router.delete(
    "/sessions/{session_id}",
    summary="Revoke a specific login session",
)
def revoke_session(
    session_id: int,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, str]:
    service.revoke_single_session(session, current_user, session_id, request)
    return {"message": "Session revoked"}


@router.post(
    "/sessions/revoke-others",
    summary="Revoke all other login sessions except the current device",
)
def revoke_other_sessions(
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
    refresh_cookie: Annotated[
        Optional[str], Cookie(alias="refresh_token")
    ] = None,
) -> dict[str, int]:
    assert current_user.id is not None
    exclude = hash_refresh_token(refresh_cookie) if refresh_cookie else None
    count = crud.revoke_user_sessions(
        session, current_user.id, exclude_token_hash=exclude
    )
    service.log_event(
        session,
        request,
        action="session_revoke",
        detail=f"Revoked {count} other session(s)",
        user=current_user,
        entity_type="session",
    )
    return {"revoked": count}


@router.post(
    "/sessions/revoke-all",
    summary="Revoke all sessions across all devices and log out",
)
def revoke_all_sessions(
    request: Request,
    response: Response,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, int]:
    assert current_user.id is not None
    count = crud.revoke_user_sessions(session, current_user.id)
    service.log_event(
        session,
        request,
        action="session_revoke",
        detail=f"Revoked all {count} session(s)",
        user=current_user,
        entity_type="session",
    )
    _clear_auth_cookies(response)
    return {"revoked": count}
