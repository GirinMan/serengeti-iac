from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_role
from app.models.data_source import DataSource
from app.models.region import Region
from app.models.user import User
from app.models.user_region import UserRegion
from app.schemas.data_source import (
    DataSourceCreate,
    DataSourceOut,
    DataSourceUpdate,
    SyncTriggerResponse,
)
from app.services.cache import cache_delete


async def _get_user_region_codes(user: User, db: AsyncSession) -> list[str] | None:
    """Return user's region codes, or None if admin (meaning all regions)."""
    if user.role == "admin":
        return None
    result = await db.execute(
        select(UserRegion.region_code).where(UserRegion.user_id == user.id)
    )
    return [r[0] for r in result.all()]

router = APIRouter(prefix="/data-sources", tags=["data-sources"])


@router.get("/", response_model=list[DataSourceOut])
async def list_data_sources(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "editor")),
):
    stmt = select(DataSource)
    region_codes = await _get_user_region_codes(user, db)
    if region_codes is not None:
        stmt = stmt.where(DataSource.region_code.in_(region_codes))
    stmt = stmt.order_by(DataSource.created_at.desc())
    result = await db.execute(stmt)
    return [DataSourceOut.model_validate(ds) for ds in result.scalars().all()]


@router.post("/", response_model=DataSourceOut, status_code=201)
async def create_data_source(
    payload: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    # Verify region exists
    result = await db.execute(
        select(Region).where(Region.code == payload.region_code)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Region not found: {payload.region_code}")

    ds = DataSource(
        name=payload.name,
        source_type=payload.source_type,
        url=payload.url,
        api_key=payload.api_key,
        parameters=payload.parameters,
        schedule_cron=payload.schedule_cron,
        target_table=payload.target_table,
        region_code=payload.region_code,
        is_active=payload.is_active,
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return DataSourceOut.model_validate(ds)


@router.patch("/{source_id}", response_model=DataSourceOut)
async def update_data_source(
    source_id: int,
    payload: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ds, key, value)

    await db.commit()
    await db.refresh(ds)
    return DataSourceOut.model_validate(ds)


@router.delete("/{source_id}", status_code=204)
async def delete_data_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")

    await db.delete(ds)
    await db.commit()


@router.post("/{source_id}/sync", response_model=SyncTriggerResponse)
async def trigger_sync(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")

    if ds.last_sync_status == "running":
        raise HTTPException(status_code=409, detail="Sync already in progress")

    # Mark as running
    ds.last_sync_status = "running"
    ds.last_sync_message = None
    ds.last_synced_at = datetime.now(UTC)
    await db.commit()

    # TODO: In a future loop, publish a Kafka event for async processing by gis-worker.
    # For now, we just mark the status and return immediately.
    # The actual sync logic (HTTP fetch from data.go.kr, data parsing, DB insert)
    # will be implemented in the gis-worker service.

    await db.refresh(ds)
    return SyncTriggerResponse(
        data_source_id=ds.id,
        status="running",
        message=f"Sync triggered for '{ds.name}'. Worker will process the request.",
    )
