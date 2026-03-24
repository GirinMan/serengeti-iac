import json
import logging
from typing import Any

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(settings.redis_url, decode_responses=True)
    return _pool


async def cache_get(key: str) -> Any | None:
    try:
        r = await get_redis()
        val = await r.get(key)
        if val is not None:
            return json.loads(val)
    except Exception:
        logger.warning("Redis cache_get failed for key=%s, falling back to DB", key, exc_info=True)
    return None


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    try:
        r = await get_redis()
        await r.set(key, json.dumps(value, default=str), ex=ttl or settings.cache_ttl)
    except Exception:
        logger.warning("Redis cache_set failed for key=%s, skipping cache", key, exc_info=True)


async def cache_delete(pattern: str) -> None:
    try:
        r = await get_redis()
        async for key in r.scan_iter(match=pattern):
            await r.delete(key)
    except Exception:
        logger.warning("Redis cache_delete failed for pattern=%s, skipping", pattern, exc_info=True)


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        try:
            await _pool.aclose()
        except Exception:
            logger.warning("Redis close failed", exc_info=True)
        _pool = None
