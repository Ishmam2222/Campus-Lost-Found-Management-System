import os
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine

# Determine Database URL (supports DATABASE_URL and Vercel/Neon POSTGRES_URL)
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")

if not DATABASE_URL:
    if os.getenv("VERCEL"):
        DATABASE_URL = "sqlite:////tmp/lost_and_found.db"
    else:
        DATABASE_URL = "sqlite:///./lost_and_found.db"

# Handle SQLite vs PostgreSQL / Neon / Supabase
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
else:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, poolclass=NullPool)


def create_db_and_tables() -> None:
    """Create all tables in the database and apply lightweight column upgrades."""
    SQLModel.metadata.create_all(engine)
    for ddl in (
        "ALTER TABLE item ADD COLUMN owner_id INTEGER",
        "ALTER TABLE item ADD COLUMN owner_name VARCHAR(100) DEFAULT 'Campus Member'",
        "ALTER TABLE item ADD COLUMN group_id INTEGER",
        "ALTER TABLE item ADD COLUMN assignee_id INTEGER",
        "ALTER TABLE item ADD COLUMN assignee_name VARCHAR(100)",
        "ALTER TABLE campus_user ADD COLUMN banned_at TIMESTAMP",
        "ALTER TABLE campus_user ADD COLUMN failed_login_count INTEGER DEFAULT 0",
        "ALTER TABLE campus_user ADD COLUMN locked_until TIMESTAMP",
        "ALTER TABLE campus_user ADD COLUMN last_login_at TIMESTAMP",
    ):
        try:
            with engine.begin() as conn:
                conn.execute(text(ddl))
        except Exception:
            pass


def get_session() -> Iterator[Session]:
    """Dependency that provides a database session for each request."""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
