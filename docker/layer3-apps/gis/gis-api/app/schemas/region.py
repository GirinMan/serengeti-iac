from datetime import datetime

from pydantic import BaseModel


class RegionOut(BaseModel):
    id: int
    code: str
    name: str
    bbox: dict | None = None
    center: dict | None = None
    zoom_min: int
    zoom_max: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RegionCreate(BaseModel):
    code: str
    name: str
    bbox_wkt: str  # WKT POLYGON in EPSG:4326
    center_wkt: str  # WKT POINT in EPSG:4326
    zoom_min: int = 10
    zoom_max: int = 19
    srid_source: int = 5181


class RegionUpdate(BaseModel):
    name: str | None = None
    bbox_wkt: str | None = None
    center_wkt: str | None = None
    zoom_min: int | None = None
    zoom_max: int | None = None
