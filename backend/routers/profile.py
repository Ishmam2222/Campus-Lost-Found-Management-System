from fastapi import APIRouter, Request

from database import SessionDep
from models import ItemRead, PasswordChange, ProfileUpdate, User, UserRead
from security import CurrentUserDep
import service

router = APIRouter(tags=["profile"])


@router.get(
    "/api/profile",
    response_model=UserRead,
    summary="Get signed-in user's profile",
)
def get_profile(current_user: CurrentUserDep) -> User:
    return current_user


@router.get(
    "/api/users/me",
    response_model=UserRead,
    summary="Get current user profile (alias)",
)
def get_me(current_user: CurrentUserDep) -> User:
    return current_user


@router.put(
    "/api/profile",
    response_model=UserRead,
    summary="Update signed-in user's display name",
)
def update_profile(
    data: ProfileUpdate,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> User:
    return service.update_user_profile(session, current_user, data, request)


@router.patch(
    "/api/users/me",
    response_model=UserRead,
    summary="Patch signed-in user's display name (alias)",
)
def patch_me(
    data: ProfileUpdate,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> User:
    return service.update_user_profile(session, current_user, data, request)


@router.post(
    "/api/profile/password",
    summary="Change signed-in user's password",
)
def change_password(
    data: PasswordChange,
    request: Request,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, str]:
    return service.change_user_password(session, current_user, data, request)


@router.get(
    "/api/profile/items",
    response_model=list[ItemRead],
    summary="List reports created by the signed-in user",
)
def list_my_reports(
    session: SessionDep,
    current_user: CurrentUserDep,
):
    return service.list_reports(session, owner_id=current_user.id)
