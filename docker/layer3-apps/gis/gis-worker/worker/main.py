import asyncio
import json
import logging
import signal

from aiokafka import AIOKafkaConsumer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from aiokafka.errors import TopicAlreadyExistsError

from worker.config import settings
from worker.ingest import process_import

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("gis-worker")

shutdown_event = asyncio.Event()


def _handle_signal() -> None:
    logger.info("Shutdown signal received")
    shutdown_event.set()


async def ensure_topic() -> None:
    """Create the Kafka topic if it doesn't exist."""
    admin = AIOKafkaAdminClient(bootstrap_servers=settings.kafka_bootstrap)
    try:
        await admin.start()
        topic = NewTopic(
            name=settings.kafka_import_topic,
            num_partitions=1,
            replication_factor=1,
        )
        await admin.create_topics([topic])
        logger.info("Created topic: %s", settings.kafka_import_topic)
    except TopicAlreadyExistsError:
        logger.info("Topic already exists: %s", settings.kafka_import_topic)
    finally:
        await admin.close()


async def main() -> None:
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_signal)

    # Retry connecting to Kafka with backoff
    max_retries = 10
    for attempt in range(1, max_retries + 1):
        if shutdown_event.is_set():
            return
        try:
            await ensure_topic()
            break
        except Exception as e:
            if attempt == max_retries:
                logger.error("Failed to connect to Kafka after %d attempts: %s", max_retries, e)
                return
            wait = min(attempt * 3, 30)
            logger.warning("Kafka not ready (attempt %d/%d): %s. Retrying in %ds...", attempt, max_retries, e, wait)
            await asyncio.sleep(wait)

    consumer = AIOKafkaConsumer(
        settings.kafka_import_topic,
        bootstrap_servers=settings.kafka_bootstrap,
        group_id=settings.kafka_group_id,
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        retry_backoff_ms=2000,
        request_timeout_ms=30000,
    )

    for attempt in range(1, max_retries + 1):
        if shutdown_event.is_set():
            return
        try:
            await consumer.start()
            break
        except Exception as e:
            if attempt == max_retries:
                logger.error("Failed to start consumer after %d attempts: %s", max_retries, e)
                return
            wait = min(attempt * 5, 30)
            logger.warning(
                "Consumer start failed (attempt %d/%d): %s. Retrying in %ds...", attempt, max_retries, e, wait
            )
            await asyncio.sleep(wait)

    logger.info("Worker started, consuming from %s", settings.kafka_import_topic)

    try:
        async for msg in consumer:
            if shutdown_event.is_set():
                break
            try:
                event = msg.value
                logger.info("Processing import_id=%s, file=%s", event.get("import_id"), event.get("minio_path"))
                await process_import(event)
                await consumer.commit()
            except Exception:
                logger.exception("Failed to process message: %s", msg.value)
                await consumer.commit()
    finally:
        await consumer.stop()
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
