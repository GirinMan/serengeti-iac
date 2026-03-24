import json
import logging

from aiokafka import AIOKafkaProducer

from app.config import settings

logger = logging.getLogger(__name__)

_producer: AIOKafkaProducer | None = None


async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap,
            value_serializer=lambda v: json.dumps(v, default=str).encode(),
        )
        await _producer.start()
    return _producer


async def publish_import_request(
    import_id: int,
    minio_path: str,
    file_type: str,
    target_table: str,
    region_code: str | None,
    facility_type: str = "",
) -> None:
    producer = await get_producer()
    event = {
        "import_id": import_id,
        "minio_path": minio_path,
        "file_type": file_type,
        "target_table": target_table,
        "region_code": region_code,
        "facility_type": facility_type,
    }
    await producer.send_and_wait(settings.kafka_import_topic, event)
    logger.info("Published import request: import_id=%d, path=%s", import_id, minio_path)


async def close_producer() -> None:
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None
