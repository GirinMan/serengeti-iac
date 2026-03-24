import logging
from io import BytesIO

from minio import Minio
from minio.error import S3Error

from app.config import settings

logger = logging.getLogger(__name__)

_client: Minio | None = None


def get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        _ensure_bucket()
    return _client


def _ensure_bucket() -> None:
    client = _client
    if client is None:
        return
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
            logger.info("Created bucket: %s", settings.minio_bucket)
    except S3Error as e:
        logger.error("Failed to ensure bucket: %s", e)
        raise


def upload_file(object_name: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    client = get_minio()
    client.put_object(
        bucket_name=settings.minio_bucket,
        object_name=object_name,
        data=BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    path = f"{settings.minio_bucket}/{object_name}"
    logger.info("Uploaded %s (%d bytes)", path, len(data))
    return path


def download_file(object_name: str) -> bytes:
    client = get_minio()
    response = client.get_object(settings.minio_bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
