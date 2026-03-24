import json

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.functions import ST_AsGeoJSON
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user_optional, require_role
from app.models.region import Region
from app.models.user import User
from app.models.user_region import UserRegion
from app.schemas.region import RegionCreate, RegionOut, RegionUpdate
from app.services.cache import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/regions", tags=["regions"])

CACHE_KEY = "regions:list"


def _parse_geojson(val):
    if val is None:
        return None
    if isinstance(val, str):
        return json.loads(val)
    return val


def _row_to_out(row) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "bbox": _parse_geojson(row.bbox_json),
        "center": _parse_geojson(row.center_json),
        "zoom_min": row.zoom_min,
        "zoom_max": row.zoom_max,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/", response_model=list[RegionOut])
async def list_regions(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    # Non-admin authenticated users only see their assigned regions
    allowed_codes: list[str] | None = None
    if user and user.role != "admin":
        ur_result = await db.execute(
            select(UserRegion.region_code).where(UserRegion.user_id == user.id)
        )
        allowed_codes = [r[0] for r in ur_result.all()]

    cache_suffix = ",".join(sorted(allowed_codes)) if allowed_codes is not None else "all"
    cache_key = f"regions:list:{cache_suffix}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = select(
        Region.id,
        Region.code,
        Region.name,
        ST_AsGeoJSON(Region.bbox).label("bbox_json"),
        ST_AsGeoJSON(Region.center).label("center_json"),
        Region.zoom_min,
        Region.zoom_max,
        Region.created_at,
    )
    if allowed_codes is not None:
        stmt = stmt.where(Region.code.in_(allowed_codes))
    stmt = stmt.order_by(Region.name)
    result = await db.execute(stmt)
    regions = [_row_to_out(r) for r in result.all()]
    await cache_set(cache_key, regions)
    return regions


@router.get("/{code}", response_model=RegionOut)
async def get_region(code: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"regions:{code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = select(
        Region.id,
        Region.code,
        Region.name,
        ST_AsGeoJSON(Region.bbox).label("bbox_json"),
        ST_AsGeoJSON(Region.center).label("center_json"),
        Region.zoom_min,
        Region.zoom_max,
        Region.created_at,
    ).where(Region.code == code)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Region not found")
    out = _row_to_out(row)
    await cache_set(cache_key, out)
    return out


@router.post("/", response_model=RegionOut, status_code=201)
async def create_region(
    body: RegionCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    from geoalchemy2.elements import WKTElement

    region = Region(
        code=body.code,
        name=body.name,
        bbox=WKTElement(body.bbox_wkt, srid=4326),
        center=WKTElement(body.center_wkt, srid=4326),
        zoom_min=body.zoom_min,
        zoom_max=body.zoom_max,
        srid_source=body.srid_source,
    )
    db.add(region)
    await db.commit()
    await db.refresh(region)
    await cache_delete("regions:*")

    stmt = select(
        Region.id,
        Region.code,
        Region.name,
        ST_AsGeoJSON(Region.bbox).label("bbox_json"),
        ST_AsGeoJSON(Region.center).label("center_json"),
        Region.zoom_min,
        Region.zoom_max,
        Region.created_at,
    ).where(Region.id == region.id)
    result = await db.execute(stmt)
    return _row_to_out(result.first())


@router.patch("/{code}", response_model=RegionOut)
async def update_region(
    code: str,
    body: RegionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    from geoalchemy2.elements import WKTElement

    stmt = select(Region).where(Region.code == code)
    result = await db.execute(stmt)
    region = result.scalar_one_or_none()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    if body.name is not None:
        region.name = body.name
    if body.bbox_wkt is not None:
        region.bbox = WKTElement(body.bbox_wkt, srid=4326)
    if body.center_wkt is not None:
        region.center = WKTElement(body.center_wkt, srid=4326)
    if body.zoom_min is not None:
        region.zoom_min = body.zoom_min
    if body.zoom_max is not None:
        region.zoom_max = body.zoom_max

    await db.commit()
    await db.refresh(region)
    await cache_delete("regions:*")

    out_stmt = select(
        Region.id,
        Region.code,
        Region.name,
        ST_AsGeoJSON(Region.bbox).label("bbox_json"),
        ST_AsGeoJSON(Region.center).label("center_json"),
        Region.zoom_min,
        Region.zoom_max,
        Region.created_at,
    ).where(Region.id == region.id)
    out_result = await db.execute(out_stmt)
    return _row_to_out(out_result.first())


@router.delete("/{code}", status_code=204)
async def delete_region(
    code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    stmt = select(Region).where(Region.code == code)
    result = await db.execute(stmt)
    region = result.scalar_one_or_none()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    await db.delete(region)
    await db.commit()
    await cache_delete("regions:*")
