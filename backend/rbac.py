"""
Centralized Role-Based Access Control (RBAC) Module.

Defines permission constants, role-to-permission mappings, FastAPI dependencies,
ownership enforcement (read, update, delete), and fine-grained group membership rules.
"""

from collections.abc import Callable
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from database import SessionDep
from models import DeskMember, Item, User
from security import CurrentUserDep, record_security_event


class Permission:
    """Fine-grained permission constants enforced across endpoints."""

    ITEM_READ_OWN = "item:read_own"
    ITEM_CREATE = "item:create"
    ITEM_UPDATE_OWN = "item:update_own"
    ITEM_DELETE_OWN = "item:delete_own"
    PROFILE_MANAGE = "profile:manage"
    GROUP_ACCESS = "group:access"
    ADMIN_DASHBOARD = "admin:dashboard"
    ADMIN_USERS_MANAGE = "admin:users_manage"
    ADMIN_CONTENT_MODERATE = "admin:content_moderate"
    ADMIN_AUDIT_VIEW = "admin:audit_view"
    ADMIN_EXPORT = "admin:export"


USER_PERMISSIONS: frozenset[str] = frozenset(
    {
        Permission.ITEM_READ_OWN,
        Permission.ITEM_CREATE,
        Permission.ITEM_UPDATE_OWN,
        Permission.ITEM_DELETE_OWN,
        Permission.PROFILE_MANAGE,
        Permission.GROUP_ACCESS,
    }
)

ADMIN_PERMISSIONS: frozenset[str] = USER_PERMISSIONS | frozenset(
    {
        Permission.ADMIN_DASHBOARD,
        Permission.ADMIN_USERS_MANAGE,
        Permission.ADMIN_CONTENT_MODERATE,
        Permission.ADMIN_AUDIT_VIEW,
        Permission.ADMIN_EXPORT,
    }
)

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "user": USER_PERMISSIONS,
    "member": USER_PERMISSIONS,
    "admin": ADMIN_PERMISSIONS,
}


def has_permission(user: User, permission: str) -> bool:
    """Return True if the user's role grants the requested permission."""
    allowed = ROLE_PERMISSIONS.get(user.role, USER_PERMISSIONS)
    return permission in allowed


def require_permission(permission: str) -> Callable[..., User]:
    """FastAPI dependency factory that enforces a specific RBAC permission."""

    def _dependency(
        request: Request,
        session: SessionDep,
        current_user: CurrentUserDep,
    ) -> User:
        if not has_permission(current_user, permission):
            record_security_event(
                session,
                request,
                "rbac_denied",
                f"Denied permission '{permission}' on {request.method} {request.url.path}",
                user_id=current_user.id,
                user_email=current_user.email,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: requires '{permission}'.",
            )
        return current_user

    return _dependency


AdminUserDep = Annotated[User, Depends(require_permission(Permission.ADMIN_DASHBOARD))]


def enforce_item_ownership(
    session: Session,
    request: Optional[Request],
    item: Item,
    current_user: Optional[User],
    action: str = "modify",
) -> None:
    """
    Enforce record ownership rule (Section 2.2):
    - A user can only read, change, or delete their own personal records.
    - Admins may read, modify, or delete any report.
    - Other users' records return 403 Forbidden.
    """
    if current_user is None:
        record_security_event(
            session,
            request,
            "token_rejected",
            f"Unauthenticated attempt to {action} item #{item.id}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if current_user.role != "admin" and item.owner_id != current_user.id:
        record_security_event(
            session,
            request,
            "rbac_denied",
            f"User {current_user.email} denied attempting to {action} item #{item.id} owned by user #{item.owner_id}",
            user_id=current_user.id,
            user_email=current_user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to {action} another user's report.",
        )


def enforce_group_permission(
    session: Session,
    request: Optional[Request],
    membership: Optional[DeskMember],
    current_user: User,
    action: str,
    owner_only: bool = False,
) -> DeskMember:
    """
    Enforce fine-grained permissions inside a shared recovery group/team:
    - Non-members receive 403 Forbidden (unless system admin).
    - Only the group owner may delete items, rename/delete the group, or manage members.
    - Members must have the corresponding flag (`can_create`, `can_edit`, `can_assign`).
    """
    if membership is None:
        record_security_event(
            session,
            request,
            "rbac_denied",
            f"Non-member {current_user.email} denied group action '{action}'",
            user_id=current_user.id,
            user_email=current_user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this recovery group.",
        )

    if membership.group_role == "owner":
        return membership

    if owner_only:
        record_security_event(
            session,
            request,
            "rbac_denied",
            f"Group member {current_user.email} denied owner-only action '{action}' in group #{membership.group_id}",
            user_id=current_user.id,
            user_email=current_user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can perform this action.",
        )

    flag_map = {
        "create": membership.can_create,
        "edit": membership.can_edit,
        "assign": membership.can_assign,
    }
    if action in flag_map and not flag_map[action]:
        record_security_event(
            session,
            request,
            "rbac_denied",
            f"Group member {current_user.email} lacks '{action}' permission in group #{membership.group_id}",
            user_id=current_user.id,
            user_email=current_user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have '{action}' permission in this group.",
        )

    return membership
