from fastapi import APIRouter, Request, status

import crud
from database import SessionDep
from models import (
    GroupCreate,
    GroupMemberAdd,
    GroupMemberPermissionUpdate,
    GroupMemberRead,
    GroupRead,
    GroupUpdate,
    Item,
    ItemCreate,
    ItemRead,
)
from rbac import enforce_group_permission
from security import CurrentUserDep
import service

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get(
    "",
    response_model=list[GroupRead],
    summary="List recovery groups the signed-in user belongs to",
)
def list_groups(
    session: SessionDep, current_user: CurrentUserDep
) -> list[GroupRead]:
    return service.list_my_groups(session, current_user)


@router.post(
    "",
    response_model=GroupRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new shared recovery team/group",
)
def create_group(
    data: GroupCreate,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> GroupRead:
    return service.create_group(session, data, current_user, request)


@router.get(
    "/{group_id}",
    response_model=GroupRead,
    summary="Get group details and current user's permissions",
)
def get_group(
    group_id: int,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> GroupRead:
    return service.get_group_detail(session, group_id, current_user, request)


@router.patch(
    "/{group_id}",
    response_model=GroupRead,
    summary="Rename or update a group (Owner only)",
)
def update_group(
    group_id: int,
    data: GroupUpdate,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> GroupRead:
    return service.update_group(session, group_id, data, current_user, request)


@router.delete(
    "/{group_id}",
    summary="Delete a group and its reports (Owner or Admin only)",
)
def delete_group(
    group_id: int,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, str]:
    return service.delete_group(session, group_id, current_user, request)


@router.get(
    "/{group_id}/members",
    response_model=list[GroupMemberRead],
    summary="List members and their permissions in a group",
)
def list_members(
    group_id: int,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> list[GroupMemberRead]:
    assert current_user.id is not None
    membership = crud.get_group_member(session, group_id, current_user.id)
    if current_user.role != "admin":
        enforce_group_permission(
            session, request, membership, current_user, "view"
        )
    members = crud.list_group_members(session, group_id)
    return [GroupMemberRead.model_validate(m) for m in members]


@router.post(
    "/{group_id}/members",
    response_model=GroupMemberRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a member by email with custom permissions (Owner only)",
)
def add_member(
    group_id: int,
    data: GroupMemberAdd,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> GroupMemberRead:
    return service.add_member_to_group(
        session, group_id, data, current_user, request
    )


@router.patch(
    "/{group_id}/members/{member_user_id}",
    response_model=GroupMemberRead,
    summary="Update a member's granular permissions (Owner only)",
)
def update_member_permissions(
    group_id: int,
    member_user_id: int,
    data: GroupMemberPermissionUpdate,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> GroupMemberRead:
    return service.update_group_member_permissions(
        session, group_id, member_user_id, data, current_user, request
    )


@router.delete(
    "/{group_id}/members/{member_user_id}",
    summary="Remove a member from the group (Owner or self)",
)
def remove_member(
    group_id: int,
    member_user_id: int,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, str]:
    return service.remove_group_member(
        session, group_id, member_user_id, current_user, request
    )


@router.get(
    "/{group_id}/items",
    response_model=list[ItemRead],
    summary="List shared reports inside a group",
)
def list_group_items(
    group_id: int,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> list[Item]:
    assert current_user.id is not None
    membership = crud.get_group_member(session, group_id, current_user.id)
    if current_user.role != "admin":
        enforce_group_permission(
            session, request, membership, current_user, "view"
        )
    return service.list_reports(session, group_id=group_id)


@router.post(
    "/{group_id}/items",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a report inside a group (Requires can_create permission)",
)
def create_group_item(
    group_id: int,
    item_data: ItemCreate,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> Item:
    item_data.group_id = group_id
    return service.create_report(session, item_data, current_user, request)
