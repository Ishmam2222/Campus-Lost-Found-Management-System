import csv
from datetime import datetime, timedelta, timezone
import io
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

import crud
from models import (
    ActivityLogRead,
    AdminStats,
    AuthResponse,
    DeskGroup,
    DeskMember,
    FailedLoginBucket,
    GroupCreate,
    GroupMemberAdd,
    GroupMemberPermissionUpdate,
    GroupMemberRead,
    GroupRead,
    GroupUpdate,
    Item,
    ItemCreate,
    ItemRead,
    ItemUpdate,
    PasswordChange,
    ProfileUpdate,
    SecuritySummary,
    SessionRead,
    User,
    UserCreate,
    UserDetailView,
    UserLogin,
    UserPage,
    UserRead,
    utc_now,
)
from rbac import enforce_group_permission, enforce_item_ownership
from security import (
    ACCESS_TOKEN_EXPIRE_SECONDS,
    REFRESH_TOKEN_DAYS,
    create_access_token,
    create_refresh_token_raw,
    get_client_info,
    hash_password,
    hash_refresh_token,
    verify_password,
)

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def _ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def log_event(
    session: Session,
    request: Optional[Request],
    action: str,
    detail: str,
    user: Optional[User] = None,
    entity_type: str = "system",
    entity_id: Optional[str | int] = None,
    fallback_email: str = "anonymous",
) -> None:
    ip, ua = get_client_info(request)
    crud.create_activity_log(
        session=session,
        action=action,
        detail=detail,
        user_id=user.id if user else None,
        user_email=user.email if user else fallback_email,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        ip_address=ip,
        user_agent=ua,
    )


# -------------------------------------------------------------
# 1. Lost & Found Report Service (CRUD + Ownership + Groups)
# -------------------------------------------------------------


def create_report(
    session: Session,
    item_data: ItemCreate,
    current_user: Optional[User] = None,
    request: Optional[Request] = None,
) -> Item:
    if item_data.type.lower() not in ("lost", "found"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Report type must be either 'lost' or 'found'",
        )

    assignee_name: Optional[str] = None
    if item_data.group_id is not None:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to post in a group.",
            )
        assert current_user.id is not None
        membership = crud.get_group_member(session, item_data.group_id, current_user.id)
        enforce_group_permission(session, request, membership, current_user, "create")

        if item_data.assignee_id is not None:
            enforce_group_permission(session, request, membership, current_user, "assign")
            target_member = crud.get_group_member(
                session, item_data.group_id, item_data.assignee_id
            )
            if not target_member:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Assignee must be a member of this group.",
                )
            assignee_name = target_member.user_name

    owner_id = current_user.id if current_user else None
    owner_name = current_user.name if current_user else "Campus Member"
    item = crud.create_item_record(
        session=session,
        item_data=item_data,
        owner_id=owner_id,
        owner_name=owner_name,
        group_id=item_data.group_id,
        assignee_id=item_data.assignee_id,
        assignee_name=assignee_name,
    )
    log_event(
        session,
        request,
        action="item_create",
        detail=f"Created {item.type} report '{item.title}'",
        user=current_user,
        entity_type="item",
        entity_id=item.id,
    )
    return item


def list_reports(
    session: Session,
    type_filter: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    owner_id: Optional[int] = None,
    group_id: Optional[int] = None,
) -> list[Item]:
    return crud.list_item_records(
        session=session,
        type_filter=type_filter,
        category=category,
        status_filter=status_filter,
        search=search,
        owner_id=owner_id,
        group_id=group_id,
    )


def list_user_scoped_reports(
    session: Session,
    current_user: User,
    request: Optional[Request] = None,
    type_filter: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    group_id: Optional[int] = None,
) -> list[Item]:
    """
    Return only the signed-in user's own personal records (Section 2.2:
    'Normal users only see and change their own data'), or shared records
    if querying a group the user is a member of.
    """
    assert current_user.id is not None
    if group_id is not None:
        membership = crud.get_group_member(session, group_id, current_user.id)
        if current_user.role != "admin":
            enforce_group_permission(
                session, request, membership, current_user, "view"
            )
        return crud.list_item_records(
            session=session,
            type_filter=type_filter,
            category=category,
            status_filter=status_filter,
            search=search,
            group_id=group_id,
        )

    return crud.list_item_records(
        session=session,
        type_filter=type_filter,
        category=category,
        status_filter=status_filter,
        search=search,
        owner_id=current_user.id,
        include_group_items=False,
    )


def get_report(session: Session, item_id: int) -> Item:
    item = crud.get_item_by_id(session, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {item_id} not found",
        )
    return item


def get_report_authorized(
    session: Session,
    item_id: int,
    current_user: User,
    request: Optional[Request] = None,
) -> Item:
    """Enforce ownership or group membership when reading a single report."""
    item = get_report(session, item_id)
    if item.group_id is not None:
        if current_user.role != "admin":
            assert current_user.id is not None
            membership = crud.get_group_member(
                session, item.group_id, current_user.id
            )
            enforce_group_permission(
                session, request, membership, current_user, "view"
            )
    else:
        enforce_item_ownership(
            session, request, item, current_user, action="read"
        )
    return item


def update_report(
    session: Session,
    item_id: int,
    item_update: ItemUpdate,
    current_user: Optional[User] = None,
    request: Optional[Request] = None,
) -> Item:
    item = get_report(session, item_id)
    assignee_name = item.assignee_name

    if item.group_id is not None:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to update a group report.",
            )
        if current_user.role != "admin":
            assert current_user.id is not None
            membership = crud.get_group_member(session, item.group_id, current_user.id)
            update_fields = item_update.model_dump(exclude_unset=True)
            if "assignee_id" in update_fields:
                enforce_group_permission(
                    session, request, membership, current_user, "assign"
                )
            other_fields = {k for k in update_fields.keys() if k != "assignee_id"}
            if other_fields:
                enforce_group_permission(
                    session, request, membership, current_user, "edit"
                )
        if item_update.assignee_id is not None:
            target_member = crud.get_group_member(
                session, item.group_id, item_update.assignee_id
            )
            if not target_member:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Assignee must be a member of this group.",
                )
            assignee_name = target_member.user_name
        elif "assignee_id" in item_update.model_dump(exclude_unset=True):
            assignee_name = None
    else:
        enforce_item_ownership(session, request, item, current_user)

    updated = crud.update_item_record(
        session, item, item_update, assignee_name=assignee_name
    )
    log_event(
        session,
        request,
        action="item_update",
        detail=f"Updated report #{updated.id} ('{updated.title}')",
        user=current_user,
        entity_type="item",
        entity_id=updated.id,
    )
    return updated


def delete_report(
    session: Session,
    item_id: int,
    current_user: Optional[User] = None,
    request: Optional[Request] = None,
) -> dict[str, str | int]:
    item = get_report(session, item_id)
    if item.group_id is not None:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to delete a group report.",
            )
        if current_user.role != "admin":
            assert current_user.id is not None
            membership = crud.get_group_member(session, item.group_id, current_user.id)
            enforce_group_permission(
                session, request, membership, current_user, "delete", owner_only=True
            )
    else:
        enforce_item_ownership(session, request, item, current_user)

    title = item.title
    crud.delete_item_record(session, item)
    log_event(
        session,
        request,
        action="item_delete",
        detail=f"Deleted report #{item_id} ('{title}')",
        user=current_user,
        entity_type="item",
        entity_id=item_id,
    )
    return {"message": "Report deleted successfully", "id": item_id}


# -------------------------------------------------------------
# 2. Authentication, Refresh Sessions & Brute-Force Protection
# -------------------------------------------------------------


def _issue_tokens_for_user(
    session: Session, user: User, request: Optional[Request]
) -> tuple[AuthResponse, str]:
    assert user.id is not None
    access_token = create_access_token(user.id, user.email, user.role)
    raw_refresh = create_refresh_token_raw()
    ip, ua = get_client_info(request)
    crud.create_session_token(
        session=session,
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        ip_address=ip,
        user_agent=ua,
        expire_days=REFRESH_TOKEN_DAYS,
    )
    auth_res = AuthResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_SECONDS,
        user=UserRead.model_validate(user),
    )
    return auth_res, raw_refresh


def register_user(
    session: Session, data: UserCreate, request: Optional[Request] = None
) -> tuple[AuthResponse, str]:
    existing = crud.get_user_by_email(session, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    pw_hash = hash_password(data.password)
    user = crud.create_user_record(
        session=session,
        name=data.name,
        email=data.email,
        password_hash=pw_hash,
        role="user",
    )
    user.last_login_at = utc_now()
    crud.save_user(session, user)

    log_event(
        session,
        request,
        action="signup",
        detail=f"Registered new user account ({user.email})",
        user=user,
        entity_type="user",
        entity_id=user.id,
    )
    return _issue_tokens_for_user(session, user, request)


def authenticate_user(
    session: Session, credentials: UserLogin, request: Optional[Request] = None
) -> tuple[AuthResponse, str]:
    user = crud.get_user_by_email(session, credentials.email)
    now = utc_now()

    if user and user.locked_until:
        locked_until = _ensure_aware(user.locked_until)
        if locked_until and locked_until > now:
            remaining_sec = int((locked_until - now).total_seconds())
            log_event(
                session,
                request,
                action="failed_login",
                detail=f"Login blocked due to active brute-force lockout ({remaining_sec}s left)",
                user=user,
                entity_type="security",
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked after repeated failed attempts. Try again in {max(1, remaining_sec // 60)} minute(s).",
            )

    if not user or not verify_password(credentials.password, user.password_hash):
        if user:
            user.failed_login_count = (user.failed_login_count or 0) + 1
            if user.failed_login_count >= MAX_FAILED_LOGIN_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                crud.save_user(session, user)
                log_event(
                    session,
                    request,
                    action="failed_login",
                    detail=f"Account locked for {LOCKOUT_DURATION_MINUTES}m after {user.failed_login_count} failed logins",
                    user=user,
                    entity_type="security",
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed login attempts. Account locked for {LOCKOUT_DURATION_MINUTES} minutes.",
                )
            crud.save_user(session, user)

        log_event(
            session,
            request,
            action="failed_login",
            detail=f"Invalid password or unknown email for '{credentials.email}'",
            user=user,
            fallback_email=credentials.email.strip().lower(),
            entity_type="security",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_banned:
        log_event(
            session,
            request,
            action="failed_login",
            detail=f"Banned user attempted login: {user.ban_reason}",
            user=user,
            entity_type="security",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account banned: {user.ban_reason or 'Contact campus administrator'}",
        )

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    crud.save_user(session, user)

    log_event(
        session,
        request,
        action="login",
        detail="User signed in successfully",
        user=user,
        entity_type="user",
        entity_id=user.id,
    )
    return _issue_tokens_for_user(session, user, request)


def refresh_user_session(
    session: Session,
    raw_refresh_token: Optional[str],
    request: Optional[Request] = None,
) -> tuple[AuthResponse, str]:
    if not raw_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token cookie.",
        )

    token_hash = hash_refresh_token(raw_refresh_token)
    record = crud.get_session_by_hash(session, token_hash)
    now = utc_now()

    if not record or record.revoked_at is not None:
        log_event(
            session,
            request,
            action="token_rejected",
            detail="Rejected revoked or unknown refresh token",
            entity_type="security",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked. Please log in again.",
        )

    expires_at = _ensure_aware(record.expires_at)
    if expires_at and expires_at < now:
        record.revoked_at = now
        session.add(record)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired.",
        )

    user = crud.get_user_by_id(session, record.user_id)
    if not user or user.is_banned:
        record.revoked_at = now
        session.add(record)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN
            if (user and user.is_banned)
            else status.HTTP_401_UNAUTHORIZED,
            detail="Account banned or unavailable.",
        )

    # Rotate refresh token hash
    new_raw_refresh = create_refresh_token_raw()
    record.token_hash = hash_refresh_token(new_raw_refresh)
    record.last_used_at = now
    session.add(record)
    session.commit()

    assert user.id is not None
    access_token = create_access_token(user.id, user.email, user.role)
    return (
        AuthResponse(
            access_token=access_token,
            expires_in=ACCESS_TOKEN_EXPIRE_SECONDS,
            user=UserRead.model_validate(user),
        ),
        new_raw_refresh,
    )


def logout_session(
    session: Session,
    raw_refresh_token: Optional[str],
    current_user: Optional[User] = None,
    request: Optional[Request] = None,
) -> None:
    user = current_user
    if raw_refresh_token:
        token_hash = hash_refresh_token(raw_refresh_token)
        record = crud.get_session_by_hash(session, token_hash)
        if record and record.revoked_at is None:
            record.revoked_at = utc_now()
            session.add(record)
            session.commit()
            if user is None:
                user = crud.get_user_by_id(session, record.user_id)

    if user is not None:
        log_event(
            session,
            request,
            action="logout",
            detail="User logged out and invalidated session",
            user=user,
            entity_type="user",
            entity_id=user.id,
        )


def get_active_sessions_for_user(
    session: Session, user: User, raw_refresh_token: Optional[str] = None
) -> list[SessionRead]:
    assert user.id is not None
    current_hash = (
        hash_refresh_token(raw_refresh_token) if raw_refresh_token else None
    )
    records = crud.list_user_sessions(session, user.id, active_only=True)
    result: list[SessionRead] = []
    for idx, rec in enumerate(records):
        assert rec.id is not None
        is_current = (
            (rec.token_hash == current_hash)
            if current_hash
            else (idx == 0)
        )
        result.append(
            SessionRead(
                id=rec.id,
                user_id=rec.user_id,
                ip_address=rec.ip_address,
                user_agent=rec.user_agent,
                created_at=rec.created_at,
                last_used_at=rec.last_used_at,
                expires_at=rec.expires_at,
                revoked_at=rec.revoked_at,
                is_current=is_current,
            )
        )
    return result


def revoke_single_session(
    session: Session,
    user: User,
    session_id: int,
    request: Optional[Request] = None,
) -> None:
    rec = session.get(crud.SessionToken, session_id)
    if not rec or rec.user_id != user.id or rec.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    rec.revoked_at = utc_now()
    session.add(rec)
    session.commit()
    log_event(
        session,
        request,
        action="session_revoke",
        detail=f"Revoked session #{session_id}",
        user=user,
        entity_type="session",
        entity_id=session_id,
    )


def update_user_profile(
    session: Session,
    user: User,
    data: ProfileUpdate,
    request: Optional[Request] = None,
) -> User:
    user.name = data.name.strip()
    saved = crud.save_user(session, user)
    log_event(
        session,
        request,
        action="profile_update",
        detail=f"Updated display name to '{saved.name}'",
        user=saved,
        entity_type="user",
        entity_id=saved.id,
    )
    return saved


def change_user_password(
    session: Session,
    user: User,
    data: PasswordChange,
    request: Optional[Request] = None,
) -> dict[str, str]:
    if not verify_password(data.current_password, user.password_hash):
        log_event(
            session,
            request,
            action="password_change_failed",
            detail="Failed password change: current password incorrect",
            user=user,
            entity_type="security",
            entity_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    user.password_hash = hash_password(data.new_password)
    crud.save_user(session, user)
    assert user.id is not None
    crud.revoke_user_sessions(session, user.id)

    log_event(
        session,
        request,
        action="password_change",
        detail="Changed account password and revoked existing sessions",
        user=user,
        entity_type="user",
        entity_id=user.id,
    )
    return {"message": "Password updated successfully"}


# -------------------------------------------------------------
# 3. Shared Recovery Groups / Teams Service
# -------------------------------------------------------------


def _build_group_read(
    session: Session, group: DeskGroup, current_user: Optional[User] = None
) -> GroupRead:
    assert group.id is not None
    members = crud.list_group_members(session, group.id)
    my_member: Optional[DeskMember] = None
    if current_user and current_user.id is not None:
        my_member = next(
            (m for m in members if m.user_id == current_user.id), None
        )
    return GroupRead(
        id=group.id,
        name=group.name,
        description=group.description,
        owner_id=group.owner_id,
        owner_name=group.owner_name,
        created_at=group.created_at,
        member_count=len(members),
        my_role=my_member.group_role if my_member else None,
        my_permissions={
            "can_create": my_member.can_create,
            "can_edit": my_member.can_edit,
            "can_assign": my_member.can_assign,
        }
        if my_member
        else None,
    )


def create_group(
    session: Session,
    data: GroupCreate,
    owner: User,
    request: Optional[Request] = None,
) -> GroupRead:
    group = crud.create_group_record(session, data.name, data.description, owner)
    log_event(
        session,
        request,
        action="group_create",
        detail=f"Created recovery team '{group.name}'",
        user=owner,
        entity_type="group",
        entity_id=group.id,
    )
    return _build_group_read(session, group, owner)


def list_my_groups(session: Session, user: User) -> list[GroupRead]:
    assert user.id is not None
    if user.role == "admin":
        all_groups = crud.list_all_groups(session)
        return [_build_group_read(session, g, user) for g in all_groups]

    memberships = crud.list_user_memberships(session, user.id)
    result: list[GroupRead] = []
    for m in memberships:
        group = crud.get_group_by_id(session, m.group_id)
        if group:
            result.append(_build_group_read(session, group, user))
    return result


def get_group_detail(
    session: Session,
    group_id: int,
    user: User,
    request: Optional[Request] = None,
) -> GroupRead:
    group = crud.get_group_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    assert user.id is not None
    membership = crud.get_group_member(session, group_id, user.id)
    if user.role != "admin":
        enforce_group_permission(session, request, membership, user, "view")
    return _build_group_read(session, group, user)


def update_group(
    session: Session,
    group_id: int,
    data: GroupUpdate,
    user: User,
    request: Optional[Request] = None,
) -> GroupRead:
    group = crud.get_group_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    assert user.id is not None
    membership = crud.get_group_member(session, group_id, user.id)
    if user.role != "admin":
        enforce_group_permission(
            session, request, membership, user, "rename", owner_only=True
        )
    if data.name is not None:
        group.name = data.name.strip()
    if data.description is not None:
        group.description = data.description.strip()
    session.add(group)
    session.commit()
    session.refresh(group)

    log_event(
        session,
        request,
        action="group_update",
        detail=f"Renamed/updated group #{group_id} to '{group.name}'",
        user=user,
        entity_type="group",
        entity_id=group.id,
    )
    return _build_group_read(session, group, user)


def delete_group(
    session: Session,
    group_id: int,
    user: User,
    request: Optional[Request] = None,
) -> dict[str, str]:
    group = crud.get_group_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    assert user.id is not None
    membership = crud.get_group_member(session, group_id, user.id)
    if user.role != "admin":
        enforce_group_permission(
            session, request, membership, user, "delete_group", owner_only=True
        )

    for m in crud.list_group_members(session, group_id):
        session.delete(m)
    for item in crud.list_item_records(session, group_id=group_id):
        session.delete(item)
    name = group.name
    session.delete(group)
    session.commit()

    log_event(
        session,
        request,
        action="group_delete",
        detail=f"Deleted recovery group '{name}' (#{group_id})",
        user=user,
        entity_type="group",
        entity_id=group_id,
    )
    return {"message": "Group deleted"}


def add_member_to_group(
    session: Session,
    group_id: int,
    data: GroupMemberAdd,
    user: User,
    request: Optional[Request] = None,
) -> GroupMemberRead:
    group = crud.get_group_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    assert user.id is not None
    membership = crud.get_group_member(session, group_id, user.id)
    if user.role != "admin":
        enforce_group_permission(
            session, request, membership, user, "manage_members", owner_only=True
        )

    target_user = crud.get_user_by_email(session, data.email)
    if not target_user or target_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No registered user found with email '{data.email}'",
        )
    existing = crud.get_group_member(session, group_id, target_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this group",
        )

    new_member = DeskMember(
        group_id=group_id,
        user_id=target_user.id,
        user_name=target_user.name,
        user_email=target_user.email,
        group_role="member",
        can_create=data.can_create,
        can_edit=data.can_edit,
        can_assign=data.can_assign,
    )
    session.add(new_member)
    session.commit()
    session.refresh(new_member)

    log_event(
        session,
        request,
        action="group_member_add",
        detail=f"Added {target_user.email} to group '{group.name}' (create={data.can_create}, edit={data.can_edit}, assign={data.can_assign})",
        user=user,
        entity_type="group",
        entity_id=group_id,
    )
    return GroupMemberRead.model_validate(new_member)


def update_group_member_permissions(
    session: Session,
    group_id: int,
    member_user_id: int,
    data: GroupMemberPermissionUpdate,
    user: User,
    request: Optional[Request] = None,
) -> GroupMemberRead:
    group = crud.get_group_by_id(session, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    assert user.id is not None
    membership = crud.get_group_member(session, group_id, user.id)
    if user.role != "admin":
        enforce_group_permission(
            session, request, membership, user, "manage_members", owner_only=True
        )

    target = crud.get_group_member(session, group_id, member_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if target.group_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group owner always retains full permissions.",
        )

    if data.can_create is not None:
        target.can_create = data.can_create
    if data.can_edit is not None:
        target.can_edit = data.can_edit
    if data.can_assign is not None:
        target.can_assign = data.can_assign
    session.add(target)
    session.commit()
    session.refresh(target)

    log_event(
        session,
        request,
        action="group_permission_update",
        detail=f"Updated permissions for {target.user_email} in group #{group_id}",
        user=user,
        entity_type="group",
        entity_id=group_id,
    )
    return GroupMemberRead.model_validate(target)


def remove_group_member(
    session: Session,
    group_id: int,
    member_user_id: int,
    user: User,
    request: Optional[Request] = None,
) -> dict[str, str]:
    assert user.id is not None
    membership = crud.get_group_member(session, group_id, user.id)
    if user.role != "admin" and user.id != member_user_id:
        enforce_group_permission(
            session, request, membership, user, "manage_members", owner_only=True
        )

    target = crud.get_group_member(session, group_id, member_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if target.group_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The group owner cannot be removed.",
        )
    email = target.user_email
    session.delete(target)
    session.commit()

    log_event(
        session,
        request,
        action="group_member_remove",
        detail=f"Removed {email} from group #{group_id}",
        user=user,
        entity_type="group",
        entity_id=group_id,
    )
    return {"message": "Member removed"}


# -------------------------------------------------------------
# 4. Admin Dashboard, Moderation, Audit Log & CSV Exports
# -------------------------------------------------------------


def get_admin_stats(session: Session) -> AdminStats:
    users = crud.list_all_users(session)
    items = crud.list_item_records(session)
    groups = crud.list_all_groups(session)
    seven_days_ago = utc_now() - timedelta(days=7)

    new_users = sum(
        1
        for u in users
        if (_ensure_aware(u.created_at) or utc_now()) >= seven_days_ago
    )
    new_items = sum(
        1
        for i in items
        if (_ensure_aware(i.created_at) or utc_now()) >= seven_days_ago
    )

    return AdminStats(
        total_users=len(users),
        admin_users=sum(1 for u in users if u.role == "admin"),
        banned_users=sum(1 for u in users if u.is_banned),
        new_users_7d=new_users,
        total_items=len(items),
        lost_items=sum(1 for i in items if i.type == "lost"),
        found_items=sum(1 for i in items if i.type == "found"),
        claimed_items=sum(1 for i in items if i.status in ("claimed", "resolved")),
        new_items_7d=new_items,
        total_groups=len(groups),
    )


def get_paginated_users(
    session: Session,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
) -> UserPage:
    all_matching = crud.list_all_users(
        session, search=search, role=role, status_filter=status_filter
    )
    sliced = all_matching[offset : offset + limit]
    return UserPage(
        items=[UserRead.model_validate(u) for u in sliced],
        total=len(all_matching),
        offset=offset,
        limit=limit,
    )


def get_user_detail_view(session: Session, target_user_id: int) -> UserDetailView:
    target = crud.get_user_by_id(session, target_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    items = crud.list_item_records(session, owner_id=target_user_id)
    memberships = crud.list_user_memberships(session, target_user_id)
    groups: list[GroupRead] = []
    for m in memberships:
        g = crud.get_group_by_id(session, m.group_id)
        if g:
            groups.append(_build_group_read(session, g, target))
    sessions = get_active_sessions_for_user(session, target)
    logs = crud.list_activity_logs(session, user_id=target_user_id, limit=30)

    return UserDetailView(
        user=UserRead.model_validate(target),
        items=[ItemRead.model_validate(i) for i in items],
        groups=groups,
        sessions=sessions,
        recent_activity=[ActivityLogRead.model_validate(a) for a in logs],
    )


def change_user_role(
    session: Session,
    admin_user: User,
    target_user_id: int,
    new_role: str,
    request: Optional[Request] = None,
) -> User:
    normalized = "admin" if new_role == "admin" else "user"
    if new_role not in ("user", "member", "admin"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be 'user' or 'admin'.",
        )
    if admin_user.id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An admin cannot change their own role.",
        )
    target = crud.get_user_by_id(session, target_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_user_id} not found.",
        )
    old_role = target.role
    target.role = normalized
    saved = crud.save_user(session, target)
    log_event(
        session,
        request,
        action="role_change",
        detail=f"Changed role of {saved.email} from '{old_role}' to '{normalized}'",
        user=admin_user,
        entity_type="user",
        entity_id=saved.id,
    )
    return saved


def ban_user_account(
    session: Session,
    admin_user: User,
    target_user_id: int,
    reason: Optional[str] = None,
    request: Optional[Request] = None,
) -> User:
    if admin_user.id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot ban your own account.",
        )
    target = crud.get_user_by_id(session, target_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_user_id} not found.",
        )
    if target.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An admin cannot ban another administrator.",
        )
    target.is_banned = True
    target.banned_at = utc_now()
    target.ban_reason = reason or "Suspended by campus administrator"
    saved = crud.save_user(session, target)
    assert saved.id is not None
    crud.revoke_user_sessions(session, saved.id)

    log_event(
        session,
        request,
        action="user_ban",
        detail=f"Banned {saved.email}: {saved.ban_reason}",
        user=admin_user,
        entity_type="user",
        entity_id=saved.id,
    )
    return saved


def unban_user_account(
    session: Session,
    admin_user: User,
    target_user_id: int,
    request: Optional[Request] = None,
) -> User:
    target = crud.get_user_by_id(session, target_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_user_id} not found.",
        )
    target.is_banned = False
    target.banned_at = None
    target.ban_reason = None
    target.failed_login_count = 0
    target.locked_until = None
    saved = crud.save_user(session, target)

    log_event(
        session,
        request,
        action="user_unban",
        detail=f"Unbanned {saved.email}",
        user=admin_user,
        entity_type="user",
        entity_id=saved.id,
    )
    return saved


def bulk_ban_users(
    session: Session,
    admin_user: User,
    user_ids: list[int],
    reason: Optional[str] = None,
    request: Optional[Request] = None,
) -> dict[str, int]:
    count = 0
    for uid in user_ids[:50]:
        target = crud.get_user_by_id(session, uid)
        if not target or target.id == admin_user.id or target.role == "admin":
            continue
        target.is_banned = True
        target.banned_at = utc_now()
        target.ban_reason = reason or "Bulk moderation suspension"
        crud.save_user(session, target)
        crud.revoke_user_sessions(session, uid)
        count += 1
    log_event(
        session,
        request,
        action="user_ban",
        detail=f"Bulk banned {count} user account(s)",
        user=admin_user,
        entity_type="user",
    )
    return {"banned": count}


def bulk_unban_users(
    session: Session,
    admin_user: User,
    user_ids: list[int],
    request: Optional[Request] = None,
) -> dict[str, int]:
    count = 0
    for uid in user_ids[:50]:
        target = crud.get_user_by_id(session, uid)
        if not target:
            continue
        target.is_banned = False
        target.banned_at = None
        target.ban_reason = None
        crud.save_user(session, target)
        count += 1
    log_event(
        session,
        request,
        action="user_unban",
        detail=f"Bulk unbanned {count} user account(s)",
        user=admin_user,
        entity_type="user",
    )
    return {"unbanned": count}


def bulk_delete_items(
    session: Session,
    admin_user: User,
    item_ids: list[int],
    request: Optional[Request] = None,
) -> dict[str, int]:
    count = 0
    for iid in item_ids[:50]:
        item = crud.get_item_by_id(session, iid)
        if item:
            crud.delete_item_record(session, item)
            count += 1
    log_event(
        session,
        request,
        action="item_delete",
        detail=f"Bulk deleted {count} report(s)",
        user=admin_user,
        entity_type="item",
    )
    return {"deleted": count}


def get_security_summary(session: Session) -> SecuritySummary:
    logs = crud.list_activity_logs(session, limit=500)
    by_ip: dict[str, dict] = {}
    by_account: dict[str, dict] = {}
    security_events: list[ActivityLogRead] = []

    for entry in logs:
        if entry.action in (
            "failed_login",
            "token_rejected",
            "rbac_denied",
            "password_change_failed",
        ):
            security_events.append(ActivityLogRead.model_validate(entry))

        if entry.action == "failed_login":
            ip_bucket = by_ip.setdefault(
                entry.ip_address, {"count": 0, "last_seen": entry.created_at}
            )
            ip_bucket["count"] += 1

            acc_bucket = by_account.setdefault(
                entry.user_email, {"count": 0, "last_seen": entry.created_at}
            )
            acc_bucket["count"] += 1

    failed_by_ip = sorted(
        [
            FailedLoginBucket(key=k, count=v["count"], last_seen=v["last_seen"])
            for k, v in by_ip.items()
        ],
        key=lambda b: b.count,
        reverse=True,
    )
    failed_by_account = sorted(
        [
            FailedLoginBucket(key=k, count=v["count"], last_seen=v["last_seen"])
            for k, v in by_account.items()
        ],
        key=lambda b: b.count,
        reverse=True,
    )
    return SecuritySummary(
        failed_by_ip=failed_by_ip,
        failed_by_account=failed_by_account,
        recent_security_events=security_events[:100],
    )


def export_users_csv(
    session: Session,
    admin_user: User,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    request: Optional[Request] = None,
) -> str:
    users = crud.list_all_users(
        session, search=search, role=role, status_filter=status_filter
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "name", "email", "role", "is_banned", "ban_reason", "created_at"])
    for u in users:
        writer.writerow(
            [u.id, u.name, u.email, u.role, u.is_banned, u.ban_reason or "", u.created_at.isoformat()]
        )
    log_event(
        session,
        request,
        action="data_export",
        detail=f"Exported {len(users)} users to CSV",
        user=admin_user,
        entity_type="export",
    )
    return buf.getvalue()


def export_items_csv(
    session: Session,
    admin_user: User,
    type_filter: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    request: Optional[Request] = None,
) -> str:
    items = crud.list_item_records(
        session, type_filter=type_filter, category=category, search=search
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["id", "type", "title", "category", "location", "status", "owner_name", "group_id", "created_at"]
    )
    for i in items:
        writer.writerow(
            [
                i.id,
                i.type,
                i.title,
                i.category,
                i.location,
                i.status,
                i.owner_name,
                i.group_id or "",
                i.created_at.isoformat(),
            ]
        )
    log_event(
        session,
        request,
        action="data_export",
        detail=f"Exported {len(items)} reports to CSV",
        user=admin_user,
        entity_type="export",
    )
    return buf.getvalue()


def export_activity_csv(
    session: Session,
    admin_user: User,
    action_filter: Optional[str] = None,
    search: Optional[str] = None,
    request: Optional[Request] = None,
) -> str:
    logs = crud.list_activity_logs(
        session, action_filter=action_filter, search=search, limit=500
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["id", "user_email", "action", "entity_type", "detail", "ip_address", "user_agent", "created_at"]
    )
    for a in logs:
        writer.writerow(
            [
                a.id,
                a.user_email,
                a.action,
                a.entity_type,
                a.detail,
                a.ip_address,
                a.user_agent,
                a.created_at.isoformat(),
            ]
        )
    log_event(
        session,
        request,
        action="data_export",
        detail=f"Exported {len(logs)} activity log rows to CSV",
        user=admin_user,
        entity_type="export",
    )
    return buf.getvalue()


# -------------------------------------------------------------
# 5. Initial Demo Data Seeding (2 Admins, 3 Normal Users, 1 Shared Group)
# -------------------------------------------------------------


def seed_initial_data(session: Session) -> None:
    """
    Seed the required test accounts (2 Admins + 3 Normal Users),
    initial campus lost/found reports, and 1 shared Recovery Group with mixed permissions.
    """
    # Migrate legacy demo accounts in-place for already-initialized databases
    legacy_renames = [
        ("alice@campus.edu", "Ammar Rahman", "ammar@campus.edu"),
        ("rafi@campus.edu", "Sajid Ahmed", "sajid@campus.edu"),
    ]
    for old_email, new_name, new_email in legacy_renames:
        legacy_user = crud.get_user_by_email(session, old_email)
        target_user = crud.get_user_by_email(session, new_email)
        if legacy_user and not target_user:
            legacy_user.name = new_name
            legacy_user.email = new_email
            session.add(legacy_user)

            assert legacy_user.id is not None
            for member in crud.list_user_memberships(session, legacy_user.id):
                member.user_name = new_name
                member.user_email = new_email
                session.add(member)

            for item in session.exec(
                select(Item).where(Item.owner_id == legacy_user.id)
            ).all():
                item.owner_name = new_name
                if item.contact_info == old_email:
                    item.contact_info = new_email
                session.add(item)

            for item in session.exec(
                select(Item).where(Item.assignee_id == legacy_user.id)
            ).all():
                item.assignee_name = new_name
                session.add(item)

            session.commit()

    demo_accounts = [
        ("Campus Chief Admin", "admin@campus.edu", "Admin123!", "admin"),
        ("Security Desk Moderator", "moderator@campus.edu", "Admin123!", "admin"),
        ("Sakif Ishmam", "student@campus.edu", "Student123!", "user"),
        ("Ammar Rahman", "ammar@campus.edu", "Student123!", "user"),
        ("Sajid Ahmed", "sajid@campus.edu", "Student123!", "user"),
    ]

    users_by_email: dict[str, User] = {}
    for name, email, pw, role in demo_accounts:
        user = crud.get_user_by_email(session, email)
        if not user:
            user = crud.create_user_record(
                session=session,
                name=name,
                email=email,
                password_hash=hash_password(pw),
                role=role,
            )
        elif user.role != role:
            user.role = role
            crud.save_user(session, user)
        users_by_email[email] = user

    student = users_by_email["student@campus.edu"]
    ammar = users_by_email["ammar@campus.edu"]
    sajid = users_by_email["sajid@campus.edu"]
    admin = users_by_email["admin@campus.edu"]

    # Seed shared group with mixed permissions if none exists
    existing_groups = crud.list_all_groups(session)
    library_group: Optional[DeskGroup] = existing_groups[0] if existing_groups else None
    if not library_group:
        library_group = crud.create_group_record(
            session=session,
            name="Main Library Lost & Found Team",
            description="Shared recovery desk for library volunteers and student assistants.",
            owner=student,
        )
        assert library_group.id is not None and ammar.id is not None and sajid.id is not None
        # Ammar has create + edit + assign permissions
        session.add(
            DeskMember(
                group_id=library_group.id,
                user_id=ammar.id,
                user_name=ammar.name,
                user_email=ammar.email,
                group_role="member",
                can_create=True,
                can_edit=True,
                can_assign=True,
            )
        )
        # Sajid only has create permission (cannot edit or assign)
        session.add(
            DeskMember(
                group_id=library_group.id,
                user_id=sajid.id,
                user_name=sajid.name,
                user_email=sajid.email,
                group_role="member",
                can_create=True,
                can_edit=False,
                can_assign=False,
            )
        )
        session.commit()

    # Seed sample reports if none exist
    existing_items = crud.list_item_records(session)
    if not existing_items:
        crud.create_item_record(
            session=session,
            item_data=ItemCreate(
                type="lost",
                title="Black Casio Digital Watch",
                category="Electronics",
                location="Library 2nd Floor Study Area",
                description="Black resin strap digital watch left near the quiet study desks.",
                contact_info="student@campus.edu",
                status="active",
            ),
            owner_id=student.id,
            owner_name=student.name,
        )
        crud.create_item_record(
            session=session,
            item_data=ItemCreate(
                type="found",
                title="Silver USB-C Flash Drive (64GB)",
                category="Electronics",
                location="Computer Lab 402",
                description="Found plugged into workstation #12 after the CSE309 lab session.",
                contact_info="student@campus.edu",
                status="active",
            ),
            owner_id=student.id,
            owner_name=student.name,
        )
        crud.create_item_record(
            session=session,
            item_data=ItemCreate(
                type="lost",
                title="Blue Leather Notebook & Pen",
                category="Books & Stationery",
                location="Auditorium Row C",
                description="Contains handwritten lecture notes for Web Application course.",
                contact_info="ammar@campus.edu",
                status="active",
            ),
            owner_id=ammar.id,
            owner_name=ammar.name,
        )
        crud.create_item_record(
            session=session,
            item_data=ItemCreate(
                type="lost",
                title="Honda Motorcycle Key with Red Keychain",
                category="Keys",
                location="Basement Parking Gate 2",
                description="Single ignition key attached to a red fabric carabiner.",
                contact_info="sajid@campus.edu",
                status="active",
            ),
            owner_id=sajid.id,
            owner_name=sajid.name,
        )
        crud.create_item_record(
            session=session,
            item_data=ItemCreate(
                type="found",
                title="IUB Student ID Card & Blue Lanyard",
                category="IDs & Cards",
                location="Cafeteria Main Entrance",
                description="Found a blue lanyard with a student ID card near the cashier counter.",
                contact_info="admin@campus.edu",
                status="active",
            ),
            owner_id=admin.id,
            owner_name=admin.name,
        )
        if library_group and library_group.id is not None:
            crud.create_item_record(
                session=session,
                item_data=ItemCreate(
                    type="found",
                    title="TI-84 Plus Graphing Calculator",
                    category="Electronics",
                    location="Library Group Study Room B",
                    description="Logged at the Main Library Lost & Found Desk awaiting owner verification.",
                    contact_info="student@campus.edu",
                    status="active",
                    group_id=library_group.id,
                    assignee_id=ammar.id,
                ),
                owner_id=student.id,
                owner_name=student.name,
                group_id=library_group.id,
                assignee_id=ammar.id,
                assignee_name=ammar.name,
            )
