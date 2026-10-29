from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, status
from sqlmodel import select

from database import SessionDep, create_db_and_tables
from models import Item, ItemCreate, ItemRead, ItemUpdate

app = FastAPI(
    title="Campus Lost & Found API",
    description="REST API to manage lost and found reports on campus.",
    version="1.0.0",
)

# Initialize database tables on import (works locally and in serverless/Vercel)
create_db_and_tables()


@app.get("/api/health")
def health() -> dict[str, str]:
    """Health check endpoint to verify backend status."""
    return {"status": "ok"}


# -------------------------------------------------------------
# CRUD Endpoints for Lost & Found Reports
# -------------------------------------------------------------


@app.post(
    "/api/items",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lost or found report",
)
def create_item(item_data: ItemCreate, session: SessionDep) -> Item:
    """Create a new report in the database."""
    item = Item.model_validate(item_data)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.get(
    "/api/items",
    response_model=list[ItemRead],
    summary="List all reports (Read List)",
)
def list_items(
    session: SessionDep,
    type: Optional[str] = Query(
        None, description="Filter by report type: 'lost' or 'found'"
    ),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in title or description"),
) -> list[Item]:
    """Retrieve all reports with optional filters."""
    query = select(Item).order_by(Item.id.desc())

    if type:
        query = query.where(Item.type == type.lower())
    if category:
        query = query.where(Item.category == category)
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Item.title.ilike(search_filter)) | (Item.description.ilike(search_filter))
        )

    return list(session.exec(query).all())


@app.get(
    "/api/items/{item_id}",
    response_model=ItemRead,
    summary="Get single report details (Read Single)",
)
def get_item(item_id: int, session: SessionDep) -> Item:
    """Retrieve a single report by its ID."""
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {item_id} not found",
        )
    return item


@app.put(
    "/api/items/{item_id}",
    response_model=ItemRead,
    summary="Update a report (Update)",
)
def update_item(
    item_id: int, item_update: ItemUpdate, session: SessionDep
) -> Item:
    """Update fields of an existing report."""
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {item_id} not found",
        )

    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete(
    "/api/items/{item_id}",
    summary="Delete a report (Delete)",
)
def delete_item(item_id: int, session: SessionDep) -> dict[str, str | int]:
    """Delete a report from the database."""
    item = session.get(Item, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {item_id} not found",
        )

    session.delete(item)
    session.commit()
    return {"message": "Report deleted successfully", "id": item_id}


# -------------------------------------------------------------
# Static Frontend Serving (for Vercel / Production builds)
# -------------------------------------------------------------
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)
