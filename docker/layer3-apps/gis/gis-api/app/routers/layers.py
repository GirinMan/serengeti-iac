import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user_optional, require_role
from app.models.layer import Layer
from app.models.region import Region
from app.models.user import User
from app.models.user_region import UserRegion
from app.schemas.layer import LayerOut
from app.services.cache import cache_delete, cache_get, cache_set
from app.services.storage import download_file, upload_file

router = APIRouter(prefix="/layers", tags=["layers"])

CUSTOM_GEOJSON_CATEGORY = "custom_geojson"


@router.get("/", response_model=list[LayerOut])
async def list_layers(
    region: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    # For non-admin authenticated users, restrict to assigned regions
    allowed_codes: list[str] | None = None
    if user and user.role != "admin":
        ur_result = await db.execute(
            select(UserRegion.region_code).where(UserRegion.user_id == user.id)
        )
        allowed_codes = list(ur_result.scalars().all())

    cache_suffix = f":{','.join(sorted(allowed_codes))}" if allowed_codes is not None else ""
    cache_key = f"layers:{region or 'all'}{cache_suffix}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    stmt = select(Layer)
    if region:
        stmt = stmt.join(Region, Layer.region_id == Region.id).where(Region.code == region)
        # Also enforce region access for non-admin users
        if allowed_codes is not None and region not in allowed_codes:
            return []
    elif allowed_codes is not None:
        # No region filter but user has restricted access
        stmt = stmt.join(Region, Layer.region_id == Region.id).where(Region.code.in_(allowed_codes))
    stmt = stmt.order_by(Layer.sort_order, Layer.code)

    result = await db.execute(stmt)
    layers = [LayerOut.model_validate(row) for row in result.scalars().all()]
    await cache_set(cache_key, [layer.model_dump() for layer in layers])
    return layers


@router.get("/{layer_id}/style")
async def get_layer_style(layer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Layer).where(Layer.id == layer_id))
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer.style or {}


@router.post("/cache/clear", dependencies=[Depends(require_role("admin"))])
async def clear_layer_cache():
    await cache_delete("layers:*")
    return {"status": "ok", "message": "Layer cache cleared"}


# ── Custom GeoJSON Layer endpoints ──


class CustomLayerCreate(BaseModel):
    name: str
    region_code: str
    color: str = "#3388ff"
    layer_type: str = "fill"  # fill, line, circle
    visible: bool = True


@router.post("/custom", response_model=LayerOut, status_code=201)
async def create_custom_layer(
    file: UploadFile,
    name: str,
    region_code: str,
    color: str = "#3388ff",
    layer_type: str = "fill",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "editor")),
):
    """Upload a GeoJSON file and create a custom layer."""
    # Non-admin users can only create layers for their assigned regions
    if _user.role != "admin":
        ur_result = await db.execute(
            select(UserRegion.region_code).where(UserRegion.user_id == _user.id)
        )
        allowed = set(ur_result.scalars().all())
        if region_code not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"해당 지역({region_code})에 대한 권한이 없습니다",
            )

    filename = file.filename or "unknown.geojson"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("geojson", "json"):
        raise HTTPException(status_code=400, detail="Only GeoJSON files are supported")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 50MB")

    # Validate JSON
    try:
        geojson = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if geojson.get("type") not in ("FeatureCollection", "Feature", "GeometryCollection"):
        raise HTTPException(status_code=400, detail="Invalid GeoJSON: missing valid type")

    # Resolve region
    result = await db.execute(select(Region).where(Region.code == region_code))
    region = result.scalar_one_or_none()
    if not region:
        raise HTTPException(status_code=404, detail=f"Region not found: {region_code}")

    # Upload to MinIO
    object_name = f"custom-layers/{region_code}/{uuid.uuid4().hex}/{filename}"
    upload_file(object_name, content, "application/geo+json")

    # Build style based on layer_type and color
    style: dict = {}
    if layer_type == "fill":
        style = {"type": "fill", "fill-color": color, "fill-opacity": 0.5, "fill-outline-color": color}
    elif layer_type == "line":
        style = {"type": "line", "line-color": color, "line-width": 2, "line-opacity": 0.8}
    elif layer_type == "circle":
        style = {"type": "circle", "circle-color": color, "circle-radius": 5, "circle-stroke-width": 1, "circle-stroke-color": "#fff"}

    code = f"custom_{uuid.uuid4().hex[:8]}"
    layer = Layer(
        region_id=region.id,
        code=code,
        name=name,
        category=CUSTOM_GEOJSON_CATEGORY,
        source_table=object_name,  # Store MinIO path in source_table
        tile_url=f"/v1/layers/custom/{code}/geojson",
        min_zoom=0,
        max_zoom=22,
        visible=True,
        sort_order=100,
        style=style,
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    await cache_delete("layers:*")
    return LayerOut.model_validate(layer)


@router.get("/custom/{code}/geojson")
async def get_custom_geojson(code: str, db: AsyncSession = Depends(get_db)):
    """Serve GeoJSON data for a custom layer."""
    result = await db.execute(
        select(Layer).where(Layer.code == code, Layer.category == CUSTOM_GEOJSON_CATEGORY)
    )
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Custom layer not found")

    try:
        data = download_file(layer.source_table)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch GeoJSON from storage")

    return Response(content=data, media_type="application/geo+json")


class CustomLayerUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    opacity: float | None = None
    width: float | None = None


@router.patch("/custom/{code}", response_model=LayerOut)
async def update_custom_layer(
    code: str,
    body: CustomLayerUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "editor")),
):
    """Update a custom GeoJSON layer (name and/or style)."""
    result = await db.execute(
        select(Layer).where(Layer.code == code, Layer.category == CUSTOM_GEOJSON_CATEGORY)
    )
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Custom layer not found")

    if body.name is not None:
        layer.name = body.name.strip()

    style = dict(layer.style or {})
    layer_type = style.get("type", "fill")

    if body.color is not None:
        if layer_type == "fill":
            style["fill-color"] = body.color
            style["fill-outline-color"] = body.color
        elif layer_type == "line":
            style["line-color"] = body.color
        elif layer_type == "circle":
            style["circle-color"] = body.color

    if body.opacity is not None:
        if layer_type == "fill":
            style["fill-opacity"] = body.opacity
        elif layer_type == "line":
            style["line-opacity"] = body.opacity

    if body.width is not None:
        if layer_type == "line":
            style["line-width"] = body.width
        elif layer_type == "circle":
            style["circle-radius"] = body.width

    layer.style = style
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(layer, "style")
    await db.commit()
    await db.refresh(layer)
    await cache_delete("layers:*")
    return LayerOut.model_validate(layer)


@router.put("/custom/{code}/geojson", response_model=LayerOut)
async def replace_custom_geojson(
    code: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "editor")),
):
    """Replace the GeoJSON file of an existing custom layer."""
    result = await db.execute(
        select(Layer).where(Layer.code == code, Layer.category == CUSTOM_GEOJSON_CATEGORY)
    )
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Custom layer not found")

    # Non-admin users can only replace files for layers in their assigned regions
    if _user.role != "admin":
        region_result = await db.execute(select(Region.code).where(Region.id == layer.region_id))
        layer_region = region_result.scalar_one_or_none()
        ur_result = await db.execute(
            select(UserRegion.region_code).where(UserRegion.user_id == _user.id)
        )
        allowed = set(ur_result.scalars().all())
        if layer_region not in allowed:
            raise HTTPException(status_code=403, detail="해당 레이어에 대한 권한이 없습니다")

    filename = file.filename or "unknown.geojson"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("geojson", "json"):
        raise HTTPException(status_code=400, detail="Only GeoJSON files are supported")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 50MB")

    try:
        geojson = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if geojson.get("type") not in ("FeatureCollection", "Feature", "GeometryCollection"):
        raise HTTPException(status_code=400, detail="Invalid GeoJSON: missing valid type")

    # Upload new file to same path (overwrite)
    upload_file(layer.source_table, content, "application/geo+json")

    await cache_delete("layers:*")
    return LayerOut.model_validate(layer)


@router.delete("/custom/{code}", status_code=204)
async def delete_custom_layer(
    code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Delete a custom GeoJSON layer."""
    result = await db.execute(
        select(Layer).where(Layer.code == code, Layer.category == CUSTOM_GEOJSON_CATEGORY)
    )
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Custom layer not found")

    await db.delete(layer)
    await db.commit()
    await cache_delete("layers:*")
