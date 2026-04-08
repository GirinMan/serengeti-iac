from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.region import Region
from app.models.user import User
from app.models.user_region import UserRegion
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.auth import create_access_token, hash_password, verify_password


async def _user_out_with_regions(user: User, db: AsyncSession) -> UserOut:
    if user.role == "admin":
        # Admin gets access to all regions automatically
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

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str | None = None


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(body.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=body.username,
        password=hash_password(body.password),
        name=body.name,
        role="viewer",
        is_active=False,
        approval_status="pending",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _user_out_with_regions(user, db)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(user: User = Depends(get_current_user)):
    token = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _user_out_with_regions(user, db)


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    current_password: str | None = None
    new_password: str | None = None


@router.patch("/me", response_model=UserOut)
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_password(body.current_password, user.password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if len(body.new_password) < 4:
            raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
        user.password = hash_password(body.new_password)
    if body.name is not None:
        user.name = body.name
    await db.commit()
    await db.refresh(user)
    return await _user_out_with_regions(user, db)

import secrets
from datetime import UTC, datetime, timedelta

from app.models.password_reset import PasswordReset


class ForgotPasswordRequest(BaseModel):
    username: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    # 보안상 user 존재 여부 노출 안 함
    if not user:
        return {"message": "If the username exists, a reset token has been generated"}
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(hours=1)
    reset = PasswordReset(user_id=user.id, token=token, expires_at=expires_at)
    db.add(reset)
    await db.commit()
    return {"message": "If the username exists, a reset token has been generated", "token": token}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    result = await db.execute(
        select(PasswordReset).where(
            PasswordReset.token == body.token,
            PasswordReset.used_at.is_(None),
        )
    )
    reset = result.scalar_one_or_none()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or already used token")
    if reset.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Token has expired")
    user_result = await db.execute(select(User).where(User.id == reset.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password = hash_password(body.new_password)
    reset.used_at = datetime.now(UTC)
    await db.commit()
    return {"message": "Password has been reset successfully"}
