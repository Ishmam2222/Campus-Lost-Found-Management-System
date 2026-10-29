import os
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, SQLModel, create_engine

# Use DATABASE_URL from environment (e.g. Supabase) or fallback to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lost_and_found.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def create_db_and_tables() -> None:
    """Create all tables in the database if they don't already exist."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """Dependency that provides a database session for each request."""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
