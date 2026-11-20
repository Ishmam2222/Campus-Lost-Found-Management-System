from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# -------------------------------------------------------------
# 1. User Account Models & Schemas
# -------------------------------------------------------------


class User(SQLModel, table=True):
    __tablename__ = "campus_user"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(min_length=1, max_length=100, description="Full name of campus user")
    email: str = Field(
        min_length=3,
        max_length=254,
        unique=True,
        index=True,
        description="Unique email stored in lowercase",
    )
    password_hash: str = Field(description="Argon2/PBKDF2 hash with server-side pepper")
    role: str = Field(
        default="user",
        max_length=20,
        description="System role: 'user' or 'admin'",
    )
    is_banned: bool = Field(default=False)
    banned_at: Optional[datetime] = Field(default=None)
    ban_reason: Optional[str] = Field(default=None, max_length=300)
    failed_login_count: int = Field(default=0)
    locked_until: Optional[datetime] = Field(default=None)
    last_login_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)


class UserCreate(SQLModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class UserLogin(SQLModel):
    email: str
    password: str


class UserRead(SQLModel):
    id: int
    name: str
    email: str
    role: str
    is_banned: bool = False
    banned_at: Optional[datetime] = None
    ban_reason: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime


class ProfileUpdate(SQLModel):
    name: str = Field(min_length=1, max_length=100)


class PasswordChange(SQLModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class RoleUpdate(SQLModel):
    role: str = Field(description="Target role: 'user' or 'admin'")


class BanRequest(SQLModel):
    reason: Optional[str] = Field(
        default="Violation of campus lost and found policy", max_length=300
    )


class BulkUserIdsRequest(SQLModel):
    user_ids: list[int]
    reason: Optional[str] = Field(
        default="Bulk moderation suspension", max_length=300
    )


class BulkItemIdsRequest(SQLModel):
    item_ids: list[int]


# -------------------------------------------------------------
# 2. Refresh Token / Login Sessions Table & Schemas
# -------------------------------------------------------------


class SessionToken(SQLModel, table=True):
    __tablename__ = "campus_session"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="campus_user.id", index=True)
    token_hash: str = Field(max_length=128, unique=True, index=True)
    ip_address: str = Field(default="127.0.0.1", max_length=64)
    user_agent: str = Field(default="Unknown Browser", max_length=250)
    created_at: datetime = Field(default_factory=utc_now)
    last_used_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    revoked_at: Optional[datetime] = Field(default=None)


class SessionRead(SQLModel):
    id: int
    user_id: int
    ip_address: str
    user_agent: str
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime] = None
    is_current: bool = False


class AuthResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


# -------------------------------------------------------------
# 3. Shared Recovery Teams / Groups & Fine-Grained Permissions
# -------------------------------------------------------------


class DeskGroup(SQLModel, table=True):
    __tablename__ = "campus_group"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=400)
    owner_id: int = Field(foreign_key="campus_user.id", index=True)
    owner_name: str = Field(default="Campus User", max_length=100)
    created_at: datetime = Field(default_factory=utc_now)


class DeskMember(SQLModel, table=True):
    __tablename__ = "campus_group_member"

    id: Optional[int] = Field(default=None, primary_key=True)
    group_id: int = Field(foreign_key="campus_group.id", index=True)
    user_id: int = Field(foreign_key="campus_user.id", index=True)
    user_name: str = Field(default="", max_length=100)
    user_email: str = Field(default="", max_length=254)
    group_role: str = Field(default="member", max_length=20)  # 'owner' or 'member'
    can_create: bool = Field(default=True)
    can_edit: bool = Field(default=False)
    can_assign: bool = Field(default=False)
    joined_at: datetime = Field(default_factory=utc_now)


class GroupCreate(SQLModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=400)


class GroupUpdate(SQLModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=400)


class GroupMemberAdd(SQLModel):
    email: str
    can_create: bool = True
    can_edit: bool = False
    can_assign: bool = False


class GroupMemberPermissionUpdate(SQLModel):
    can_create: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_assign: Optional[bool] = None


class GroupMemberRead(SQLModel):
    id: int
    group_id: int
    user_id: int
    user_name: str
    user_email: str
    group_role: str
    can_create: bool
    can_edit: bool
    can_assign: bool
    joined_at: datetime


class GroupRead(SQLModel):
    id: int
    name: str
    description: str
    owner_id: int
    owner_name: str
    created_at: datetime
    member_count: int = 1
    my_role: Optional[str] = None
    my_permissions: Optional[dict[str, bool]] = None


# -------------------------------------------------------------
# 4. Lost & Found Report Models & Schemas
# -------------------------------------------------------------


class ItemBase(SQLModel):
    type: str = Field(
        default="lost",
        description="Whether the item was lost or found ('lost' or 'found')",
    )
    title: str = Field(
        min_length=1, max_length=200, description="Short item title"
    )
    category: str = Field(
        default="Other",
        description="Category such as Electronics, Keys, IDs & Cards, Clothing, Other",
    )
    location: str = Field(
        min_length=1, max_length=200, description="Location where item was lost or found"
    )
    description: str = Field(
        default="", description="Detailed description or distinctive features"
    )
    contact_info: str = Field(
        default="", description="Contact email, phone number, or social handle"
    )
    status: str = Field(
        default="active",
        description="Current status: 'active', 'claimed', or 'resolved'",
    )


class Item(ItemBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: Optional[int] = Field(
        default=None,
        foreign_key="campus_user.id",
        index=True,
    )
    owner_name: str = Field(default="Campus Member", max_length=100)
    group_id: Optional[int] = Field(
        default=None,
        foreign_key="campus_group.id",
        index=True,
    )
    assignee_id: Optional[int] = Field(
        default=None,
        foreign_key="campus_user.id",
    )
    assignee_name: Optional[str] = Field(default=None, max_length=100)
    created_at: datetime = Field(default_factory=utc_now)


class ItemCreate(ItemBase):
    group_id: Optional[int] = None
    assignee_id: Optional[int] = None


class ItemUpdate(SQLModel):
    type: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    contact_info: Optional[str] = None
    status: Optional[str] = None
    assignee_id: Optional[int] = None


class ItemRead(ItemBase):
    id: int
    owner_id: Optional[int] = None
    owner_name: str = "Campus Member"
    group_id: Optional[int] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    created_at: datetime


# -------------------------------------------------------------
# 5. Activity (Audit) Log & Admin Dashboard Schemas
# -------------------------------------------------------------


class ActivityLog(SQLModel, table=True):
    __tablename__ = "campus_activity_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, index=True)
    user_email: str = Field(default="anonymous", max_length=254, index=True)
    action: str = Field(max_length=64, index=True)
    entity_type: str = Field(default="system", max_length=50)
    entity_id: Optional[str] = Field(default=None, max_length=64)
    detail: str = Field(default="", max_length=500)
    ip_address: str = Field(default="127.0.0.1", max_length=64)
    user_agent: str = Field(default="Unknown", max_length=250)
    created_at: datetime = Field(default_factory=utc_now)


class ActivityLogRead(SQLModel):
    id: int
    user_id: Optional[int] = None
    user_email: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    detail: str
    ip_address: str
    user_agent: str
    created_at: datetime


class AdminStats(SQLModel):
    total_users: int
    admin_users: int
    banned_users: int
    new_users_7d: int
    total_items: int
    lost_items: int
    found_items: int
    claimed_items: int
    new_items_7d: int
    total_groups: int


class UserPage(SQLModel):
    items: list[UserRead]
    total: int
    offset: int
    limit: int


class UserDetailView(SQLModel):
    user: UserRead
    items: list[ItemRead]
    groups: list[GroupRead]
    sessions: list[SessionRead]
    recent_activity: list[ActivityLogRead]


class FailedLoginBucket(SQLModel):
    key: str
    count: int
    last_seen: Optional[datetime] = None


class SecuritySummary(SQLModel):
    failed_by_ip: list[FailedLoginBucket]
    failed_by_account: list[FailedLoginBucket]
    recent_security_events: list[ActivityLogRead]
