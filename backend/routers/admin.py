from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse

import crud
from database import SessionDep
from models import (
    ActivityLogRead,
    AdminStats,
    BanRequest,
    BulkItemIdsRequest,
    BulkUserIdsRequest,
    GroupRead,
    ItemRead,
    RoleUpdate,
    SecuritySummary,
    User,
    UserDetailView,
    UserPage,
    UserRead,
)
from rbac import AdminUserDep, Permission, require_permission
import service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get(
    "/stats",
    response_model=AdminStats,
    summary="Get system-wide statistics including 7-day trends (Admin only)",
)
def get_stats(session: SessionDep, _admin: AdminUserDep) -> AdminStats:
    return service.get_admin_stats(session)


@router.get(
    "/users",
    response_model=UserPage,
    summary="List users with search, role/status filters, and pagination",
)
def list_users(
    session: SessionDep,
    _admin: AdminUserDep,
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> UserPage:
    return service.get_paginated_users(
        session=session,
        search=search,
        role=role,
        status_filter=status,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/users/{user_id}",
    response_model=UserDetailView,
    summary="Inspect a user's records, groups, sessions, and recent activity",
)
def get_user_detail(
    user_id: int,
    session: SessionDep,
    _admin: AdminUserDep,
) -> UserDetailView:
    return service.get_user_detail_view(session, user_id)


@router.patch(
    "/users/{user_id}/role",
    response_model=UserRead,
    summary="Change a user's role between user and admin",
)
def update_user_role(
    user_id: int,
    data: RoleUpdate,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_USERS_MANAGE))
    ],
) -> User:
    return service.change_user_role(
        session, admin_user, user_id, data.role, request
    )


@router.post(
    "/users/{user_id}/ban",
    response_model=UserRead,
    summary="Ban a malicious user account with a reason",
)
def ban_user(
    user_id: int,
    data: BanRequest,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_USERS_MANAGE))
    ],
) -> User:
    return service.ban_user_account(
        session, admin_user, user_id, data.reason, request
    )


@router.post(
    "/users/{user_id}/unban",
    response_model=UserRead,
    summary="Unban a suspended user account",
)
def unban_user(
    user_id: int,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_USERS_MANAGE))
    ],
) -> User:
    return service.unban_user_account(session, admin_user, user_id, request)


@router.post(
    "/users/{user_id}/revoke-sessions",
    summary="Force-revoke all active sessions of a user",
)
def revoke_user_sessions_admin(
    user_id: int,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_USERS_MANAGE))
    ],
) -> dict[str, int]:
    count = crud.revoke_user_sessions(session, user_id)
    service.log_event(
        session,
        request,
        action="session_revoke",
        detail=f"Admin revoked {count} session(s) for user #{user_id}",
        user=admin_user,
        entity_type="user",
        entity_id=user_id,
    )
    return {"revoked": count}


@router.post(
    "/users/bulk-ban",
    summary="Bulk ban up to 50 users at once",
)
def bulk_ban(
    data: BulkUserIdsRequest,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_USERS_MANAGE))
    ],
) -> dict[str, int]:
    return service.bulk_ban_users(
        session, admin_user, data.user_ids, data.reason, request
    )


@router.post(
    "/users/bulk-unban",
    summary="Bulk unban up to 50 users at once",
)
def bulk_unban(
    data: BulkUserIdsRequest,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_USERS_MANAGE))
    ],
) -> dict[str, int]:
    return service.bulk_unban_users(
        session, admin_user, data.user_ids, request
    )


@router.get(
    "/items",
    response_model=list[ItemRead],
    summary="List all reports for content moderation",
)
def list_all_items_admin(
    session: SessionDep,
    _admin: Annotated[
        User, Depends(require_permission(Permission.ADMIN_CONTENT_MODERATE))
    ],
    type: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    return service.list_reports(
        session=session,
        type_filter=type,
        category=category,
        status_filter=status,
        search=search,
    )


@router.post(
    "/items/bulk-delete",
    summary="Bulk delete up to 50 reports at once",
)
def bulk_delete_items(
    data: BulkItemIdsRequest,
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_CONTENT_MODERATE))
    ],
) -> dict[str, int]:
    return service.bulk_delete_items(
        session, admin_user, data.item_ids, request
    )


@router.get(
    "/groups",
    response_model=list[GroupRead],
    summary="List all recovery groups for content moderation",
)
def list_all_groups_admin(
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_CONTENT_MODERATE))
    ],
) -> list[GroupRead]:
    return service.list_my_groups(session, admin_user)


@router.get(
    "/activity",
    response_model=list[ActivityLogRead],
    summary="View audit log of authentication, RBAC, and moderation events",
)
def list_activity(
    session: SessionDep,
    _admin: Annotated[
        User, Depends(require_permission(Permission.ADMIN_AUDIT_VIEW))
    ],
    action: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=150, ge=1, le=500),
):
    return crud.list_activity_logs(
        session, action_filter=action, search=search, limit=limit
    )


@router.get(
    "/security",
    response_model=SecuritySummary,
    summary="Get security view: failed logins by IP/account and security alerts",
)
def get_security_view(
    session: SessionDep,
    _admin: Annotated[
        User, Depends(require_permission(Permission.ADMIN_AUDIT_VIEW))
    ],
) -> SecuritySummary:
    return service.get_security_summary(session)


@router.get(
    "/export/users",
    response_class=PlainTextResponse,
    summary="Export filtered users list as CSV",
)
def export_users(
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_EXPORT))
    ],
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
) -> PlainTextResponse:
    csv_text = service.export_users_csv(
        session, admin_user, search=search, role=role, status_filter=status, request=request
    )
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"},
    )


@router.get(
    "/export/items",
    response_class=PlainTextResponse,
    summary="Export filtered reports list as CSV",
)
def export_items(
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_EXPORT))
    ],
    type: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
) -> PlainTextResponse:
    csv_text = service.export_items_csv(
        session, admin_user, type_filter=type, category=category, search=search, request=request
    )
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=items_export.csv"},
    )


@router.get(
    "/export/activity",
    response_class=PlainTextResponse,
    summary="Export filtered activity audit log as CSV",
)
def export_activity(
    request: Request,
    session: SessionDep,
    admin_user: Annotated[
        User, Depends(require_permission(Permission.ADMIN_EXPORT))
    ],
    action: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
) -> PlainTextResponse:
    csv_text = service.export_activity_csv(
        session, admin_user, action_filter=action, search=search, request=request
    )
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_export.csv"},
    )
