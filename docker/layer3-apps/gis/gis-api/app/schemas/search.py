from pydantic import BaseModel


class SearchResult(BaseModel):
    id: str
    type: str  # 'parcel', 'building', 'facility'
    title: str
    address: str | None = None
    location: dict | None = None  # {"lat": ..., "lng": ...}
    score: float = 0.0


class SearchResponse(BaseModel):
    query: str
    total: int
    results: list[SearchResult]


class NearbyQuery(BaseModel):
    lat: float
    lng: float
    radius_m: int = 500
    region: str | None = None
