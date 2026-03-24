from datetime import datetime

from pydantic import BaseModel


class FacilityTypeOut(BaseModel):
    id: int
    code: str
    name: str
    category: str
    geom_type: str
    symbol_key: str | None
    style: dict

    model_config = {"from_attributes": True}


class FacilityOut(BaseModel):
    id: int
    region_id: int | None
    type_id: int | None
    fac_id: str | None
    geojson: dict | None = None
    properties: dict
    year: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FacilityCreate(BaseModel):
    region_id: int
    type_id: int
    fac_id: str | None = None
    geom_wkt: str  # WKT geometry in EPSG:4326
    properties: dict = {}
    year: int | None = None
