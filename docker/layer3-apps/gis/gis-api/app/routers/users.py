from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_role
from app.models.region import Region
from app.models.user import User
from app.models.user_region import UserRegion
from app.schemas.auth import UserOut
from app.services.auth import hash_password

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserRequest(BaseModel):
    username: str
    password: str
    name: str | None = None
    role: str = "viewer"


class UpdateUserRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


class SetRegionsRequest(BaseModel):
    region_codes: list[str]


async def _user_with_regions(user: User, db: AsyncSession) -> UserOut:
    if user.role == "admin":
        result = await db.execute(select(Region.code).order_by(Region.name))
        codes = [r[0] for r in result.all()]
    else:
        result = await db.execute(
            select(UserRegion.region_code).where(UserRegion.user_id == user.id)
        )
        codes = [r[0] for r in result.all()]
    out = UserOut.model_validate(user)
    out.region_codes = codes
    return out


@router.get("/", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [await _user_with_regions(u, db) for u in users]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=body.username,
        password=hash_password(body.password),
        name=body.name,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _user_with_regions(user, db)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None:
        user.password = hash_password(body.password)
    await db.commit()
    await db.refresh(user)
    return await _user_with_regions(user, db)


@router.put("/{user_id}/regions", response_model=UserOut)
async def set_user_regions(
    user_id: int,
    body: SetRegionsRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Remove existing assignments
    await db.execute(delete(UserRegion).where(UserRegion.user_id == user_id))
    # Add new assignments
    for code in body.region_codes:
        db.add(UserRegion(user_id=user_id, region_code=code))
    await db.commit()
    return await _user_with_regions(user, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
