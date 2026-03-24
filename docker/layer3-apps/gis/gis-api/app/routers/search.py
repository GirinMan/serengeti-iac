from fastapi import APIRouter, HTTPException, Query

from app.schemas.search import SearchResponse
from app.services.search import SearchServiceUnavailable, search_address, search_autocomplete, search_nearby

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/address", response_model=SearchResponse)
async def search_by_address(
    q: str = Query(..., min_length=1),
    region: str | None = None,
    size: int = Query(20, le=100),
):
    try:
        return await search_address(q, region=region, size=size)
    except SearchServiceUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/autocomplete", response_model=SearchResponse)
async def autocomplete(
    q: str = Query(..., min_length=2),
    region: str | None = None,
    size: int = Query(8, le=20),
):
    try:
        return await search_autocomplete(q, region=region, size=size)
    except SearchServiceUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/nearby", response_model=SearchResponse)
async def search_nearby_location(
    lat: float = Query(...),
    lng: float = Query(...),
    r: int = Query(500, alias="radius", le=5000),
    region: str | None = None,
):
    try:
        return await search_nearby(lat, lng, radius_m=r, region=region)
    except SearchServiceUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
