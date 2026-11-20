from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, Request, status

from database import SessionDep
from models import Item, ItemCreate, ItemRead, ItemUpdate, User
from rbac import Permission, require_permission
import service

router = APIRouter(tags=["items"])


@router.post(
    "/api/items",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lost or found report",
)
def create_item(
    item_data: ItemCreate,
    request: Request,
    session: SessionDep,
    current_user: Annotated[
        User, Depends(require_permission(Permission.ITEM_CREATE))
    ],
) -> Item:
    """Create a new lost or found report owned by the signed-in user."""
    return service.create_report(session, item_data, current_user, request)


@router.get(
    "/api/items",
    response_model=list[ItemRead],
    summary="List the signed-in user's own reports (Read List)",
)
def list_items(
    request: Request,
    session: SessionDep,
    current_user: Annotated[
        User, Depends(require_permission(Permission.ITEM_READ_OWN))
    ],
    type: Optional[str] = Query(
        None, description="Filter by report type: 'lost' or 'found'"
    ),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in title or description"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
) -> list[Item]:
    """Retrieve reports belonging to the signed-in user (or a group they belong to)."""
    return service.list_user_scoped_reports(
        session=session,
        current_user=current_user,
        request=request,
        type_filter=type,
        category=category,
        status_filter=status,
        search=search,
        group_id=group_id,
    )


@router.get(
    "/api/items/{item_id}",
    response_model=ItemRead,
    summary="Get single report details (Read Single — enforces ownership)",
)
def get_item(
    item_id: int,
    request: Request,
    session: SessionDep,
    current_user: Annotated[
        User, Depends(require_permission(Permission.ITEM_READ_OWN))
    ],
) -> Item:
    """Retrieve a single report by its ID if owned by the user (or in their group)."""
    return service.get_report_authorized(
        session, item_id, current_user, request
    )


@router.put(
    "/api/items/{item_id}",
    response_model=ItemRead,
    summary="Update a report (Update — enforces ownership or group permission)",
)
def update_item(
    item_id: int,
    item_update: ItemUpdate,
    request: Request,
    session: SessionDep,
    current_user: Annotated[
        User, Depends(require_permission(Permission.ITEM_UPDATE_OWN))
    ],
) -> Item:
    """Update fields of an existing report owned by the user or permitted in a group."""
    return service.update_report(
        session, item_id, item_update, current_user, request
    )


@router.delete(
    "/api/items/{item_id}",
    summary="Delete a report (Delete — enforces ownership or group owner)",
)
def delete_item(
    item_id: int,
    request: Request,
    session: SessionDep,
    current_user: Annotated[
        User, Depends(require_permission(Permission.ITEM_DELETE_OWN))
    ],
) -> dict[str, str | int]:
    """Delete a report from the database after verifying ownership."""
    return service.delete_report(session, item_id, current_user, request)
