import logging

from elasticsearch import AsyncElasticsearch
from elasticsearch import ConnectionError as ESConnectionError

from app.config import settings
from app.schemas.search import SearchResponse, SearchResult

logger = logging.getLogger(__name__)

_es: AsyncElasticsearch | None = None

INDEX_NAME = "gis-address"


async def get_es() -> AsyncElasticsearch:
    global _es
    if _es is None:
        kwargs: dict = {"hosts": [settings.elasticsearch_url]}
        if settings.elasticsearch_password:
            kwargs["basic_auth"] = ("elastic", settings.elasticsearch_password)
        _es = AsyncElasticsearch(**kwargs)
    return _es


class SearchServiceUnavailable(Exception):
    pass


async def search_address(query: str, region: str | None = None, size: int = 20) -> SearchResponse:
    try:
        es = await get_es()

        must = [
            {
                "multi_match": {
                    "query": query,
                    "fields": ["address^3", "address.autocomplete", "jibun^2", "bldnm^2"],
                    "type": "best_fields",
                }
            }
        ]
        if region:
            must.append({"term": {"region_code": region}})

        body = {"query": {"bool": {"must": must}}, "size": size}
        resp = await es.search(index=INDEX_NAME, body=body)
    except (ESConnectionError, ConnectionError, OSError) as e:
        logger.warning("Elasticsearch unavailable for address search: %s", e)
        raise SearchServiceUnavailable("Search service unavailable") from e

    results = []
    for hit in resp["hits"]["hits"]:
        src = hit["_source"]
        loc = src.get("location")
        source_table = src.get("source_table", "")
        doc_type = "building" if "building" in source_table else "parcel" if "parcel" in source_table else "unknown"
        bldnm = src.get("bldnm")
        full_addr = src.get("address", "")
        title = bldnm if bldnm else full_addr
        address = full_addr if bldnm else None
        results.append(
            SearchResult(
                id=hit["_id"],
                type=doc_type,
                title=title,
                address=address,
                location={"lat": loc["lat"], "lng": loc["lon"]} if loc else None,
                score=hit["_score"],
            )
        )

    return SearchResponse(query=query, total=resp["hits"]["total"]["value"], results=results)


async def search_autocomplete(query: str, region: str | None = None, size: int = 8) -> SearchResponse:
    try:
        es = await get_es()

        must: list = [
            {
                "multi_match": {
                    "query": query,
                    "fields": ["address.autocomplete^3", "bldnm^2", "jibun"],
                    "type": "best_fields",
                }
            }
        ]
        if region:
            must.append({"term": {"region_code": region}})

        body = {
            "query": {"bool": {"must": must}},
            "size": size,
            "_source": ["address", "bldnm", "location", "source_table"],
        }
        resp = await es.search(index=INDEX_NAME, body=body)
    except (ESConnectionError, ConnectionError, OSError) as e:
        logger.warning("Elasticsearch unavailable for autocomplete: %s", e)
        raise SearchServiceUnavailable("Search service unavailable") from e

    results = []
    for hit in resp["hits"]["hits"]:
        src = hit["_source"]
        loc = src.get("location")
        source_table = src.get("source_table", "")
        doc_type = "building" if "building" in source_table else "parcel" if "parcel" in source_table else "unknown"
        bldnm = src.get("bldnm")
        full_addr = src.get("address", "")
        title = bldnm if bldnm else full_addr
        address = full_addr if bldnm else None
        results.append(
            SearchResult(
                id=hit["_id"],
                type=doc_type,
                title=title,
                address=address,
                location={"lat": loc["lat"], "lng": loc["lon"]} if loc else None,
                score=hit["_score"],
            )
        )

    return SearchResponse(query=query, total=resp["hits"]["total"]["value"], results=results)


async def search_nearby(
    lat: float, lng: float, radius_m: int = 500, region: str | None = None, size: int = 20
) -> SearchResponse:
    try:
        es = await get_es()

        must: list = [{"geo_distance": {"distance": f"{radius_m}m", "location": {"lat": lat, "lon": lng}}}]
        if region:
            must.append({"term": {"region_code": region}})

        body = {
            "query": {"bool": {"filter": must}},
            "sort": [{"_geo_distance": {"location": {"lat": lat, "lon": lng}, "order": "asc", "unit": "m"}}],
            "size": size,
        }
        resp = await es.search(index=INDEX_NAME, body=body)
    except (ESConnectionError, ConnectionError, OSError) as e:
        logger.warning("Elasticsearch unavailable for nearby search: %s", e)
        raise SearchServiceUnavailable("Search service unavailable") from e

    results = []
    for hit in resp["hits"]["hits"]:
        src = hit["_source"]
        loc = src.get("location")
        source_table = src.get("source_table", "")
        doc_type = "building" if "building" in source_table else "parcel" if "parcel" in source_table else "unknown"
        bldnm = src.get("bldnm")
        full_addr = src.get("address", "")
        title = bldnm if bldnm else full_addr
        address = full_addr if bldnm else None
        results.append(
            SearchResult(
                id=hit["_id"],
                type=doc_type,
                title=title,
                address=address,
                location={"lat": loc["lat"], "lng": loc["lon"]} if loc else None,
                score=hit.get("sort", [0])[0] if hit.get("sort") else 0,
            )
        )

    return SearchResponse(
        query=f"nearby({lat},{lng},{radius_m}m)", total=resp["hits"]["total"]["value"], results=results
    )


async def close_es() -> None:
    global _es
    if _es is not None:
        try:
            await _es.close()
        except Exception:
            logger.warning("Elasticsearch close failed", exc_info=True)
        _es = None
