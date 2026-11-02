import os
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, SQLModel, create_engine

# Determine Database URL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # On Vercel serverless, root directory is read-only; /tmp is the only writable directory.
    if os.getenv("VERCEL"):
        DATABASE_URL = "sqlite:////tmp/lost_and_found.db"
    else:
        DATABASE_URL = "sqlite:///./lost_and_found.db"

# Handle SQLite vs PostgreSQL / Supabase
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
else:
    # Fix legacy postgres:// URL format to postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    try:
        from sqlalchemy.pool import NullPool
        engine = create_engine(
            DATABASE_URL,
            poolclass=NullPool,
            connect_args={"prepare_threshold": None},
        )
    except Exception:
        engine = create_engine(DATABASE_URL)


def create_db_and_tables() -> None:
    """Create all tables in the database if they don't already exist."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """Dependency that provides a database session for each request."""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
