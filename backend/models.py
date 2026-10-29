from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


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
        description="Category such as Electronics, Keys, Documents, Clothing, Other",
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
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when report was created",
    )


class ItemCreate(ItemBase):
    pass


class ItemUpdate(SQLModel):
    type: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    contact_info: Optional[str] = None
    status: Optional[str] = None


class ItemRead(ItemBase):
    id: int
    created_at: datetime
