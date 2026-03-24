import json

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.elements import WKTElement
from geoalchemy2.functions import ST_AsGeoJSON, ST_Intersects, ST_MakeEnvelope
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_role


def _parse_geojson(val):
    if val is None:
        return None
    if isinstance(val, dict):
        return val
    return json.loads(val)
from app.models.facility import Facility, FacilityType
from app.models.region import Region
from app.models.user import User
from app.schemas.facility import FacilityCreate, FacilityOut, FacilityTypeOut

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("/types", response_model=list[FacilityTypeOut])
async def list_facility_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FacilityType).order_by(FacilityType.category, FacilityType.code))
    return [FacilityTypeOut.model_validate(ft) for ft in result.scalars().all()]


@router.get("/", response_model=list[FacilityOut])
async def list_facilities(
    region: str | None = None,
    type: str | None = None,
    bbox: str | None = Query(None, description="minx,miny,maxx,maxy in EPSG:4326"),
    limit: int = Query(1000, le=5000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(
        Facility.id,
        Facility.region_id,
        Facility.type_id,
        Facility.fac_id,
        ST_AsGeoJSON(Facility.geom).label("geojson"),
        Facility.properties,
        Facility.year,
        Facility.created_at,
    )

    if region:
        stmt = stmt.join(Region, Facility.region_id == Region.id).where(Region.code == region)
    if type:
        stmt = stmt.join(FacilityType, Facility.type_id == FacilityType.id).where(FacilityType.code == type)
    if bbox:
        parts = [float(x) for x in bbox.split(",")]
        if len(parts) == 4:
            envelope = ST_MakeEnvelope(parts[0], parts[1], parts[2], parts[3], 4326)
            stmt = stmt.where(ST_Intersects(Facility.geom, envelope))

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        FacilityOut(
            id=r.id,
            region_id=r.region_id,
            type_id=r.type_id,
            fac_id=r.fac_id,
            geojson=_parse_geojson(r.geojson),
            properties=r.properties,
            year=r.year,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/{facility_id}", response_model=FacilityOut)
async def get_facility(facility_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(
        Facility.id,
        Facility.region_id,
        Facility.type_id,
        Facility.fac_id,
        ST_AsGeoJSON(Facility.geom).label("geojson"),
        Facility.properties,
        Facility.year,
        Facility.created_at,
    ).where(Facility.id == facility_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Facility not found")
    return FacilityOut(
        id=row.id,
        region_id=row.region_id,
        type_id=row.type_id,
        fac_id=row.fac_id,
        geojson=_parse_geojson(row.geojson),
        properties=row.properties,
        year=row.year,
        created_at=row.created_at,
    )


@router.post("/", response_model=FacilityOut, status_code=201)
async def create_facility(
    body: FacilityCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "editor")),
):
    facility = Facility(
        region_id=body.region_id,
        type_id=body.type_id,
        fac_id=body.fac_id,
        geom=WKTElement(body.geom_wkt, srid=4326),
        properties=body.properties,
        year=body.year,
    )
    db.add(facility)
    await db.commit()
    await db.refresh(facility)

    stmt = select(
        Facility.id,
        Facility.region_id,
        Facility.type_id,
        Facility.fac_id,
        ST_AsGeoJSON(Facility.geom).label("geojson"),
        Facility.properties,
        Facility.year,
        Facility.created_at,
    ).where(Facility.id == facility.id)
    result = await db.execute(stmt)
    row = result.first()
    return FacilityOut(
        id=row.id,
        region_id=row.region_id,
        type_id=row.type_id,
        fac_id=row.fac_id,
        geojson=_parse_geojson(row.geojson),
        properties=row.properties,
        year=row.year,
        created_at=row.created_at,
    )
