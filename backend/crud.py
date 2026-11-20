from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from models import (
    ActivityLog,
    DeskGroup,
    DeskMember,
    Item,
    ItemCreate,
    ItemUpdate,
    SessionToken,
    User,
    utc_now,
)


# -------------------------------------------------------------
# 1. Item Database Queries (Repository Layer)
# -------------------------------------------------------------


def create_item_record(
    session: Session,
    item_data: ItemCreate,
    owner_id: Optional[int] = None,
    owner_name: str = "Campus Member",
    group_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    assignee_name: Optional[str] = None,
) -> Item:
    item = Item(
        type=item_data.type.lower(),
        title=item_data.title,
        category=item_data.category,
        location=item_data.location,
        description=item_data.description,
        contact_info=item_data.contact_info,
        status=item_data.status,
        owner_id=owner_id,
        owner_name=owner_name,
        group_id=group_id if group_id is not None else item_data.group_id,
        assignee_id=assignee_id if assignee_id is not None else item_data.assignee_id,
        assignee_name=assignee_name,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def list_item_records(
    session: Session,
    type_filter: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    owner_id: Optional[int] = None,
    group_id: Optional[int] = None,
    include_group_items: bool = True,
) -> list[Item]:
    query = select(Item).order_by(Item.id.desc())

    if type_filter and type_filter != "all":
        query = query.where(Item.type == type_filter.lower())
    if category and category not in ("all", "All Categories"):
        query = query.where(Item.category == category)
    if status_filter and status_filter != "all":
        query = query.where(Item.status == status_filter.lower())
    if owner_id is not None:
        query = query.where(Item.owner_id == owner_id)
    if group_id is not None:
        query = query.where(Item.group_id == group_id)
    elif not include_group_items:
        query = query.where(Item.group_id == None)  # noqa: E711
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            (Item.title.ilike(pattern))
            | (Item.description.ilike(pattern))
            | (Item.location.ilike(pattern))
        )

    return list(session.exec(query).all())


def get_item_by_id(session: Session, item_id: int) -> Optional[Item]:
    return session.get(Item, item_id)


def update_item_record(
    session: Session,
    item: Item,
    item_update: ItemUpdate,
    assignee_name: Optional[str] = None,
) -> Item:
    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    if "assignee_id" in update_data:
        item.assignee_name = assignee_name

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def delete_item_record(session: Session, item: Item) -> None:
    session.delete(item)
    session.commit()


# -------------------------------------------------------------
# 2. User Account Database Queries
# -------------------------------------------------------------


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    normalized = email.strip().lower()
    return session.exec(select(User).where(User.email == normalized)).first()


def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    return session.get(User, user_id)


def create_user_record(
    session: Session,
    name: str,
    email: str,
    password_hash: str,
    role: str = "user",
) -> User:
    user = User(
        name=name.strip(),
        email=email.strip().lower(),
        password_hash=password_hash,
        role=role,
        is_banned=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def list_all_users(
    session: Session,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> list[User]:
    query = select(User).order_by(User.id.asc())
    if role and role != "all":
        query = query.where(User.role == role.lower())
    if status_filter == "banned":
        query = query.where(User.is_banned == True)  # noqa: E712
    elif status_filter == "active":
        query = query.where(User.is_banned == False)  # noqa: E712
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            (User.name.ilike(pattern)) | (User.email.ilike(pattern))
        )
    return list(session.exec(query).all())


def save_user(session: Session, user: User) -> User:
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# -------------------------------------------------------------
# 3. Refresh Token / Login Sessions Queries
# -------------------------------------------------------------


def create_session_token(
    session: Session,
    user_id: int,
    token_hash: str,
    ip_address: str,
    user_agent: str,
    expire_days: int = 7,
) -> SessionToken:
    now = utc_now()
    record = SessionToken(
        user_id=user_id,
        token_hash=token_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=expire_days),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_session_by_hash(
    session: Session, token_hash: str
) -> Optional[SessionToken]:
    return session.exec(
        select(SessionToken).where(SessionToken.token_hash == token_hash)
    ).first()


def list_user_sessions(
    session: Session, user_id: int, active_only: bool = True
) -> list[SessionToken]:
    query = select(SessionToken).where(SessionToken.user_id == user_id)
    if active_only:
        query = query.where(SessionToken.revoked_at == None)  # noqa: E711
    query = query.order_by(SessionToken.last_used_at.desc())
    return list(session.exec(query).all())


def revoke_user_sessions(
    session: Session,
    user_id: int,
    exclude_token_hash: Optional[str] = None,
) -> int:
    records = list_user_sessions(session, user_id, active_only=True)
    now = utc_now()
    count = 0
    for rec in records:
        if exclude_token_hash and rec.token_hash == exclude_token_hash:
            continue
        rec.revoked_at = now
        session.add(rec)
        count += 1
    session.commit()
    return count


# -------------------------------------------------------------
# 4. Shared Groups / Recovery Teams Queries
# -------------------------------------------------------------


def create_group_record(
    session: Session,
    name: str,
    description: str,
    owner: User,
) -> DeskGroup:
    assert owner.id is not None
    group = DeskGroup(
        name=name.strip(),
        description=description.strip(),
        owner_id=owner.id,
        owner_name=owner.name,
    )
    session.add(group)
    session.commit()
    session.refresh(group)

    assert group.id is not None
    owner_member = DeskMember(
        group_id=group.id,
        user_id=owner.id,
        user_name=owner.name,
        user_email=owner.email,
        group_role="owner",
        can_create=True,
        can_edit=True,
        can_assign=True,
    )
    session.add(owner_member)
    session.commit()
    return group


def get_group_by_id(session: Session, group_id: int) -> Optional[DeskGroup]:
    return session.get(DeskGroup, group_id)


def list_all_groups(session: Session) -> list[DeskGroup]:
    return list(session.exec(select(DeskGroup).order_by(DeskGroup.id.desc())).all())


def get_group_member(
    session: Session, group_id: int, user_id: int
) -> Optional[DeskMember]:
    return session.exec(
        select(DeskMember).where(
            (DeskMember.group_id == group_id) & (DeskMember.user_id == user_id)
        )
    ).first()


def list_group_members(session: Session, group_id: int) -> list[DeskMember]:
    return list(
        session.exec(
            select(DeskMember)
            .where(DeskMember.group_id == group_id)
            .order_by(DeskMember.id.asc())
        ).all()
    )


def list_user_memberships(session: Session, user_id: int) -> list[DeskMember]:
    return list(
        session.exec(
            select(DeskMember).where(DeskMember.user_id == user_id)
        ).all()
    )


# -------------------------------------------------------------
# 5. Activity (Audit) Log Queries
# -------------------------------------------------------------


def create_activity_log(
    session: Session,
    action: str,
    detail: str,
    user_id: Optional[int] = None,
    user_email: str = "anonymous",
    entity_type: str = "system",
    entity_id: Optional[str] = None,
    ip_address: str = "127.0.0.1",
    user_agent: str = "Unknown",
) -> ActivityLog:
    entry = ActivityLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        detail=detail[:490],
        ip_address=ip_address,
        user_agent=user_agent[:240],
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def list_activity_logs(
    session: Session,
    action_filter: Optional[str] = None,
    search: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 200,
) -> list[ActivityLog]:
    query = select(ActivityLog).order_by(ActivityLog.id.desc())
    if action_filter and action_filter != "all":
        query = query.where(ActivityLog.action == action_filter)
    if user_id is not None:
        query = query.where(ActivityLog.user_id == user_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            (ActivityLog.user_email.ilike(pattern))
            | (ActivityLog.detail.ilike(pattern))
            | (ActivityLog.ip_address.ilike(pattern))
            | (ActivityLog.action.ilike(pattern))
        )
    return list(session.exec(query.limit(limit)).all())
